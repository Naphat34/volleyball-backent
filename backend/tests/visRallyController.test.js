const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const workflow = require('../utils/visWorkflow');

function harness() {
    const match = { id: 1, status: 'live', home_team_id: 10, away_team_id: 20,
        live_state: { score: { home: 8, away: 9 } },
        vis_state: { lineups: { home: [1,2,3,4,5,6], away: [11,12,13,14,15,16] }, servingTeam: 'home', firstSetHomeLeft: true } };
    let rows = [], backup = [], nextId = 1, badPlayer = null;
    const connection = { beginTransaction: async () => { backup = structuredClone(rows); },
        commit: async () => {}, rollback: async () => { rows = backup; }, release() {},
        query: async (sql, p) => {
            if (sql.startsWith('SELECT m.*')) return { rows: [match] };
            if (sql.startsWith('UPDATE matches SET vis_state')) { match.vis_state = JSON.parse(p[0]); return {}; }
            if (sql.startsWith('SELECT id FROM players')) return { rows: p[0] === badPlayer ? [] : [{ id: p[0] }] };
            if (sql.trim().startsWith('SELECT * FROM match_actions')) {
                if (sql.includes('WHERE id =')) return { rows: rows.filter(row => row.id === p[0]) };
                if (sql.includes('operation_id =')) return { rows: rows.filter(row => row.operation_id === p[1]) };
                return { rows: [...rows] };
            }
            if (sql.startsWith('INSERT INTO match_actions')) {
                const id = nextId++;
                rows.push({ id, match_id: p[0], set_number: p[1], action_type: 'VIS_STAT', team_id: p[2], player_id: p[3],
                    skill: p[4], grade: p[5], score_home: p[6], score_away: p[7], description: p[8], details: p[9], operation_id: p[10] });
                return { insertId: id };
            }
            if (sql.startsWith('DELETE FROM match_actions') && sql.includes('operation_id =')) { rows = rows.filter(row => row.operation_id !== p[1]); return {}; }
            throw Error(sql);
        } };
    const sandbox = { exports: {}, console: { error() {} }, require: name => {
        if (name === '../utils/sqlDialect') return require('../utils/sqlDialect');
        if (name === '../config/db') return { connect: async () => connection };
        if (name === '../utils/manualVisAccess') return require('../utils/manualVisAccess');
        if (name === '../utils/visWorkflow') return workflow;
        if (name === '../utils/visEventCode') return { ...require('../utils/visEventCode'), getVisJerseyNumber: async (connection, match, team, player) => player };
        throw Error(name);
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/visController'), 'utf8'), sandbox);
    return { match, rows: () => rows, failPlayer: player => { badPlayer = player; },
        send: async (command, operationId = 'rally-operation-123456', timing, user) => {
            const state = workflow.projectOfficialState(match, rows).state;
            const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
            await sandbox.exports.command({ user, params: { matchId: 1 }, body: { operationId, timing, revision: state.revision,
                command: { ...command, context: { key: state.context.key } } }, app: { get: () => null } }, res);
            return res;
        } };
}
const events = [{ team: 'home', player: 1, skill: 'S', grade: '' },
    { team: 'away', player: 12, skill: 'A', grade: '#' }, { team: 'home', player: null, skill: 'T', grade: '=' }];

test('assigned statistician records a scorer-created rally without changing official scoring', async () => {
    const h = harness();
    Object.assign(h.match, { manual_owner_id: 7, manual_vis_shared: 1, manual_lifecycle: 'ready', manual_vis_assignee_id: 9 });
    const official = h.match.live_state;
    const result = await h.send({ type: 'RALLY', events }, 'manual-rally-operation', undefined, { id: 9, role: 'statistician' });
    assert.equal(result.code, 200);
    assert.equal(h.rows().length, 3);
    assert.equal(h.match.live_state, official);
});

test('revocation, another assignee, and match-rule changes reject before saving statistics', async () => {
    for (const scenario of ['revoked', 'other', 'rules']) {
        const h = harness();
        Object.assign(h.match, { manual_owner_id: 7, manual_vis_shared: scenario === 'revoked' ? 0 : 1,
            manual_lifecycle: 'ready', manual_vis_assignee_id: scenario === 'other' ? 10 : 9 });
        const result = await h.send(scenario === 'rules' ? { type: 'CONFIGURE_SETTINGS' } : { type: 'RALLY', events },
            'rejected-manual-rally', undefined, { id: 9, role: 'statistician' });
        assert.equal(result.code, scenario === 'other' ? 409 : 403);
        assert.equal(h.rows().length, 0);
    }
});

test('official VIS keeps original device timing across the saved rally and refreshed projection', async () => {
    const h = harness();
    const timing = { setNumber: 1, recordedAt: '2026-11-03T01:01:00.000Z', setStartedAt: '2026-11-03T01:00:00.000Z' };
    const saved = await h.send({ type: 'RALLY', events }, 'timed-rally-operation', timing);
    assert.equal(saved.code, 200);
    assert.equal(JSON.parse(h.rows()[0].details).visTiming.recordedAt, timing.recordedAt);
    assert.equal(saved.body.state.timing.sets[0].startedAt, timing.setStartedAt);
});
test('controller saves a rally atomically, retries idempotently and undoes every event together', async () => {
    const h = harness(), official = JSON.stringify(h.match.live_state);
    const saved = await h.send({ type: 'RALLY', events });
    assert.equal(saved.code, 200);
    assert.equal(h.rows().length, 3);
    assert.deepEqual(saved.body.state.score, { home: 0, away: 1 });
    assert.equal(saved.body.state.context.serverPlayerId, 12);
    assert.equal((await h.send({ type: 'RALLY', events })).body.duplicate, true);
    assert.equal(h.rows().length, 3);
    const undone = await h.send({ type: 'UNDO' }, 'undo-operation-1234567');
    assert.equal(undone.code, 200);
    assert.equal(undone.body.deletedEventIds.length, 3);
    assert.equal(h.rows().length, 0);
    assert.deepEqual(undone.body.state.score, { home: 0, away: 0 });
    assert.equal(undone.body.state.context.serverPlayerId, 1);
    assert.equal((await h.send({ type: 'UNDO' }, 'undo-operation-1234567')).body.duplicate, true);
    assert.equal(JSON.stringify(h.match.live_state), official);
});
test('a validation failure after an earlier insert rolls back the entire rally', async () => {
    const h = harness(); h.failPlayer(12);
    assert.equal((await h.send({ type: 'RALLY', events })).code, 400);
    assert.equal(h.rows().length, 0);
});
