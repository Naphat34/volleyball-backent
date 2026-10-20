const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const workflow = require('../utils/visWorkflow');
function harness() {
    const match = { id: 84, status: 'scheduled', home_team_id: 1, away_team_id: 2, live_state: '{"score":{"home":8,"away":4}}' };
    const writes = [], actions = [];
    const connection = { beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
        query: async (sql, params) => {
            if (sql.startsWith('SELECT m.*')) return { rows: [match] };
            if (sql.startsWith('SELECT * FROM match_actions')) return { rows: actions };
            if (sql.startsWith('SELECT id FROM players')) return { rows: params[0] <= 8 && params[1] === 1 || params[0] >= 11 && params[0] <= 16 && params[1] === 2 ? [{ id: params[0] }] : [] };
            if (sql.startsWith('UPDATE matches SET vis_state')) { writes.push(sql); match.vis_state = params[0]; return {}; }
            throw Error(sql);
        } };
    const context = { exports: {}, console: { error() {} }, require: name => {
        if (name === '../config/db') return { connect: async () => connection };
        if (name === '../utils/visWorkflow') return workflow;
        if (name === '../utils/visEventCode') return { ...require('../utils/visEventCode'), getVisJerseyNumber: async () => 0 };
        throw Error(name);
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/visController'), 'utf8'), context);
    const body = { operationId: 'lineup-operation-123456', revision: 0, command: { type: 'SET_LINEUP', servingTeam: 'away', firstSetHomeLeft: false, lineups: { home: [1,2,3,4,5,6], away: [11,12,13,14,15,16] } } };
    return { match, writes, body, actions, run: async () => {
        const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
        await context.exports.command({ params: { matchId: 84 }, body, app: { get: () => null } }, res);
        return res;
    } };
}

test('a substitute returns to the original starter after their court slot has rotated', async () => {
    const h = harness();
    assert.equal((await h.run()).code, 200);
    const sendSub = async (playerOut, playerIn, operationId) => {
        h.body.operationId = operationId;
        h.body.revision = workflow.projectOfficialState(h.match, h.actions).state.revision;
        h.body.command = { type: 'SUBSTITUTION', team: 'home', playerOut, playerIn };
        return h.run();
    };
    assert.equal((await sendSub(2, 7, 'rotation-sub-operation-1')).code, 200);
    const before = workflow.projectOfficialState(h.match, h.actions).state;
    const result = workflow.applyCommand(before, { type: 'STAT', team: 'home', player: 1,
        skill: 'A', grade: '#', officialContext: before.context });
    h.actions.push({ id: 1, action_type: 'VIS_STAT', set_number: 1, team_id: 1,
        skill: 'A', grade: '#', details: result.event.details });
    assert.equal(workflow.projectOfficialState(h.match, h.actions).state.lineups.home[0], 7);
    const returned = await sendSub(7, 2, 'rotation-sub-operation-2');
    assert.equal(returned.code, 200);
    assert.equal(returned.body.state.lineups.home[0], 2);
    assert.equal((await sendSub(2, 7, 'rotation-sub-operation-3')).code, 400);
});
test('VIS lineup saves, survives reload, retries once, and enables on-court statistics without changing official state', async () => {
    const h = harness(), official = h.match.live_state;
    const saved = await h.run();
    assert.equal(saved.code, 200);
    assert.deepEqual(saved.body.state.lineups.home, [1,2,3,4,5,6]);
    const reloaded = workflow.projectOfficialState(h.match).state;
    assert.deepEqual(reloaded.lineups.away, [11,12,13,14,15,16]);
    assert.equal(reloaded.revision, 1);
    assert.equal(reloaded.servingTeam, 'away');
    assert.equal(reloaded.isHomeLeft, false);
    assert.equal(reloaded.firstSetHomeLeft, false);
    assert.equal(reloaded.context.serverPlayerId, 11);
    assert.equal(reloaded.setupComplete, true);
    assert.equal(h.match.live_state, official);
    assert.equal((await h.run()).body.duplicate, true);
    assert.equal(h.writes.length, 1);
    const command = { type: 'STAT', team: 'home', player: 1, skill: 'S', grade: '#', officialContext: reloaded.context };
    assert.equal(workflow.applyCommand(reloaded, command).event.player, 1);
    assert.throws(() => workflow.applyCommand(reloaded, { ...command, player: 7 }), /on court/);
});
test('VIS rejects incomplete, duplicate, foreign, stale and finished lineup writes', async () => {
    for (const kind of ['incomplete','duplicate','foreign','stale','finished','serve','side']) {
        const h = harness();
        if (kind === 'incomplete') h.body.command.lineups.home.pop();
        if (kind === 'duplicate') h.body.command.lineups.home[0] = 2;
        if (kind === 'foreign') h.body.command.lineups.home[0] = 11;
        if (kind === 'serve') delete h.body.command.servingTeam;
        if (kind === 'side') delete h.body.command.firstSetHomeLeft;
        if (kind === 'stale') h.body.revision = 1;
        if (kind === 'finished') h.match.status = 'completed';
        assert.equal((await h.run()).code, ['stale','finished'].includes(kind) ? 409 : 400, kind);
        assert.equal(h.writes.length, 0);
    }
});

function setFixture(maxSets, results) {
    const lineups = { home: [1,2,3,4,5,6], away: [11,12,13,14,15,16] };
    const setup = { lineups, servingTeam: 'home', firstSetHomeLeft: true };
    const match = { max_sets: maxSets, home_team_id: 1, vis_state: { ...setup, setups: { 1: setup } } };
    const actions = results.map((score, index) => ({ id: index + 1, action_type: 'VIS_STAT', set_number: index + 1,
        team_id: 1, details: { visContext: { scoreAfter: score } } }));
    return { match, actions, lineups };
}
test('set end opens fresh lineup, alternates first serve and side, and survives reload', () => {
    const f = setFixture(5, [{ home: 25, away: 23 }]);
    let state = workflow.projectOfficialState(f.match, f.actions).state;
    assert.equal(state.currentSet, 2);
    assert.equal(state.setupComplete, false);
    assert.equal(state.requiresToss, false);
    assert.equal(state.servingTeam, 'away');
    assert.equal(state.isHomeLeft, false);
    assert.deepEqual(state.score, { home: 0, away: 0 });
    assert.deepEqual(state.setsWon, { home: 1, away: 0 });
    f.match.vis_state.setups[2] = { lineups: f.lineups, servingTeam: 'away', firstSetHomeLeft: false };
    state = workflow.projectOfficialState(f.match, f.actions).state;
    assert.equal(state.setupComplete, true);
    assert.equal(state.context.setNumber, 2);
    const third = setFixture(5, [{ home: 25, away: 10 }, { home: 10, away: 25 }]);
    state = workflow.projectOfficialState(third.match, third.actions).state;
    assert.equal(state.currentSet, 3);
    assert.equal(state.servingTeam, 'home');
    assert.equal(state.isHomeLeft, true);
});
test('deuce stays in the set; deciding set requires new toss; match end does not open another set', () => {
    let f = setFixture(5, [{ home: 25, away: 24 }]);
    assert.equal(workflow.projectOfficialState(f.match, f.actions).state.currentSet, 1);
    for (const max of [3, 5]) {
        const scores = Array.from({ length: max - 1 }, (_, i) => i % 2 ? { home: 10, away: 25 } : { home: 25, away: 10 });
        f = setFixture(max, scores);
        let state = workflow.projectOfficialState(f.match, f.actions).state;
        assert.equal(state.currentSet, max);
        assert.equal(state.requiresToss, true);
        assert.equal(state.servingTeam, null);
        assert.equal(state.setupComplete, false);
        f.actions.push({ id: max, action_type: 'VIS_STAT', set_number: max, details: { visContext: { scoreAfter: { home: 15, away: 13 } } } });
        state = workflow.projectOfficialState(f.match, f.actions).state;
        assert.equal(state.phase, 'MATCH_FINISHED');
        assert.equal(state.currentSet, max);
        f.actions.pop();
        assert.equal(workflow.projectOfficialState(f.match, f.actions).state.phase, 'PLAYING');
    }
});

test('next-set lineup saves without toss and ignores supplied serving/side overrides', async () => {
    const h = harness();
    assert.equal((await h.run()).code, 200);
    h.actions.push({ id: 1, action_type: 'VIS_STAT', set_number: 1, details: { visContext: { scoreAfter: { home: 25, away: 10 } } } });
    h.body.operationId = 'next-set-lineup-operation-123';
    h.body.revision = 2;
    delete h.body.command.servingTeam;
    delete h.body.command.firstSetHomeLeft;
    const saved = await h.run();
    assert.equal(saved.code, 200);
    assert.equal(saved.body.state.currentSet, 2);
    assert.equal(saved.body.state.setupComplete, true);
    assert.equal(saved.body.state.servingTeam, 'home');
    assert.equal(saved.body.state.isHomeLeft, true);
    const stored = JSON.parse(h.match.vis_state);
    assert.equal(stored.setups[1].servingTeam, 'away');
    assert.equal(stored.setups[2].servingTeam, 'home');
});

test('timeouts persist, enforce limit, retry idempotently, Undo and reset for next set', async () => {
    const h = harness(); await h.run();
    h.body.command = { type: 'TIMEOUT', team: 'home' };
    h.body.operationId = 'timeout-operation-0001'; h.body.revision = 1;
    let result = await h.run();
    assert.equal(result.code, 200);
    assert.equal(result.body.state.timeouts.home, 1);
    assert.equal((await h.run()).body.duplicate, true);
    h.body.operationId = 'timeout-operation-0002'; h.body.revision = 2;
    result = await h.run();
    assert.equal(result.body.state.timeouts.home, 2);
    h.body.operationId = 'timeout-operation-0003'; h.body.revision = 3;
    assert.equal((await h.run()).code, 400);
    h.body.command = { type: 'UNDO' };
    result = await h.run();
    assert.equal(result.code, 200);
    assert.equal(result.body.state.timeouts.home, 1);
    assert.ok(result.body.deletedEventId.startsWith('control-'));
    h.actions.push({ id: 1, action_type: 'VIS_STAT', set_number: 1, details: { visContext: { scoreAfter: { home: 25, away: 10 } } } });
    assert.equal(workflow.projectOfficialState(h.match, h.actions).state.timeouts.home, 0);
});
test('substitution persists lineup, rejects invalid pairs, and Undo restores the court and count', async () => {
    const h = harness(); await h.run();
    h.body.command = { type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 7 };
    h.body.operationId = 'substitution-operation-0001'; h.body.revision = 1;
    let result = await h.run();
    assert.equal(result.code, 200);
    assert.equal(result.body.state.lineups.home[0], 7);
    assert.equal(result.body.state.substitutions.home, 1);
    assert.equal(workflow.projectOfficialState(h.match).state.lineups.home[0], 7);
    assert.equal((await h.run()).body.duplicate, true);
    h.body.operationId = 'substitution-operation-0002'; h.body.revision = 2;
    h.body.command = { type: 'SUBSTITUTION', team: 'home', playerOut: 7, playerIn: 8 };
    assert.equal((await h.run()).code, 400);
    h.body.command = { type: 'UNDO' };
    result = await h.run();
    assert.equal(result.code, 200);
    assert.equal(result.body.state.lineups.home[0], 1);
    assert.equal(result.body.state.substitutions.home, 0);
});
