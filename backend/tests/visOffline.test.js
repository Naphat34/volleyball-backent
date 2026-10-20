const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, commandPayload, view } = require('../utils/customVis');
const { checkout, assertAvailable, syncPayload } = require('../utils/visOffline');
const config = { title: 'Offline', maxSets: 3,
    home: { name: 'H', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'H', last_name: String(i) })) },
    away: { name: 'A', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'A', last_name: String(i) })) } };
const deviceId = 'primary-device-0001';
function fixture() {
    const base = createPayload(config, 'custom-test');
    let local = structuredClone(base);
    const operations = [];
    const send = command => {
        const operation = { revision: local.revision, operationId: `offline-operation-${operations.length + 1}`, command: { ...command, context: { key: view(local).state.context.key } } };
        local = commandPayload(local, operation).payload; operations.push(operation);
    };
    send({ type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true });
    send({ type: 'RALLY', events: [{ team: 'away', player: 1001, skill: 'A', grade: '#' }, { team: 'home', player: 1, skill: 'B', grade: '=' }] });
    return { base, local, operations, request: { deviceId, baseRevision: 0, operations } };
}
test('offline batch reproduces one point, side-out and rotation exactly', () => {
    const f = fixture(), synced = syncPayload(f.base, f.request);
    assert.deepEqual(view(synced.payload).state, view(f.local).state);
    assert.equal(view(synced.payload).state.score.away, 1);
    assert.equal(view(synced.payload).state.context.serverPlayerId, 1002);
    assert.equal(f.base.revision, 0);
});
test('lost response retries do not duplicate scores or operations', () => {
    const f = fixture(), first = syncPayload(f.base, f.request), retry = syncPayload(first.payload, f.request);
    assert.equal(retry.payload.revision, first.payload.revision);
    assert.equal(retry.payload.actions.length, 2);
    assert.deepEqual(retry.acknowledged, f.operations.map(op => op.operationId));
});
test('changed revision and another primary device are conflicts without mutation', () => {
    const f = fixture(), changed = structuredClone(f.base); changed.revision++;
    assert.throws(() => syncPayload(changed, f.request), error => error.status === 409);
    assert.equal(changed.actions.length, 0);
    checkout(f.base, deviceId);
    assert.throws(() => checkout(f.base, 'other-device-0002'), error => error.status === 409);
    assert.throws(() => assertAvailable(f.base), error => error.status === 409);
});
test('release restores online writes; old device cannot steal a new checkout', () => {
    const f = fixture();
    const result = syncPayload(f.base, { ...f.request, release: true });
    assert.doesNotThrow(() => assertAvailable(result.payload));
    checkout(result.payload, 'other-device-0002');
    assert.throws(() => syncPayload(result.payload, f.request), error => error.status === 409);
});
test('bad tail rolls back the entire pure batch and cannot confirm offline', () => {
    const f = fixture(), original = JSON.stringify(f.base);
    const bad = { operationId: 'invalid-operation-003', revision: 2, command: { type: 'CONFIRM' } };
    assert.throws(() => syncPayload(f.base, { ...f.request, operations: [...f.operations, bad] }));
    assert.equal(JSON.stringify(f.base), original);
});
test('undo and controls survive replay; duplicate IDs are rejected', () => {
    const f = fixture();
    let p = f.local;
    for (const command of [{ type: 'UNDO' }, { type: 'TIMEOUT', team: 'home' }, { type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 7 }]) {
        const op = { operationId: `offline-more-operation-${f.operations.length + 1}`, revision: p.revision, command };
        f.operations.push(op); p = commandPayload(p, op).payload;
    }
    const result = syncPayload(f.base, f.request);
    assert.deepEqual(view(result.payload).state, view(p).state);
    assert.equal(view(result.payload).state.score.away, 0);
    assert.throws(() => syncPayload(f.base, { ...f.request, operations: [f.operations[0], f.operations[0]] }));
});
