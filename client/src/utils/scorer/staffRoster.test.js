import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateStaffPlayer } from './staffRoster.js';
import { createStaffLiveStateGate } from './staffLiveStateGate.js';

test('registered match names, number and libero role override stale live data', () => {
    const player = hydrateStaffPlayer({ id: '7', number: 99, first_name_th: '', role: '' }, [
        { id: 7, number: 12, first_name_th: 'สมชาย', first_name_en: 'Somchai', role: 'L1', is_libero1: 1 },
    ]);
    assert.equal(player.number, 12);
    assert.equal(player.first_name_th, 'สมชาย');
    assert.equal(player.first_name_en, 'Somchai');
    assert.equal(player.role, 'L1');
    assert.equal(player.is_libero1, 1);
});

test('hydrates ID-only lineup, preserves jersey zero and unknown players', () => {
    assert.equal(hydrateStaffPlayer(7, [{ id: 7, number: 0 }]).number, 0);
    assert.equal(hydrateStaffPlayer({ player_id: 8, number: 4 }, []).number, 4);
    assert.equal(hydrateStaffPlayer(null, []), null);
});

test('socket invalidates live poll data while allowing its registered roster to load', () => {
    const gate = createStaffLiveStateGate();
    const request = gate.begin();
    gate.accept({ updatedAt: 200 });
    assert.equal(gate.current(request), false);
    assert.equal(gate.currentRequest(request), true);
    gate.begin();
    assert.equal(gate.currentRequest(request), false);
});
