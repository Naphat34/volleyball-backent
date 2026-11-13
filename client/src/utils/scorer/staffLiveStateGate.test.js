import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaffLiveStateGate } from './staffLiveStateGate.js';

test('slow roster polls survive subsequent intervals and socket updates', () => {
    const gate = createStaffLiveStateGate();
    const pending = gate.beginPoll();
    assert.ok(pending);
    // Multiple timer ticks occur while the original roster request is pending.
    assert.equal(gate.beginPoll(), null);
    gate.accept({ workflowStep: 'LINEUP', updatedAt: 200 });
    assert.equal(gate.beginPoll(), null);
    assert.equal(gate.current(pending), false);
    assert.equal(gate.currentRequest(pending), true, 'roster response can still be displayed');
    assert.equal(gate.accept({ updatedAt: 100 }, pending), false, 'old workflow remains rejected');
    gate.finishPoll(pending);
    const next = gate.beginPoll();
    assert.ok(next);
    gate.finishPoll(pending);
    assert.equal(gate.beginPoll(), null, 'late cleanup must not release another poll');
    gate.finishPoll(next);
    assert.ok(gate.beginPoll());
});

test('delayed coin toss poll cannot replace a socket lineup update', () => {
    const gate = createStaffLiveStateGate();
    const pending = gate.begin();
    assert.equal(gate.accept({ workflowStep: 'LINEUP', updatedAt: 200 }), true);
    assert.equal(gate.accept({ workflowStep: 'COIN_TOSS', updatedAt: 100 }, pending), false);
    assert.equal(gate.current(pending), false);
    assert.equal(gate.accept({ workflowStep: 'COIN_TOSS', updatedAt: 100 }, gate.begin()), false);
});

test('newer polls win and socket updates invalidate remaining async poll work', () => {
    const gate = createStaffLiveStateGate();
    const first = gate.begin();
    const second = gate.begin();
    assert.equal(gate.accept({ updatedAt: 100 }, first), false);
    assert.equal(gate.accept({ updatedAt: 200 }, second), true);
    assert.equal(gate.current(second), true);
    gate.accept({ updatedAt: 300 });
    assert.equal(gate.current(second), false);
});

test('accepts legitimate newer coin toss resets and rejects unversioned stale data', () => {
    const gate = createStaffLiveStateGate();
    gate.accept({ workflowStep: 'LINEUP', updatedAt: 200 });
    assert.equal(gate.accept({ workflowStep: 'COIN_TOSS', updatedAt: 300 }), true);
    assert.equal(gate.accept({ workflowStep: 'LINEUP' }, gate.begin()), false);
});

test('legacy snapshots work until versioned data arrives; server timestamp is supported', () => {
    const gate = createStaffLiveStateGate();
    assert.equal(gate.accept({}, gate.begin()), true);
    assert.equal(gate.accept({ serverUpdatedAt: '2026-11-13T00:00:02Z' }), true);
    assert.equal(gate.accept({ serverUpdatedAt: '2026-11-13T00:00:01Z' }, gate.begin()), false);
});
