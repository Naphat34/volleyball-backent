import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { prepareOffline, unlockOffline, offlineProfile, offlineMode, clearOfflineSession, getOfflineUser, pendingDeviceWork } from './offlineAuth.js';
import { getAccessSession, getStoredUser, setAuthSession, switchAccessMode } from '../authStorage.js';
import { accessDecision, resolveAccess, navigateAccess } from './accessRouting.js';
import { localRead } from './localRead.js';

const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }; };
const grant = (id = 1, role = 'statistician') => ({ user: { id, role, username: `user${id}` }, expiresAt: Date.now() + 86400000 });
beforeEach(() => {
    globalThis.localStorage = memory(); globalThis.sessionStorage = memory(); globalThis.indexedDB = new IDBFactory();
});
async function put(name, record) {
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('matches', { keyPath: 'id' });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result, tx = db.transaction('matches', 'readwrite'); tx.objectStore('matches').put(record);
            tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
        };
    });
}
test('wrong PIN and denied workspace do not commit or change the previous online account', async () => {
    await prepareOffline(grant(1, 'scorer'), '123456'); clearOfflineSession();
    setAuthSession({ user: grant(2).user, token: 'account2' });
    await assert.rejects(unlockOffline('000000', { workspace: 'scorer' }), /PIN/);
    await assert.rejects(unlockOffline('123456', { workspace: 'vis' }), /ไม่มีสิทธิ์/);
    assert.equal(offlineMode(), false); assert.equal(getOfflineUser(), null);
    assert.equal(getAccessSession().user.id, 2);
    await unlockOffline('123456', { workspace: 'scorer' });
    assert.equal(getAccessSession().kind, 'offline'); assert.equal(getStoredUser().id, 1);
    assert.equal(sessionStorage.getItem('token'), null);
});
test('missing and expired permits remain locked and expiry never falls back to an online token', async () => {
    await assert.rejects(unlockOffline('123456'), /หมดอายุ|ยังไม่เตรียม/);
    await prepareOffline(grant(), '123456'); await unlockOffline('123456');
    sessionStorage.setItem('token', 'old'); sessionStorage.setItem('user', JSON.stringify(grant(2).user));
    const expired = grant(); expired.expiresAt = Date.now() - 1;
    sessionStorage.setItem('vis_offline_unlocked_v1', JSON.stringify(expired));
    assert.equal(getAccessSession().kind, 'locked'); assert.equal(getStoredUser(), null);
});
test('offline list entry does not depend on any cached match and generic entry selects workspace once', async () => {
    const session = { kind: 'offline', user: grant().user };
    const noRead = () => { throw Error('must not read'); };
    assert.equal((await resolveAccess({ workspace: 'vis' }, session, noRead)).path, '/adminvis');
    assert.equal((await resolveAccess({ workspace: 'scorer' }, session, noRead)).path, '/scorer-offline');
    assert.equal(accessDecision(session).path, '/workspaces');
    assert.equal(accessDecision({ kind: 'offline', user: grant(1, 'scorer').user }).path, '/scorer-offline');
    assert.equal(accessDecision({ kind: 'offline', user: grant(1, 'scorer').user }, { workspace: 'vis' }).kind, 'denied');
});
test('missing, released and broken match storage give distinct visible notices and keep the list accessible', async () => {
    const session = { kind: 'offline', user: grant().user }, options = { workspace: 'scorer', search: '?returnTo=/scorer/42' };
    for (const [load, expected] of [[async () => [], /ไม่พบแมตช์/], [async () => [{ id: 42, released: true }], /คืนสิทธิ์/], [async () => { throw Error('disk'); }, /อ่านข้อมูลแมตช์.*disk/]]) {
        const result = await resolveAccess(options, session, load);
        assert.equal(result.path, '/scorer-offline'); assert.match(result.notice, expected);
    }
    const result = await resolveAccess(options, session, async () => [{ id: 42, localStorage: { match_42_state: 'saved', token: 'bad' } }]);
    assert.equal(result.path, '/scorer/42'); assert.equal(localStorage.getItem('match_42_state'), 'saved'); assert.equal(localStorage.getItem('token'), null);
    let calls = 0; navigateAccess((path, options) => { calls++; assert.equal(path, '/scorer/42'); assert.equal(options.replace, true); }, result);
    assert.equal(calls, 1);
});
test('account replacement requires explicit confirmation and is blocked by unsynced work in either database', async () => {
    await prepareOffline(grant(), '123456');
    await assert.rejects(prepareOffline(grant(2), '222222'), /ยืนยันเปลี่ยนบัญชี/);
    await put('volley-scorer-offline-v1', { id: 42, owner: '1', queue: [{ id: 'pending' }] });
    await assert.rejects(prepareOffline(grant(2), '222222', { replaceAccount: true }), /รอซิงค์/);
    assert.equal(offlineProfile().userId, 1);
    await put('volley-scorer-offline-v1', { id: 42, owner: '1', queue: [] });
    await put('volley-vis-offline-v1', { id: 'local-new', ownerId: '1', serverCreated: false, queue: [] });
    assert.equal(await pendingDeviceWork(), 1);
    await assert.rejects(prepareOffline(grant(2), '222222', { replaceAccount: true }), /รอซิงค์/);
    await put('volley-vis-offline-v1', { id: 'local-new', ownerId: '1', serverCreated: true, queue: [] });
    await prepareOffline(grant(2), '222222', { replaceAccount: true });
    assert.equal(offlineProfile().userId, 2);
});
test('renewing a PIN on the same account preserves queued work and only the new PIN unlocks', async () => {
    await prepareOffline(grant(), '123456');
    await put('volley-scorer-offline-v1', { id: 42, owner: '1', queue: [{ id: 'keep' }] });
    await prepareOffline(grant(), '654321'); clearOfflineSession();
    await assert.rejects(unlockOffline('123456'), /PIN/);
    await unlockOffline('654321'); assert.equal(await pendingDeviceWork(), 1);
});
test('mode switching is explicit and cannot silently use an absent online session', async () => {
    await prepareOffline(grant(), '123456'); await unlockOffline('123456');
    assert.throws(() => switchAccessMode(false), /เข้าสู่ระบบออนไลน์/);
    assert.equal(getAccessSession().kind, 'offline');
    setAuthSession({ user: grant().user, token: 'same' });
    assert.equal(getAccessSession().kind, 'online');
    switchAccessMode(true); assert.equal(getAccessSession().kind, 'offline');
});

test('expired JWT cannot repeatedly redirect the login back to a protected dashboard', () => {
    const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 1 }))}.signature`;
    setAuthSession({ user: grant().user, token });
    assert.equal(getAccessSession().kind, 'locked');
    assert.match(getAccessSession().reason, /ออนไลน์หมดอายุ/);
    assert.equal(accessDecision(getAccessSession(), { workspace: 'vis' }).kind, 'locked');
});

test('a malformed previous online user cannot block a valid offline PIN', async () => {
    await prepareOffline(grant(), '123456'); clearOfflineSession();
    sessionStorage.setItem('user', '{invalid'); sessionStorage.setItem('token', 'old');
    await unlockOffline('123456', { workspace: 'vis' });
    assert.equal(getAccessSession().kind, 'offline'); assert.equal(getStoredUser().id, 1);
    assert.equal(sessionStorage.getItem('token'), null);
});

test('blocked local reads time out with a retryable explanation instead of trapping the user', async () => {
    await assert.rejects(localRead(new Promise(() => {}), 5), /นานเกินไป/);
    assert.deepEqual(await localRead(Promise.resolve([]), 5), []);
});
