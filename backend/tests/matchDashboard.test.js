const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, commandPayload, view } = require('../utils/customVis');
const { dashboardMatch, attachDashboardSummaries } = require('../utils/matchDashboard');
function fixture() {
    let payload = createPayload({ title: 'Dashboard', maxSets: 3,
        home: { name: 'H', players: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: 'H', last_name: String(i) })) },
        away: { name: 'A', players: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: 'A', last_name: String(i) })) },
    }, 'custom-dashboard');
    let index = 0;
    const send = command => { payload = commandPayload(payload, { operationId: `dashboard-operation-${++index}`, revision: payload.revision, command: { ...command, context: { key: view(payload).state.context.key } } }).payload; };
    const summary = () => dashboardMatch({ ...payload.match, id: 99, status: 'scheduled', home_set_score: 0, away_set_score: 0,
        vis_state: JSON.stringify({ ...payload.match.vis_state, offlineVis: { secret: 'private-offline-payload' } }), live_state: JSON.stringify({ score: { home: 8, away: 4 }, matchData: { currentSet: 1 } }) }, payload.actions);
    const lineup = () => send({ type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true });
    return { send, summary, lineup };
}
test('VIS recording state and points change independently of official results', () => {
    const f = fixture(); assert.equal(f.summary().vis_summary.status, 'idle');
    f.lineup(); assert.equal(f.summary().vis_summary.status, 'ready');
    f.send({ type: 'RALLY', events: [{ team: 'home', player: 1, skill: 'S', grade: '#' }] });
    const row = f.summary();
    assert.equal(row.vis_summary.status, 'recording'); assert.deepEqual(row.vis_summary.score, { home: 1, away: 0 });
    assert.equal(row.status, 'scheduled'); assert.deepEqual(row.official_summary.score, { home: 8, away: 4 });
    assert.deepEqual(row.official_summary.setsWon, { home: 0, away: 0 });
    assert.equal(JSON.stringify(row).includes('private-offline-payload'), false);
    assert.equal('live_state' in row, false); assert.equal('vis_state' in row, false);
    f.send({ type: 'UNDO' }); assert.equal(f.summary().vis_summary.score.home, 0);
});
test('VIS completed sets and review state never finish or change the official match', () => {
    const f = fixture();
    for (let set = 1; set <= 2; set++) {
        f.lineup();
        for (let point = 0; point < 25; point++) f.send({ type: 'RALLY', events: [{ team: 'home', player: null, skill: 'OP', grade: '#' }] });
        assert.equal(f.summary().vis_summary.setsWon.home, set);
    }
    assert.equal(f.summary().vis_summary.status, 'review'); assert.equal(f.summary().status, 'scheduled');
    assert.equal(f.summary().official_summary.setsWon.home, 0);
});
test('dashboard batches histories and keeps records isolated by match ID', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: i + 1, max_sets: 3, status: 'scheduled', home_team_id: 1, away_team_id: 2 }));
    const queries = [];
    const result = await attachDashboardSummaries({ query: async (sql, ids) => { queries.push(ids); assert.ok(sql.includes("action_type='VIS_STAT'")); return { rows: [] }; } }, rows);
    assert.equal(queries.length, 2); assert.equal(result.length, 501);
    assert.equal(result[0].vis_summary.status, 'idle'); assert.equal(result[500].id, 501);
    assert.equal(result[0].official_summary.score, null);
});
