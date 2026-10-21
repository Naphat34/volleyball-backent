const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { commandPayload, view } = require('../utils/customVis');
const { projectOfficialState } = require('../utils/visWorkflow');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
    let data = { match: { id: 1, home_team_id: 21, away_team_id: 42, max_sets: 3, competition_id: 3, status: 'scheduled', team_a_score: 8, team_b_score: 4, vis_state: {} }, actions: [], sequence: 200 };
    const players = team => Array.from({ length: 7 }, (_, n) => ({ id: team * 100 + n + 1, number: n + 1, team_id: team, first_name: 'Player', last_name: String(n), position: '' }));
    const roster = { home: { players: players(21) }, away: { players: players(42) } };
    let saved, failUpdate = false, scorerLease = null;
    const connection = {
        beginTransaction: async () => { saved = clone(data); }, commit: async () => {}, rollback: async () => { data = saved; }, release() {},
        async query(sql, args = []) {
            if (/SELECT .*FROM matches\b/s.test(sql)) return { rows: [clone(data.match)] };
            if (sql.includes('FROM scorer_offline_sessions')) return { rows: scorerLease ? [scorerLease] : [] };
            if (sql.includes('AS jersey_number')) return { rows: [{ jersey_number: args.at(-2) % 100 }] };
            if (sql.includes('FROM players')) return { rows: [...roster.home.players, ...roster.away.players].filter(p => p.id === args[0] && p.team_id === args[1]) };
            if (sql.includes('SELECT') && sql.includes('FROM match_actions')) {
                let rows = data.actions;
                if (sql.includes('operation_id = ?')) rows = rows.filter(a => a.operation_id === args[1]);
                else if (sql.includes('WHERE id = ?')) rows = rows.filter(a => a.id === args[0]);
                return { rows: clone(rows) };
            }
            if (/UPDATE matches SET vis_state\s*=/.test(sql)) {
                if (failUpdate) throw Error('simulated write failure');
                data.match.vis_state = JSON.parse(args[0]); return { rows: [] };
            }
            if (sql.includes('INSERT INTO match_actions')) {
                const [match_id, set_number, team_id, player_id, skill, grade, score_home, score_away, description, details, operation_id] = args;
                const id = ++data.sequence;
                data.actions.push({ id, match_id, set_number, action_type: 'VIS_STAT', team_id, player_id, skill, grade, score_home, score_away, description, details: JSON.parse(details), operation_id });
                return { insertId: id };
            }
            if (sql.includes('DELETE FROM match_actions')) {
                data.actions = data.actions.filter(a => sql.includes('operation_id') ? a.operation_id !== args[1] : a.id !== args[0]); return { rows: [] };
            }
            throw Error(`Unexpected SQL: ${sql}`);
        },
    };
    const fakeScorer = {
        scopedController: () => ({
            getMatchRosterData: async (_req, res) => res.json(clone(roster)),
            getMatchDetails: async (_req, res) => res.json({ ...clone(data.match), home_team_name: 'School H', away_team_name: 'School A', competition_name: 'School cup', max_sets: 3 }),
        }),
        async call(controller, method, req, body) {
            const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.data = value; } };
            await controller[method]({ ...req, body, app: { get: () => null } }, res);
            if (res.code >= 400) { const error = Error(res.data.error); error.status = res.code; throw error; }
            return res.data;
        },
    };
    const file = require.resolve('../controllers/officialVisOfflineController');
    const localRequire = createRequire(file);
    const scope = { exports: {}, console, require: name => name === '../config/db' ? { connect: async () => connection } : name === './scorerOfflineController' ? fakeScorer : localRequire(name) };
    scope.require.resolve = localRequire.resolve;
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope, { filename: file });
    const invoke = async (method, body = {}, user = 7) => {
        const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.data = value; } };
        await scope.exports[method]({ params: { matchId: 1 }, user: { id: user }, body: { deviceId: 'official-vis-device-001', ...body }, app: { get: () => null } }, res);
        return clone(res);
    };
    return { invoke, roster, data: () => data, failUpdate: value => { failUpdate = value; }, scorerLease: value => { scorerLease = value; }, assertOnline: () => scope.exports.assertOnline(connection, 1) };
}
const lineup = { type: 'SET_LINEUP', lineups: { home: [2101,2102,2103,2104,2105,2106], away: [4201,4202,4203,4204,4205,4206] }, servingTeam: 'home', firstSetHomeLeft: true };
function journal(payload, commands) {
    const operations = [], baseRevision = payload.revision, offlineSession = payload.offlineSession;
    for (const command of commands) {
        const operation = { operationId: require('node:crypto').randomUUID(), revision: payload.revision, command: { ...command, context: { key: view(payload).state.context.key } } };
        payload = commandPayload(payload, operation).payload; operations.push(operation);
    }
    return { operations, baseRevision, offlineSession };
}
test('Admin VIS: checkout keeps original identities; sync/retry/release updates the same match without changing eScore', async () => {
    const f = fixture(), checkout = await f.invoke('checkout');
    assert.equal(checkout.code, 200, JSON.stringify(checkout.data));
    assert.equal(checkout.data.payload.match.home_team_id, 21);
    assert.equal(checkout.data.payload.config.home.players[0].id, 2101);
    await assert.rejects(f.assertOnline(), /VIS Offline/);
    assert.equal((await f.invoke('checkout', {}, 8)).code, 409);
    const retryCheckout = await f.invoke('checkout');
    assert.equal(retryCheckout.data.payload.offlineLease.checkoutToken, checkout.data.payload.offlineLease.checkoutToken);
    const batch = journal(checkout.data.payload, [lineup, { type: 'RALLY', events: [{ team: 'home', player: 2101, skill: 'S', grade: '#' }] }, { type: 'TIMEOUT', team: 'away' }]);
    const result = await f.invoke('sync', batch);
    assert.equal(result.code, 200, JSON.stringify(result.data));
    assert.equal(result.data.payload.actions[0].team_id, 21);
    assert.equal(result.data.payload.actions[0].player_id, 2101);
    assert.equal(view(result.data.payload).state.score.home, 1);
    assert.equal(view(result.data.payload).match.team_a_score, 8);
    assert.notEqual(view(result.data.payload).match.live_state?.scoringSource, 'custom-vis');
    assert.equal(projectOfficialState(f.data().match, f.data().actions).state.score.home, 1);
    assert.equal(f.data().match.team_a_score, 8);
    assert.equal(f.data().match.team_b_score, 4);
    const retry = await f.invoke('sync', batch);
    assert.equal(retry.code, 200, JSON.stringify(retry.data));
    assert.equal(f.data().actions.length, 1);
    assert.equal((await f.invoke('sync', { ...batch, release: true })).code, 200);
    await f.assertOnline();
    const late = journal(result.data.payload, [{ type: 'TIMEOUT', team: 'home' }]);
    assert.equal((await f.invoke('sync', { ...late, release: true })).code, 409);
    const next = await f.invoke('checkout');
    assert.notEqual(next.data.payload.offlineSession, batch.offlineSession);
    assert.equal((await f.invoke('sync', batch)).code, 409);
});
test('Admin VIS: changed roster conflicts; explicit release preserves server data; Scorer leases prevent checkout', async () => {
    const f = fixture(), checkout = await f.invoke('checkout');
    const batch = journal(checkout.data.payload, [lineup]);
    f.roster.home.players[0].number = 99;
    assert.equal((await f.invoke('sync', batch)).code, 409);
    assert.equal(f.data().actions.length, 0);
    assert.equal((await f.invoke('release', { offlineSession: 'wrong-session' })).code, 409);
    assert.equal((await f.invoke('release', { offlineSession: batch.offlineSession })).code, 200);
    assert.equal(f.data().match.team_a_score, 8);
    f.scorerLease({ released: 0, expires_at: Date.now() + 60000 });
    assert.equal((await f.invoke('checkout')).code, 409);
});

test('Admin VIS: Scorer checkout after VIS expiry prevents an old VIS journal from reclaiming the match', async () => {
    const f = fixture(), checked = await f.invoke('checkout');
    const batch = journal(checked.data.payload, [lineup]);
    f.data().match.vis_state.offlineVis.payload.offlineLease.expiresAt = Date.now() - 1;
    f.scorerLease({ released: 0, expires_at: Date.now() + 60000 });
    assert.equal((await f.invoke('sync', batch)).code, 409);
    assert.equal(f.data().actions.length, 0);
});
test('Admin VIS: a failure after an inserted rally rolls back the whole sync batch and leaves receipts retryable', async () => {
    const f = fixture(), checkout = await f.invoke('checkout');
    const setup = await f.invoke('sync', journal(checkout.data.payload, [lineup]));
    assert.equal(setup.code, 200, JSON.stringify(setup.data));
    const batch = journal(setup.data.payload, [{ type: 'RALLY', events: [{ team: 'home', player: 2101, skill: 'S', grade: '#' }] }, { type: 'TIMEOUT', team: 'away' }]);
    f.failUpdate(true);
    assert.equal((await f.invoke('sync', batch)).code, 500);
    assert.equal(f.data().actions.length, 0);
    f.failUpdate(false);
    assert.equal((await f.invoke('sync', batch)).code, 200);
    assert.equal(f.data().actions.length, 1);
});

test('Admin VIS: substitution, side-out and Undo agree with the offline engine across successive batches', async () => {
    const f = fixture(), checked = await f.invoke('checkout');
    const initial = await f.invoke('sync', journal(checked.data.payload, [lineup, { type: 'RALLY', events: [{ team: 'home', player: 2101, skill: 'S', grade: '#' }] }]));
    const batch = journal(initial.data.payload, [
        { type: 'SUBSTITUTION', team: 'home', playerOut: 2101, playerIn: 2107 },
        { type: 'RALLY', events: [{ team: 'away', player: null, skill: 'OP', grade: '#' }] },
        { type: 'UNDO' }, { type: 'UNDO' },
    ]);
    const result = await f.invoke('sync', batch);
    assert.equal(result.code, 200, JSON.stringify(result.data));
    const state = projectOfficialState(f.data().match, f.data().actions).state;
    assert.deepEqual(state.score, { home: 1, away: 0 });
    assert.deepEqual(state.lineups.home, lineup.lineups.home);
    assert.equal(state.substitutions.home, 0);
    assert.equal(f.data().actions.length, 1);
    assert.equal((await f.invoke('sync', batch)).code, 200);
});

test('Admin VIS: missing rosters and jersey numbers fail before creating a lease', async () => {
    const f = fixture(); f.roster.home.players = [];
    assert.equal((await f.invoke('checkout')).code, 409);
    assert.equal(f.data().match.vis_state.offlineVis, undefined);
    const g = fixture(); g.roster.home.players[0].number = null;
    assert.equal((await g.invoke('checkout')).code, 409);
});

test('legacy ungrouped VIS Undo removes only the last statistic', async () => {
    const f = fixture(), checked = await f.invoke('checkout');
    let payload = commandPayload(checked.data.payload, { operationId: 'legacy-lineup-operation', revision: 0, command: lineup }).payload;
    for (let n = 0; n < 2; n++) payload = commandPayload(payload, { operationId: `legacy-rally-operation-${n}`, revision: payload.revision, command: { type: 'RALLY', context: { key: view(payload).state.context.key }, events: [{ team: 'home', player: null, skill: 'OP', grade: '#' }] } }).payload;
    payload.actions.forEach(action => { delete action.details.rallyId; });
    const result = commandPayload(payload, { operationId: 'legacy-undo-operation', revision: payload.revision, command: { type: 'UNDO' } });
    assert.equal(result.payload.actions.length, 1);
    assert.equal(result.response.deletedEventIds.length, 1);
});
