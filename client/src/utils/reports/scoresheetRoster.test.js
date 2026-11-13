import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoresheetRoster } from './scoresheetRoster.js';
const players = count => Array.from({ length: count }, (_, id) => ({ id, name: `Player ${id}` }));
test('competition capacities 12, 14 and 20 include liberos and align unequal teams', () => {
    for (const capacity of [12, 14, 20]) {
        const result = scoresheetRoster({ maxPlayers: capacity, playersA: players(capacity), playersB: players(5), liberosA: players(2), liberosB: players(1) });
        assert.equal(result.playersA.length + result.liberosA.length, capacity);
        assert.equal(result.regularRows, capacity - 2);
        assert.equal(result.playersB.length, 5);
        assert.equal(result.liberoRows, 2);
    }
});
test('teams with zero or one libero do not lose two normal players', () => {
    for (const capacity of [12, 14, 20]) {
        for (const liberos of [0, 1]) {
            const result = scoresheetRoster({ maxPlayers: capacity, playersA: players(capacity), liberosA: players(liberos) });
            assert.equal(result.playersA.length, capacity - liberos);
            assert.equal(result.playersA.length + result.liberosA.length, capacity);
        }
    }
});
