import test from 'node:test';
import assert from 'node:assert/strict';
import { assignLineupPlayer, initialLineup, lineupCourtOrder, rotateLineup, validLineup } from './lineupSelection.js';

test('lineups normalize ids and reject missing or stale roster players', () => {
    const players = [1, 2, 3, 4, 5, 6].map(id => ({ id: String(id) }));
    assert.deepEqual(initialLineup({ players, lineup: [{ id: '1' }, { id: 99 }] }), [1, '', '', '', '', '']);
    assert.ok(validLineup([1, 2, 3, 4, 5, 6], players));
    assert.equal(validLineup([1, 2, 3, 4, 5, 5], players), false);
    assert.equal(validLineup([1, 2, 3, 4, 5, 99], players), false);
});

test('assigning a player swaps occupied positions and clicking the same assignment clears it', () => {
    const lineup = [1, 2, 3, 4, 5, 6];
    assert.deepEqual(assignLineupPlayer(lineup, 0, 3), [3, 2, 1, 4, 5, 6]);
    assert.deepEqual(assignLineupPlayer(lineup, 0, 1), ['', 2, 3, 4, 5, 6]);
    assert.deepEqual(assignLineupPlayer(['', 2, 3, 4, 5, 6], 0, 3), [3, 2, '', 4, 5, 6]);
    assert.deepEqual(lineup, [1, 2, 3, 4, 5, 6]);
});

test('court positions and rotation keep P1 as the server and preserve all six players', () => {
    assert.deepEqual(lineupCourtOrder, [3, 2, 1, 4, 5, 0]);
    const slots = [1, 2, 3, 4, 5, 6];
    assert.deepEqual(rotateLineup(slots, 1), [2, 3, 4, 5, 6, 1]);
    assert.deepEqual(rotateLineup(rotateLineup(slots, 1), -1), slots);
});
