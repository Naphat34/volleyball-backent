import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPoolStandings } from './standingsPools.js';

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

test('each pool ranks only its own matches and excludes the knockout round', () => {
    const registered = [1, 2, 3, 4, 5, 6].map(id => ({ id, name: String(id) }));
    const match = (id, home, away, fields) => ({
        id, home_team_id: home, away_team_id: away, status: 'completed',
        home_set_score: 2, away_set_score: 0, ...fields,
    });
    const boards = buildPoolStandings({ id: 10, max_sets: 3 }, registered, [
        match(1, 1, 2, { pool_name: 'A', status: 'scheduled' }),
        match(2, 2, 1, {}),
        match(3, 3, 4, { pool_name: 'B' }),
        match(4, 1, 3, { workflow_phase: 'knockout' }),
        match(5, 1, 2, { round_name: 'รอบชิงชนะเลิศ' }),
        match(6, 1, 4, {}),
        match(7, 5, 6, {}),
    ]);
    assert.deepEqual(boards.map(board => board.pool), ['A', 'B', '']);
    assert.deepEqual(boards.map(board => board.matches.map(item => item.id)), [[1, 2], [3], [7]]);
    assert.deepEqual(boards.map(board => board.standings.map(team => team.id)), [[2, 1], [3, 4], [5, 6]]);
    assert.ok(boards.every(board => board.standings.every(team => team.played === 1)));
});
