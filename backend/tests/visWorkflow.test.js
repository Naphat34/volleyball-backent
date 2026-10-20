const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectOfficialState, resolveContext, applyCommand } = require('../utils/visWorkflow');
const lineup = { home: [1, 2, 3, 4, 5, 6], away: [11, 12, 13, 14, 15, 16] };
function fixture(overrides = {}) {
    return { id: 1, home_team_id: 10, away_team_id: 20, left_side_team_id: 10, status: 'live', team_a_score: 8, team_b_score: 4,
        live_state: { scoringSource: 'escore', workflowStep: 'RALLY', matchData: { currentSet: 1 }, score: { home: 8, away: 4 },
            homeLineup: lineup.home, awayLineup: lineup.away, servingTeam: 'home', isHomeLeft: true }, ...overrides };
}
test('every VIS skill/grade preserves all official state, including a set-winning statistic', () => {
    const { state } = projectOfficialState(fixture(), [], [], []);
    state.score = { home: 24, away: 1 };
    for (const skill of ['A', 'S', 'B', 'R', 'D', 'E']) for (const grade of ['#', '+', '!', '-', '=']) {
        const result = applyCommand(state, { type: 'STAT', team: 'home', player: 1, skill, grade, officialContext: state.context });
        assert.deepEqual(result.state, state, `${skill}${grade}`);
        assert.equal(result.event.grade, grade);
        assert.equal(result.event.details.officialContext.setNumber, 1);
    }
});
test('VIS rejects every official match-control command', () => {
    const { state } = projectOfficialState(fixture(), [], [], []);
    for (const type of ['START', 'LINEUP', 'NEXT_SET', 'TIMEOUT', 'SUBSTITUTION', 'SANCTION', 'POINT']) {
        assert.throws(() => applyCommand(state, { type }), /eScoreControl/);
    }
});
test('Undo removes only the statistics history, never a score, lineup or finished status', () => {
    const { state } = projectOfficialState(fixture({ status: 'completed', vis_state: { revision: 4, history: [{ eventId: 42 }] } }), [], [], []);
    const result = applyCommand(state, { type: 'UNDO' });
    assert.equal(result.undo.eventId, 42);
    assert.equal(result.state.phase, 'MATCH_FINISHED');
    assert.deepEqual(result.state.score, state.score);
    assert.deepEqual(result.state.lineups, state.lineups);
    assert.equal(result.state.history.length, 0);
    assert.equal(state.history.length, 1);
});
test('an official score/lineup change invalidates the current context; timer ticks do not', () => {
    const match = fixture();
    const { state } = projectOfficialState(match, [], [], []);
    match.live_state.updatedAt = 12345;
    assert.equal(projectOfficialState(match, [], [], []).state.context.key, state.context.key);
    match.live_state.score.home = 9;
    const newer = projectOfficialState(match, [], [], []).state;
    assert.throws(() => resolveContext(newer, [], { key: state.context.key }), /changed/);
    assert.equal(resolveContext(newer, [], { key: newer.context.key }).score.home, 9);
    match.live_state.homeLineup[0] = 7;
    assert.notEqual(projectOfficialState(match, [], [], []).state.context.key, newer.context.key);
});
test('historical official rallies use their saved lineup and never trust supplied scores', () => {
    const events = [{ id: 8, skill: 'POINT', set_id: 1, score_home: 7, score_away: 4, details: { lineups: lineup } }];
    const { state, rallies } = projectOfficialState(fixture(), [], [], events);
    const context = resolveContext(state, rallies, { pointEventId: 8, score: { home: 99 } });
    assert.deepEqual(context.score, { home: 7, away: 4 });
    assert.throws(() => resolveContext(state, rallies, { pointEventId: 999 }), /unavailable/);
    assert.throws(() => applyCommand(state, { type: 'STAT', skill: 'S', grade: '#', team: 'home', player: 99, officialContext: context }), /on court/);
});
test('VIS can record before eScoreControl starts, without taking ownership of official scores', () => {
    const { state } = projectOfficialState(fixture({ live_state: { vis: { score: { home: 99 }, history: [{ eventId: 1 }] }, workflowStep: 'SERVING' } }), [], [], []);
    assert.equal(state.officialReady, true);
    assert.equal(state.phase, 'WAITING');
    assert.equal(state.score.home, 8);
    assert.equal(state.history.length, 0);
    const saved = applyCommand(state, { type: 'STAT', team: 'home', player: 1, skill: 'S', grade: '#', officialContext: state.context });
    assert.equal(saved.event.skill, 'S');
    assert.deepEqual(saved.event.details.officialContext.score, { home: 8, away: 4 });
});
test('official Undo invalidates removed rally references without rewriting VIS statistics', () => {
    const match = fixture();
    match.live_state.officialRallyRefs = ['point-8'];
    const events = [8, 9].map(id => ({ id, skill: 'POINT', set_id: 1, score_home: id - 1, score_away: 4, details: { local_event_id: `point-${id}`, lineups: lineup } }));
    const { state, rallies } = projectOfficialState(match, [], [], events);
    assert.deepEqual(rallies.map(rally => rally.pointEventId), [8]);
    assert.throws(() => resolveContext(state, rallies, { pointEventId: 9 }), /unavailable/);
});
