import test from 'node:test';
import assert from 'node:assert/strict';
import { bangkokDay, buildControlCenter, matchPreparationIssues } from './controlCenter.js';

const match = { id: 1, competition_id: 10, match_date: '2026-11-03', start_time: '09:00', home_team_id: 1, away_team_id: 2, location: 'Hall A', referee_1_id: 10, referee_2_id: 20, status: 'scheduled' };
test('monitoring uses Bangkok calendar dates including UTC midnight rollover', () => {
    assert.equal(bangkokDay('2026-11-02T18:00:00Z'), '2026-11-03');
    const result = buildControlCenter([match], [{ status: 'open' }, { status: 'closed' }], '2026-11-02T18:00:00Z');
    assert.equal(result.todayMatches.length, 1);
    assert.equal(result.openCompetitions, 1);
});
test('readiness checks exclude finished, cancelled and standalone VIS matches', () => {
    assert.deepEqual(matchPreparationIssues(match), []);
    assert.ok(matchPreparationIssues({ ...match, away_team_id: 1 }).includes('teams'));
    assert.deepEqual(matchPreparationIssues({ id: 2, status: 'scheduled' }), ['teams', 'schedule', 'venue', 'officials']);
    for (const status of ['completed', 'cancelled']) assert.deepEqual(matchPreparationIssues({ status }), []);
    assert.deepEqual(matchPreparationIssues({ is_custom_vis: true }), []);
});
test('conflicts require the same start time and a shared venue or team, and count each pair once', () => {
    const second = { ...match, id: 2, home_team_id: 3, away_team_id: 4 };
    const third = { ...match, id: 3, start_time: '10:00' };
    const cancelled = { ...match, id: 4, status: 'cancelled' };
    const result = buildControlCenter([match, second, third, cancelled], [], '2026-11-03');
    assert.equal(result.collisions.length, 1);
    assert.equal(result.collisions[0].venue, true);
    assert.equal(result.collisions[0].team, false);
    assert.equal(buildControlCenter([match, { ...second, location: 'Hall B', home_team_id: 1 }], [], '2026-11-03').collisions[0].team, true);
    assert.equal(buildControlCenter([match, { ...second, status: 'completed' }], [], '2026-11-03').collisions.length, 0);
});

test('official activity counters do not promote independent VIS activity into live competition', () => {
    const result = buildControlCenter([{ ...match, vis_summary: { status: 'recording' } }], [], '2026-11-03');
    assert.equal(result.live, 0);
    assert.equal(result.completed, 0);
});
