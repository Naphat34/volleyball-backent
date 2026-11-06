import test from 'node:test';
import assert from 'node:assert/strict';
import { adminVisCsv, adminVisIssues, adminVisRankingCsv, filterAdminVis, rankAdminVis, summarizeAdminVis } from './adminVims.js';

const stat = { id: 1, team_id: 10, team: 'home', team_name: 'H', name: 'P', number: 7, attack: 3, block: 1, serve: 2, attackAttempts: 8, attackErrors: 1, attackBlocked: 1 };
const matches = [
    { id: 1, source: 'official', competition_name: 'Cup', match_date: '2026-10-25', home_team: 'H', away_team: 'A', status: 'scheduled', vis_summary: { status: 'recording' }, action_count: 8, lineup_counts: { home: 6, away: 6 }, statistics: [stat] },
    { id: 'custom-1', source: 'custom', is_custom_vis: true, owner: 'alice', competition_name: 'Cup', match_date: '2026-10-26', status: 'completed', vis_summary: { status: 'confirmed' }, action_count: 8, lineup_counts: { home: 6, away: 6 }, statistics: [stat] },
    { id: 2, source: 'official', competition_name: 'Old Cup', status: 'completed', vis_summary: { status: 'idle' }, action_count: 0, statistics: [] },
];
test('filters, counters and effective statuses use the same full result set', () => {
    const result = filterAdminVis(matches, { competition: 'Cup', from: '2026-10-25', to: '2026-10-25', status: 'live', owner: 'unknown' });
    assert.deepEqual(result.map(m => m.id), [1]);
    assert.equal(summarizeAdminVis(result).recording, 1);
    assert.equal(summarizeAdminVis(result).total, 1);
    assert.equal(filterAdminVis(matches, { owner: 'alice' }).length, 1);
});
test('rankings default to confirmed statistics and never merge custom identities with official ids', () => {
    const confirmed = rankAdminVis(matches);
    assert.equal(confirmed.matchCount, 1);
    assert.equal(confirmed.players[0].points, 6);
    assert.equal(confirmed.players[0].efficiency, '12.5%');
    const all = rankAdminVis(matches, true);
    assert.equal(all.matchCount, 2);
    assert.equal(all.players.length, 2);
    assert.equal(all.teams.length, 2);
});
test('attention flags distinguish incomplete work and leases from unknown offline queues', () => {
    assert.deepEqual(adminVisIssues(matches[0]), []);
    assert.deepEqual(adminVisIssues(matches[2]), ['review', 'no_stats']);
    assert.deepEqual(adminVisIssues({ ...matches[0], offline_checked_out: true }), ['offline']);
    assert.deepEqual(adminVisIssues({ ...matches[2], status: 'cancelled' }), []);
});
test('CSV escapes formulas and quotation marks', () => {
    const csv = adminVisCsv([{ ...matches[0], home_team: '=SUM(1,2)', away_team: 'Team "A"' }]);
    assert.ok(csv.includes("'=SUM(1,2)"));
    assert.ok(csv.includes('Team ""A""'));
    assert.ok(csv.startsWith('\ufeff'));
    const ranking = adminVisRankingCsv(rankAdminVis(matches).players);
    assert.ok(ranking.includes('Attack efficiency'));
    assert.ok(ranking.includes('12.5%'));
});
