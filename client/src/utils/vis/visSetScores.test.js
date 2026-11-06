import test from 'node:test';
import assert from 'node:assert/strict';
import { visSetScoreSlots } from './visSetScores.js';

test('set slots show completed scores, current live points and unplayed placeholders separately', () => {
    const rows = visSetScoreSlots({ maxSets: 5, completedSets: [{ set: 1, home: 25, away: 20 }], currentSet: 2, score: { home: 7, away: 9 }, started: true });
    assert.equal(rows.length, 5);
    assert.deepEqual([rows[0].home, rows[0].away, rows[0].completed], [25, 20, true]);
    assert.deepEqual([rows[1].home, rows[1].away, rows[1].active], [7, 9, true]);
    assert.equal(rows[2].home, null);
});

test('waiting sets remain empty and a finished match does not overwrite its last completed score', () => {
    assert.equal(visSetScoreSlots({ maxSets: 3, currentSet: 2 })[1].home, null);
    const rows = visSetScoreSlots({ maxSets: 3, completedSets: [{ set_number: '2', home_score: 25, away_score: 0 }], currentSet: 2, score: { home: 0, away: 0 }, finished: true });
    assert.equal(rows.length, 3);
    assert.equal(rows[1].home, 25);
    assert.equal(rows[1].away, 0);
    assert.equal(rows[1].active, false);
});
