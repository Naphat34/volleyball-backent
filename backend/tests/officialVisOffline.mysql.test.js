const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { commandPayload, view } = require('../utils/customVis');

test('MySQL: Admin VIS downloads registered rosters and atomically syncs/retries into its original match', { skip: process.env.RUN_MYSQL_VIS_TESTS !== '1' }, async t => {
    require('dotenv').config({ quiet: true });
    const db = require('../config/db');
    const scorer = require('../controllers/scorerOfflineController');
    const connection = await db.connect();
    const proxy = { query: connection.query.bind(connection), beginTransaction: connection.beginTransaction.bind(connection), commit: connection.commit.bind(connection), rollback: connection.rollback.bind(connection), release() {} };
    try {
        // Only these connection-local TEMPORARY tables are ever written. Real
        // competition, team and registration data is used as read-only reference.
        const candidates = (await connection.query("SELECT * FROM matches WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL AND status NOT IN ('completed','cancelled','finished','match_finished') ORDER BY id LIMIT 30")).rows;
        let match;
        for (const row of candidates) {
            const roster = await scorer.call(scorer.scopedController(proxy), 'getMatchRosterData', { params: { matchId: row.id } }, {});
            if (['home', 'away'].every(team => roster[team].players.filter(p => !['L','L1','L2','L1+C','L2+C'].includes(p.role || p.position)).length >= 6)) { match = row; break; }
        }
        if (!match) { t.skip('No registered match has six players per team'); return; }
        for (const table of ['matches', 'match_actions', 'scorer_offline_sessions']) {
            const schema = (await connection.query(`SHOW COLUMNS FROM ${table}`)).rows;
            const fields = schema.map(col => `\`${col.Field}\` ${col.Type}${col.Field === 'id' ? ' PRIMARY KEY AUTO_INCREMENT' : ' NULL'}`);
            await connection.query(`CREATE TEMPORARY TABLE ${table} (${fields.join(',')})`);
        }
        match.vis_state = '{}'; match.status = 'scheduled';
        const columns = Object.keys(match);
        await connection.query(`INSERT INTO matches (${columns.map(key => `\`${key}\``).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, columns.map(key => match[key] && typeof match[key] === 'object' && !(match[key] instanceof Date) ? JSON.stringify(match[key]) : match[key]));
        const file = require.resolve('../controllers/officialVisOfflineController'), localRequire = createRequire(file);
        const scope = { exports: {}, console, require: name => name === '../config/db' ? { connect: async () => proxy } : localRequire(name) };
        scope.require.resolve = localRequire.resolve;
        vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope, { filename: file });
        const invoke = async (method, body = {}) => {
            const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.data = value; } };
            await scope.exports[method]({ params: { matchId: match.id }, user: { id: 7 }, body: { deviceId: 'mysql-vis-offline-device', ...body }, app: { get: () => null } }, res);
            assert.equal(res.code, 200, JSON.stringify(res.data)); return res.data;
        };
        const checked = await invoke('checkout');
        let payload = checked.payload;
        assert.equal(payload.match.id, match.id);
        const lineups = Object.fromEntries(['home','away'].map(team => [team, payload.config[team].players.filter(p => p.position !== 'L').slice(0,6).map(p => p.id)]));
        const operations = [];
        for (const command of [{ type: 'SET_LINEUP', lineups, servingTeam: 'home', firstSetHomeLeft: true }, { type: 'RALLY', events: [{ team: 'home', player: null, skill: 'OP', grade: '#' }] }]) {
            const op = { operationId: require('node:crypto').randomUUID(), revision: payload.revision, command: { ...command, context: { key: view(payload).state.context.key } } };
            payload = commandPayload(payload, op).payload; operations.push(op);
        }
        const request = { offlineSession: payload.offlineSession, baseRevision: checked.payload.revision, operations };
        const synced = await invoke('sync', request);
        assert.equal(view(synced.payload).state.score.home, 1);
        assert.equal(synced.payload.actions[0].team_id, match.home_team_id);
        await invoke('sync', request);
        assert.equal((await connection.query('SELECT * FROM match_actions WHERE match_id=?', [match.id])).rows.length, 1);
        await invoke('sync', { ...request, release: true });
        await scope.exports.assertOnline(proxy, match.id);
        const unchanged = (await connection.query('SELECT * FROM matches WHERE id=?', [match.id])).rows[0];
        assert.equal(unchanged.team_a_score, match.team_a_score);
        assert.equal(unchanged.team_b_score, match.team_b_score);
    } finally {
        await connection.rollback();
        for (const table of ['scorer_offline_sessions','match_actions','matches']) await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
        connection.release(); await db.pool.end();
    }
});
