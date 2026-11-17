import test from 'node:test';
import assert from 'node:assert/strict';

test('knockout results do not enter pool standings and confirmed same-pool draw order is respected', () => {
    const teams=[{id:1,name:'Alpha',workflow_pool:'A',workflow_rank:2},{id:2,name:'Beta',workflow_pool:'A',workflow_rank:1}];
    const result=calculateStandings(teams,[{status:'completed',workflow_phase:'knockout',home_team_id:1,away_team_id:2,home_set_score:3,away_set_score:0}]);
    assert.deepEqual(result.map(team=>team.id),[2,1]);
    assert.ok(result.every(team=>team.played===0));
});
import { calculateStandings } from './standings.js';

const teams = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
test('a deciding set awards 2 and 1 points for both match formats', () => {
    for (const [max_sets, home_set_score, away_set_score] of [[3, 2, 1], [5, 3, 2]]) {
        const rows = calculateStandings(teams, [{ home_team_id: 1, away_team_id: 2, status: 'completed', max_sets, home_set_score, away_set_score }]);
        assert.equal(rows[0].points, 2);
        assert.equal(rows[1].points, 1);
    }
});
test('a straight-set result awards 3 points and skips unfinished or tied results', () => {
    const rows = calculateStandings(teams, [
        { home_team_id: '1', away_team_id: '2', status: 'FINISHED', max_sets: 3, home_set_score: 2, away_set_score: 0, set_scores: '["25-18",{"home":25,"away":20}]' },
        { home_team_id: 1, away_team_id: 2, status: 'live', home_set_score: 1, away_set_score: 0 },
        { home_team_id: 1, away_team_id: 2, status: 'completed', home_set_score: 0, away_set_score: 0 }
    ]);
    assert.equal(rows[0].points, 3);
    assert.equal(rows[0].played, 1);
    assert.equal(rows[0].points_won, 50);
    assert.equal(rows[1].points_won, 38);
});
