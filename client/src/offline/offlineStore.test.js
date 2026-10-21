import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import 'fake-indexeddb/auto';
import { createLocal, getLocal, listLocal, saveLocal, localView, updateLocal, prepareVisCheckout } from './offlineStore.js';
import { syncLocalMatch } from './syncVis.js';
import { prepareOffline, unlockOffline, clearOfflineSession, getOfflineUser, offlineProfile } from './offlineAuth.js';
import { setAuthSession } from '../auth/authStorage.js';
const require = createRequire(import.meta.url);
const { syncPayload } = require('../../../backend/utils/visOffline.js');
const { createPayload } = require('../../../backend/utils/customVis.js');
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }; };
const grant = () => ({ user: { id: 7, role: 'statistician', username: 'Tester' }, expiresAt: Date.now() + 86400000 });
const config = () => ({ title: 'IndexedDB', maxSets: 3, creationId: crypto.randomUUID(),
    home: { name: 'H', players: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: 'H', last_name: String(i) })) },
    away: { name: 'A', players: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: 'A', last_name: String(i) })) } });
beforeEach(() => {
    globalThis.localStorage = memory(); globalThis.sessionStorage = memory();
    globalThis.window = new EventTarget();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    sessionStorage.setItem('vis_offline_unlocked_v1', JSON.stringify(grant()));
    sessionStorage.setItem('user', JSON.stringify(grant().user)); sessionStorage.setItem('token', 'online-test-token');
});
async function recordGame() {
    let current = await createLocal(config());
    const operation = command => ({ operationId: crypto.randomUUID(), revision: current.payload.revision,
        command: { ...command, context: { key: localView(current).state.context.key } } });
    await saveLocal(current.id, operation({ type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true }));
    current = await getLocal(current.id);
    await saveLocal(current.id, operation({ type: 'RALLY', events: [{ team: 'home', player: 1, skill: 'S', grade: '#' }] }));
    return getLocal(current.id);
}

test('Admin match checkout uses a separate local ID, keeps original players/teams and syncs with its session', async () => {
    const payload = createPayload(config(), 'custom-admin-fixture');
    payload.match = { ...payload.match, id: 913, home_team_id: 21, away_team_id: 42, is_custom_vis: false };
    payload.offlineSession = crypto.randomUUID();
    payload.config.home.players.forEach((p, i) => { p.id = 2101 + i; });
    payload.config.away.players.forEach((p, i) => { p.id = 4201 + i; });
    const record = await prepareVisCheckout('913', async () => ({ data: { payload, leaseCreated: false } }), async () => {});
    assert.equal(record.id, 'local-admin-913');
    assert.equal(record.serverId, '913');
    await saveLocal(record.id, { operationId: crypto.randomUUID(), revision: 0, command: {
        type: 'SET_LINEUP', lineups: { home: [2101,2102,2103,2104,2105,2106], away: [4201,4202,4203,4204,4205,4206] }, servingTeam: 'home', firstSetHomeLeft: true,
    } });
    const current = await getLocal(record.id);
    await saveLocal(record.id, { operationId: crypto.randomUUID(), revision: current.payload.revision, command: {
        type: 'RALLY', context: { key: localView(current).state.context.key }, events: [{ team: 'home', player: 2101, skill: 'S', grade: '#' }],
    } });
    const local = await getLocal(record.id);
    assert.equal(local.payload.actions[0].team_id, 21);
    assert.equal(local.payload.actions[0].player_id, 2101);
    assert.equal(localView(local).match.is_custom_vis, false);
    await syncLocalMatch(record.id, true, async (id, request) => {
        assert.equal(id, '913');
        assert.equal(request.offlineSession, payload.offlineSession);
        return { data: syncPayload(payload, request) };
    });
    assert.equal((await getLocal(record.id)).released, true);
    assert.equal((await getLocal(record.id)).queue.length, 0);
});
test('PIN unlock encrypts grant, rejects wrong PIN and expires without storing online token', async () => {
    await prepareOffline(grant(), '123456');
    const profile = offlineProfile();
    assert.equal(profile.encrypted.includes('online-test-token'), false);
    assert.equal(profile.encrypted.includes('statistician'), false);
    clearOfflineSession(); assert.equal(getOfflineUser(), null);
    await assert.rejects(unlockOffline('999999'), /PIN/);
    assert.equal((await unlockOffline('123456')).id, 7);
    profile.expiresAt = Date.now() - 1; localStorage.setItem('vis_offline_profile_v1', JSON.stringify(profile));
    clearOfflineSession(); await assert.rejects(unlockOffline('123456'), /หมดอายุ/);
});
test('IndexedDB saves survive reads; concurrent duplicate submits queue exactly once', async () => {
    const input = config(), record = await createLocal(input);
    assert.equal((await createLocal(input)).id, record.id);
    const op = { revision: 0, operationId: crypto.randomUUID(), command: { type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true } };
    await Promise.all([saveLocal(record.id, op), saveLocal(record.id, op)]);
    const saved = await getLocal(record.id);
    assert.equal(saved.queue.length, 1); assert.equal(saved.payload.revision, 1);
    await assert.rejects(saveLocal(record.id, { revision: 1, operationId: crypto.randomUUID(), command: { type: 'CONFIRM' } }), /ซิงค์/);
});
test('ambiguous network failure preserves queue; retry commits once and release locks local recording', async () => {
    const record = await recordGame(); let server = createPayload(record.initialConfig, record.serverId), first = true;
    const transport = async (_id, body) => {
        const result = syncPayload(server, body); server = result.payload;
        if (first) { first = false; throw Error('Lost response after commit'); }
        return { data: { ...result } };
    };
    await assert.rejects(syncLocalMatch(record.id, false, transport), /Lost response/);
    assert.equal((await getLocal(record.id)).queue.length, 2);
    await syncLocalMatch(record.id, true, transport);
    const synced = await getLocal(record.id);
    assert.equal(synced.queue.length, 0); assert.equal(synced.released, true);
    assert.equal(localView(synced).state.score.home, 1); assert.equal(server.actions.length, 1);
    await assert.rejects(saveLocal(record.id, { operationId: crypto.randomUUID(), revision: 2, command: { type: 'UNDO' } }), /ไม่มีสิทธิ์/);
});
test('server conflict retains every command and payload; sync blocks concurrent local writes', async () => {
    const record = await recordGame();
    await assert.rejects(syncLocalMatch(record.id, false, async () => {
        await assert.rejects(saveLocal(record.id, { operationId: crypto.randomUUID(), revision: record.payload.revision, command: { type: 'UNDO' } }), /กำลังซิงค์/);
        throw Object.assign(Error('Revision conflict'), { response: { status: 409 } });
    }), /Revision conflict/);
    const saved = await getLocal(record.id);
    assert.deepEqual(saved.queue, record.queue); assert.deepEqual(saved.payload, record.payload); assert.equal(saved.syncingUntil, undefined);
});
test('account isolation and crash-expired sync locks retain recoverable data', async () => {
    const record = await recordGame();
    await updateLocal(record.id, current => ({ ...current, syncingUntil: Date.now() - 1 }));
    const other = { ...grant(), user: { id: 99, role: 'statistician' } };
    sessionStorage.setItem('vis_offline_unlocked_v1', JSON.stringify(other)); sessionStorage.setItem('user', JSON.stringify(other.user));
    assert.equal((await listLocal()).length, 0); await assert.rejects(getLocal(record.id), /ไม่พบ/);
    sessionStorage.setItem('vis_offline_unlocked_v1', JSON.stringify(grant())); sessionStorage.setItem('user', JSON.stringify(grant().user));
    assert.equal((await getLocal(record.id)).queue.length, 2);
});

test('VIS resumes from a lost response in a later batch without resending acknowledged batches', async () => {
    const record = await createLocal(config());
    // Stable operations provide a large journal without building a huge volleyball fixture.
    await updateLocal(record.id, r => ({ ...r, queue: Array.from({ length: 5101 }, (_, i) => ({ operationId: `operation-${i}`, revision: i, command: { type: 'TEST' } })) }));
    const committed = new Set(); let calls = 0, lose = true, revision = 0;
    const transport = async (_id, body) => {
        calls++; assert.ok(body.operations.length <= 100);
        for (const op of body.operations) if (!committed.has(op.operationId)) { committed.add(op.operationId); revision++; }
        if (calls === 2 && lose) { lose = false; throw Error('Lost second response'); }
        assert.equal(body.release, committed.size === 5101);
        return { data: { acknowledged: body.operations.map(op => op.operationId), payload: { ...record.payload, revision, lastSyncedAt: 'now' } } };
    };
    await assert.rejects(syncLocalMatch(record.id, true, transport), /Lost second/);
    assert.equal((await getLocal(record.id)).queue.length, 5001);
    await syncLocalMatch(record.id, true, transport);
    assert.equal(committed.size, 5101); assert.equal((await getLocal(record.id)).queue.length, 0); assert.equal((await getLocal(record.id)).released, true);
});

test('VIS checkout refuses dirty data before contacting the server', async () => {
    const record = await recordGame();
    await assert.rejects(prepareVisCheckout(record.serverId, () => { throw Error('must not call'); }), /ห้ามเขียนทับ/);
    assert.equal((await getLocal(record.id)).queue.length, 2);
});

test('VIS failed local save compensates only a newly created lease', async () => {
    const record = await createLocal(config()); let cancelled = 0;
    const { IDBObjectStore } = await import('fake-indexeddb');
    const original = IDBObjectStore.prototype.put;
    for (const leaseCreated of [true, false]) {
        let fail = true;
        IDBObjectStore.prototype.put = function(value, ...args) {
            if (fail && value.serverCreated) { fail = false; throw Error('Storage quota exceeded'); }
            return original.call(this, value, ...args);
        };
        try {
            await assert.rejects(prepareVisCheckout(record.serverId, async () => ({ data: { payload: record.payload, match: {}, leaseCreated } }), async () => { cancelled++; }), /quota/);
        } finally { IDBObjectStore.prototype.put = original; }
        assert.equal((await getLocal(record.id)).preparingToken, undefined);
    }
    assert.equal(cancelled, 1);
});

test('expired PIN unlocks backups but never authorizes recording', async () => {
    await prepareOffline(grant(), '123456'); const record = await recordGame();
    const originalNow = Date.now, afterExpiry = grant().expiresAt + 1000;
    clearOfflineSession(); Date.now = () => afterExpiry;
    try {
        await assert.rejects(unlockOffline('123456'), /หมดอายุ/);
        await assert.rejects(unlockOffline('000000', { readOnly: true }), /PIN/);
        await unlockOffline('123456', { readOnly: true });
        assert.equal(getOfflineUser(), null);
        assert.equal((await getLocal(record.id, { readOnly: true })).queue.length, 2);
        await assert.rejects(saveLocal(record.id, {}), /PIN/);
    } finally { Date.now = originalNow; }
});

test('dashboard PIN cannot switch to another account or replace a profile with pending work', async () => {
    await prepareOffline(grant(), '123456');
    const record = await recordGame(), profile = JSON.stringify(offlineProfile());
    const scorer = { id: 8, role: 'scorer', username: 'scorer' };
    setAuthSession({ token: 'scorer-online-token', user: scorer });
    await assert.rejects(unlockOffline('123456', { section: 'scorer', expectedUserId: 8 }), /บัญชีอื่น/);
    assert.equal(sessionStorage.getItem('token'), 'scorer-online-token');
    assert.equal(JSON.parse(sessionStorage.getItem('user')).id, 8);
    assert.equal(getOfflineUser(), null);
    await assert.rejects(prepareOffline({ user: scorer, expiresAt: Date.now() + 86400000 }, '654321', { replaceAccount: true }), /รอซิงค์/);
    assert.equal(JSON.stringify(offlineProfile()), profile);
    setAuthSession({ token: 'original-online-token', user: grant().user });
    await unlockOffline('123456', { section: 'vis', expectedUserId: '7' });
    assert.equal((await getLocal(record.id)).queue.length, 2);
    assert.equal(sessionStorage.getItem('token'), 'original-online-token');
});

test('strict PIN verifies the decrypted account even if the profile metadata names the current user', async () => {
    await prepareOffline(grant(), '123456');
    const profile = offlineProfile(); profile.userId = 8;
    localStorage.setItem('vis_offline_profile_v1', JSON.stringify(profile));
    setAuthSession({ token: 'scorer-online-token', user: { id: 8, role: 'scorer', username: 'scorer' } });
    await assert.rejects(unlockOffline('123456', { section: 'scorer', expectedUserId: 8 }), /บัญชีปัจจุบันเปลี่ยน/);
    assert.equal(sessionStorage.getItem('token'), 'scorer-online-token');
    assert.equal(getOfflineUser(), null);
});

test('VIS engine replays multiple batches with correct revisions after a lost final release response', async () => {
    let record = await recordGame();
    for (let i = 0; i < 55; i++) {
        for (const command of [{ type: 'RALLY', events: [{ team: 'away', player: null, skill: 'OP', grade: '#' }] }, { type: 'UNDO' }]) {
            await saveLocal(record.id, { operationId: crypto.randomUUID(), revision: record.payload.revision, command: { ...command, context: { key: localView(record).state.context.key } } });
            record = await getLocal(record.id);
        }
    }
    let server = createPayload(record.initialConfig, record.serverId), lose = true;
    const transport = async (_id, body) => {
        const result = syncPayload(server, body); server = result.payload;
        if (body.release && lose) { lose = false; throw Error('Lost release'); }
        return { data: result };
    };
    await assert.rejects(syncLocalMatch(record.id, true, transport), /Lost release/);
    assert.equal((await getLocal(record.id)).queue.length, 12);
    await syncLocalMatch(record.id, true, transport);
    const final = await getLocal(record.id);
    assert.equal(final.queue.length, 0); assert.equal(final.released, true);
    assert.equal(final.payload.revision, record.payload.revision); assert.equal(final.payload.match.team_a_score, record.payload.match.team_a_score);
});
