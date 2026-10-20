const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectOfficialState, applyCommand } = require('../utils/visWorkflow');

const lineups = { home: [1, 2, 3, 4, 5, 6], away: [11, 12, 13, 14, 15, 16] };
function fixture(controls = []) {
    return { home_team_id: 10, away_team_id: 20, max_sets: 5,
        vis_state: { lineups, servingTeam: 'home', firstSetHomeLeft: true, controls } };
}
function record(match, actions, team, skill, grade) {
    const before = projectOfficialState(match, actions).state;
    const result = applyCommand(before, { type: 'STAT', team, skill, grade,
        player: before.lineups[team][0], officialContext: before.context });
    const action = { id: actions.length + 1, action_type: 'VIS_STAT', set_number: before.currentSet,
        team_id: team === 'home' ? 10 : 20, skill, grade, details: result.event.details };
    actions.push(action);
    const reloaded = projectOfficialState(match, actions).state;
    assert.deepEqual(reloaded.score, result.state.score);
    assert.equal(reloaded.servingTeam, result.state.servingTeam);
    assert.deepEqual(reloaded.lineups, result.state.lineups);
    return reloaded;
}

test('receiving winner rotates P2 to P1; serving winner retains the server', () => {
    const match = fixture(), actions = [];
    let state = record(match, actions, 'home', 'S', '#');
    assert.deepEqual(state.score, { home: 1, away: 0 });
    assert.equal(state.servingTeam, 'home');
    assert.equal(state.context.serverPlayerId, 1);
    state = record(match, actions, 'away', 'A', '#');
    assert.deepEqual(state.score, { home: 1, away: 1 });
    assert.equal(state.servingTeam, 'away');
    assert.deepEqual(state.lineups.away, [12, 13, 14, 15, 16, 11]);
    assert.equal(state.context.serverPlayerId, 12);
    state = record(match, actions, 'away', 'S', '#');
    assert.equal(state.context.serverPlayerId, 12);
    state = record(match, actions, 'away', 'S', '=');
    assert.deepEqual(state.score, { home: 2, away: 2 });
    assert.equal(state.servingTeam, 'home');
    assert.deepEqual(state.lineups.home, [2, 3, 4, 5, 6, 1]);
    assert.equal(state.context.serverPlayerId, 2);
});

test('play-on statistics do not rotate or award a point; undo restores serve and rotation', () => {
    const match = fixture(), actions = [];
    record(match, actions, 'home', 'S', '#');
    const before = record(match, actions, 'away', 'R', '+');
    assert.deepEqual(before.score, { home: 1, away: 0 });
    assert.equal(before.context.serverPlayerId, 1);
    const after = record(match, actions, 'away', 'B', '#');
    assert.notEqual(after.context.key, before.context.key);
    actions.pop(); // Controller Undo deletes the latest VIS_STAT row.
    const undone = projectOfficialState(match, actions).state;
    assert.deepEqual(undone.score, before.score);
    assert.deepEqual(undone.lineups, before.lineups);
    assert.equal(undone.servingTeam, before.servingTeam);
    assert.equal(undone.context.serverPlayerId, before.context.serverPlayerId);
});

test('substitutions are replayed between points and rotate with the team', () => {
    const match = fixture(), actions = [];
    record(match, actions, 'home', 'S', '#');
    match.vis_state.controls.push({ id: 'sub-1', set_id: 1, team: 'away', skill: 'SUBSTITUTION',
        afterEventId: 1, details: { playerOut: 12, playerIn: 17, slot: 1 } });
    const state = record(match, actions, 'away', 'B', '#');
    assert.deepEqual(state.lineups.away, [17, 13, 14, 15, 16, 11]);
    assert.equal(state.context.serverPlayerId, 17);
    assert.equal(state.substitutions.away, 1);
    assert.deepEqual(lineups.away, [11, 12, 13, 14, 15, 16]);
});

test('a new set resets rotation and uses the next set first server', () => {
    const match = fixture();
    const actions = [{ id: 1, action_type: 'VIS_STAT', set_number: 1, team_id: 10,
        skill: 'A', grade: '#', details: { visContext: { scoreAfter: { home: 25, away: 20 } } } }];
    match.vis_state.setups = { 1: { lineups, servingTeam: 'home', firstSetHomeLeft: true },
        2: { lineups, servingTeam: 'away', firstSetHomeLeft: false } };
    const state = projectOfficialState(match, actions).state;
    assert.equal(state.currentSet, 2);
    assert.deepEqual(state.score, { home: 0, away: 0 });
    assert.equal(state.servingTeam, 'away');
    assert.equal(state.context.serverPlayerId, 11);
    assert.deepEqual(state.lineups, lineups);
});
