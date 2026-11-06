import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVisReport } from './visReportData.js';

const action = (id, set_number, home, away) => ({ id, action_type: 'VIS_STAT', set_number, team_id: 10, skill: 'OP', grade: '#', created_at: id === 1 ? '2026-10-01' : '2026-11-03', details: { visContext: { scoreAfter: { home, away } } } });
test('P-2 displays independent VIS set results and live points even when official results are empty', () => {
    const data = { match: { home_team_id: 10, away_team_id: 20, max_sets: 5, home_set_score: 0, away_set_score: 0 }, visActions: [action(1, 1, 1, 0), action(2, 1, 26, 24), action(3, 2, 7, 9)] };
    const report = buildVisReport(data, { scoreSource: 'vis' });
    assert.deepEqual(report.sets, [{ number: 1, home: 26, away: 24, finished: true }, { number: 2, home: 7, away: 9, finished: false }]);
    assert.deepEqual(report.wins, { home: 1, away: 0 });
    assert.equal(report.completed, false);
    assert.deepEqual(buildVisReport(data).wins, { home: 0, away: 0 });
    assert.equal(data.match.home_set_score, 0);
    assert.equal(report.visTiming.sets.length, 0);
});
test('P-2 recognizes finished VIS matches and preserves a zero score', () => {
    const report = buildVisReport({ match: { max_sets: 3 }, visActions: [action(1, 1, 25, 0), action(2, 2, 25, 12)] }, { scoreSource: 'vis' });
    assert.equal(report.completed, true);
    assert.deepEqual(report.wins, { home: 2, away: 0 });
    assert.equal(report.sets[0].away, 0);
});
