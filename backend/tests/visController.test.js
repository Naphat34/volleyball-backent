const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const workflow = require('../utils/visWorkflow');
const source = fs.readFileSync(require.resolve('../controllers/visController'), 'utf8');
function harness({ failure, revision = 0, foreignPlayer = false, undo = false, missingAction = false } = {}) {
    const match = { id: 1, home_team_id: 10, away_team_id: 20, status: 'live', team_a_score: 8, team_b_score: 4,
        live_state: JSON.stringify({ scoringSource: 'escore', workflowStep: 'RALLY', matchData: { currentSet: 1 }, score: { home: 8, away: 4 },
            homeLineup: [1, 2, 3, 4, 5, 6], awayLineup: [11, 12, 13, 14, 15, 16] }),
        vis_state: JSON.stringify({ revision, history: undo ? [{ eventId: 42 }] : [], operations: [] }) };
    const events = undo ? [{ id: 43, skill: 'POINT' }] : [];
    const actions = undo && !missingAction ? [{ id: 42, action_type: 'VIS_STAT', skill: 'A', description: JSON.stringify({ vis: true }) }] : [];
    const calls = [], emissions = [];
    const connection = { beginTransaction: async () => calls.push('begin'), commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback'), release: () => calls.push('release'),
        query: async (sql, params) => {
            calls.push({ sql, params });
            if (sql.startsWith('SELECT m.*')) return { rows: [match] };
            if (sql.startsWith('SELECT * FROM match_sets') || sql.startsWith('SELECT * FROM match_lineups')) return { rows: [] };
            if (sql.startsWith('SELECT * FROM match_events')) return { rows: events };
            if (sql.startsWith('SELECT * FROM match_actions WHERE id')) return { rows: actions.filter(action => action.id === params[0]) };
            if (sql.startsWith('SELECT * FROM match_actions')) return { rows: actions };
            if (sql.startsWith('SELECT id FROM players')) return { rows: foreignPlayer ? [] : [{ id: 1 }] };
            if (sql.startsWith('SELECT COALESCE((')) return { rows: [{ jersey_number: 21 }] };
            if (sql.startsWith('INSERT INTO match_actions')) { if (failure) throw new Error('INSERT failed'); return { insertId: 42 }; }
            if (sql.startsWith('DELETE FROM match_actions')) return { affectedRows: 1 };
            if (sql === 'UPDATE matches SET vis_state = ? WHERE id = ?') { match.vis_state = params[0]; return { affectedRows: 1 }; }
            throw new Error(`Forbidden or unexpected query: ${sql}`);
        } };
    const context = { exports: {}, console: { error() {} }, require: name => {
        if (name === '../config/db') return { connect: async () => connection };
        if (name === '../utils/visWorkflow') return workflow;
        if (name === '../utils/visEventCode') return require('../utils/visEventCode');
        throw new Error(name);
    } };
    vm.runInNewContext(source, context);
    const state = workflow.projectOfficialState(match, [], [], events).state;
    const body = { operationId: 'vis-operation-123456', revision: 0, command: undo ? { type: 'UNDO' } : { type: 'STAT', team: 'home', player: 1, skill: 'S', grade: '#', context: { key: state.context.key } } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
    return { match, events, actions, calls, emissions, body, res, run: () => context.exports.command({ body, params: { matchId: 1 }, app: { get: () => ({ to: () => ({ emit: name => emissions.push(name) }) }) } }, res) };
}
test('S21# persists statistics at official 8-4 and never updates any official field or scorer socket', async () => {
    const h = harness(), official = h.match.live_state;
    await h.run();
    assert.equal(h.res.code, 200);
    assert.deepEqual(h.res.body.state.score, { home: 8, away: 4 });
    assert.equal(h.res.body.event.event_code, 'S21#');
    const inserted = h.calls.find(call => call.sql?.startsWith('INSERT INTO match_actions'));
    assert.deepEqual(Array.from(inserted.params.slice(6, 8)), [8, 4]);
    assert.equal(JSON.parse(inserted.params[8]).scoringSource, 'vis-statistics');
    assert.equal(h.match.live_state, official);
    assert.equal(h.match.team_a_score, 8);
    assert.deepEqual(h.emissions, ['vis_statistics_updated']);
    assert.ok(h.calls.includes('commit'));
    assert.ok(h.calls.filter(call => call.sql?.startsWith('UPDATE')).every(call => call.sql === 'UPDATE matches SET vis_state = ? WHERE id = ?'));
});
test('retry is idempotent even after an official score change', async () => {
    const h = harness(); await h.run();
    h.match.live_state = JSON.stringify({ ...JSON.parse(h.match.live_state), score: { home: 9, away: 4 } });
    await h.run();
    assert.equal(h.res.body.duplicate, true);
    assert.equal(h.res.body.state.score.home, 9);
    assert.equal(h.calls.filter(call => call.sql?.startsWith('INSERT')).length, 1);
});
test('Undo deletes only its VIS action despite a newer official point; cannot delete scorer points', async () => {
    const h = harness({ undo: true }); await h.run();
    assert.equal(h.res.code, 200);
    assert.equal(h.res.body.deletedEventId, 42);
    assert.equal(h.res.body.state.score.home, 8);
    assert.equal(h.res.body.state.phase, 'PLAYING');
    const invalid = harness({ undo: true, missingAction: true }); await invalid.run();
    assert.equal(invalid.res.code, 409);
    assert.ok(!invalid.calls.some(call => call.sql?.startsWith('DELETE')));
});
test('stale scoring context, stale VIS revision and foreign players fail before writing', async () => {
    for (const options of [{ revision: 1 }, { foreignPlayer: true }, { stale: true }]) {
        const h = harness(options);
        if (options.stale) h.body.command.context.key = 'outdated';
        await h.run();
        assert.equal(h.res.code, options.foreignPlayer ? 400 : 409);
        assert.ok(!h.calls.some(call => /^(INSERT|UPDATE|DELETE)/.test(call.sql || '')));
        assert.ok(h.calls.includes('rollback'));
    }
});
test('failed insertion rolls back statistics and never commits', async () => {
    const h = harness({ failure: true }); await h.run();
    assert.equal(h.res.code, 500);
    assert.ok(h.calls.includes('rollback'));
    assert.ok(!h.calls.includes('commit'));
    assert.ok(!h.calls.some(call => call.sql?.startsWith('UPDATE')));
});
test('old official match-control requests to VIS are rejected on the server', async () => {
    for (const type of ['START', 'NEXT_SET', 'LINEUP', 'TIMEOUT', 'SANCTION', 'SUBSTITUTION']) {
        const h = harness(); h.body.command = { type }; await h.run();
        assert.equal(h.res.code, 400);
        assert.ok(!h.calls.some(call => /^(INSERT|UPDATE|DELETE)/.test(call.sql || '')));
    }
});
