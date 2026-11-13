import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApprovedLineup, hasCompleteStartingLineup } from './approvedLineup.js';
const roster = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, number: index + 11, is_playing: 1 }));
const details = { lineup: roster.map((player, index) => ({ position: index + 1, player_id: String(player.id) })).reverse() };

test('accepted lineup immediately resolves shirt numbers in positions 1–6 from match roster', () => {
    const lineup = resolveApprovedLineup(details, roster);
    assert.deepEqual(lineup.map(player => player.number), [11, 12, 13, 14, 15, 16]);
    assert.deepEqual(lineup.map(player => player.originalPos), [0, 1, 2, 3, 4, 5]);
    assert.equal(hasCompleteStartingLineup(lineup), true);
    assert.equal(hasCompleteStartingLineup([...lineup.slice(0, 5), null]), false);
});

test('rejects incomplete positions, duplicate IDs, missing athletes, inactive players and Liberos before saving', () => {
    assert.throws(() => resolveApprovedLineup({ lineup: details.lineup.slice(1) }, roster));
    assert.throws(() => resolveApprovedLineup({ lineup: details.lineup.map(row => ({ ...row, player_id: 1 })) }, roster));
    assert.throws(() => resolveApprovedLineup({ lineup: details.lineup.map(row => ({ ...row, position: 1 })) }, roster));
    assert.throws(() => resolveApprovedLineup(details, roster.slice(1)));
    assert.throws(() => resolveApprovedLineup(details, roster.map(row => ({ ...row, is_playing: 0 }))));
    assert.throws(() => resolveApprovedLineup(details, roster.map(row => ({ ...row, role: 'L1' }))));
});
