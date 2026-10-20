const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectOfficialState, applyRally } = require('../utils/visWorkflow');
const match = { home_team_id: 10, away_team_id: 20, max_sets: 5,
    vis_state: { lineups: { home: [1,2,3,4,5,6], away: [11,12,13,14,15,16] }, servingTeam: 'home', firstSetHomeLeft: true } };
test('paired winner and loser award exactly one point and one rotation, including reload and undo', () => {
    const before = projectOfficialState(match).state;
    const events = [{ team: 'home', player: 1, skill: 'S', grade: '' },
        { team: 'away', player: 12, skill: 'A', grade: '#' }, { team: 'home', player: 2, skill: 'B', grade: '=' }];
    const result = applyRally(before, events);
    assert.deepEqual(result.state.score, { home: 0, away: 1 });
    assert.equal(result.state.servingTeam, 'away');
    assert.deepEqual(result.state.lineups.away, [12,13,14,15,16,11]);
    const rows = events.map((event, index) => ({ ...event, id: index + 1, action_type: 'VIS_STAT', set_number: 1,
        team_id: event.team === 'home' ? 10 : 20, details: { rallyId: 'test-rally', rallyPoint: index === 2,
            statisticalRallyWinner: result.winner, visContext: { ...before.context, scoreAfter: result.state.score } } }));
    const loaded = projectOfficialState(match, rows).state;
    assert.deepEqual(loaded.lineups, result.state.lineups);
    assert.deepEqual(loaded.score, result.state.score);
    assert.equal(loaded.servingTeam, 'away');
    assert.deepEqual(projectOfficialState(match, []).state.score, before.score);
});
test('reject contradictory winners, no outcome, invalid player and wrong server', () => {
    const state = projectOfficialState(match).state;
    const hit = { team: 'home', player: 2, skill: 'A', grade: '#' };
    assert.throws(() => applyRally(state, [hit, { ...hit, team: 'away', player: 12 }]), /winning team/);
    assert.throws(() => applyRally(state, [{ ...hit, grade: '+' }]), /winning team/);
    assert.throws(() => applyRally(state, [{ ...hit, player: 99 }]), /on court/);
    assert.throws(() => applyRally(state, [{ ...hit, skill: 'S' }]), /P1/);
    assert.deepEqual(applyRally(state, [{ team: 'home', player: null, skill: 'OP', grade: '#' }]).state.score, { home: 1, away: 0 });
});
