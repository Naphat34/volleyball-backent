import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import 'fake-indexeddb/auto';
import { createLocal, getLocal, listLocal, saveLocal, localView, updateLocal } from './offlineStore.js';
import { syncLocalMatch } from './syncVis.js';
import { prepareOffline, unlockOffline, clearOfflineSession, getOfflineUser, offlineProfile } from './offlineAuth.js';
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
