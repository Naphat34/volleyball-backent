const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');

test('manual scorer endpoints persist isolated matches, enforce privacy and confirm real set results', { skip: process.env.RUN_MYSQL_MANUAL_SCORER_TESTS !== '1' }, async () => {
    const db = require('../config/db');
    const connection = await db.connect();
    const tables = ['matches','teams','players','match_sets','match_events','match_actions','audit_logs'];
    const rewrite = sql => tables.reduce((result, name) => result.replace(new RegExp(`\\b${name}\\b`, 'g'), `${name}_manual_test`), sql);
    const proxy = { query: async (sql, args) => {
        let statement = rewrite(sql);
        // MySQL temporary tables cannot be opened twice in one query.
        if (statement.includes('teams_manual_test t2')) {
            await connection.query('DELETE FROM teams_manual_away_test');
            await connection.query('INSERT INTO teams_manual_away_test SELECT * FROM teams_manual_test');
            statement = statement.replace(/teams_manual_test t2/g, 'teams_manual_away_test t2');
        }
        return connection.query(statement, args);
    }, beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(), rollback: () => connection.rollback(), release() {} };
    const database = { query: proxy.query, connect: async () => proxy, pool: { connect: async () => proxy } };
    function load(file, overrides = {}) {
        const resolved = require.resolve(file), localRequire = createRequire(resolved);
        const scope = { module: { exports: {} }, exports: {}, console, require: name => name === '../config/db' ? database : overrides[name] || localRequire(name) };
        scope.exports = scope.module.exports;
        vm.runInNewContext(fs.readFileSync(resolved, 'utf8'), scope, { filename: resolved });
        return scope.module.exports;
    }
    const request = (id, body = {}, user = { id: 777001, role: 'scorer' }) => ({ user, params: { id, matchId: id }, body, headers: {}, app: { get: () => null } });
    const call = async (controller, method, req) => {
        const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
        await controller[method](req, res); return res;
    };
    try {
        for (const table of tables) await connection.query(`CREATE TEMPORARY TABLE ${table}_manual_test LIKE ${table}`);
        await connection.query('CREATE TEMPORARY TABLE teams_manual_away_test LIKE teams');
        const manual = load('../controllers/manualScorerController');
        const scorer = load('../controllers/scorerController');
        const roster = () => Array.from({ length: 6 }, (_, i) => ({ number: i+1, first_name: `Test ${i}`, last_name: 'Player', position: '', is_captain: i === 0 }));
        const config = { title: 'Manual integration', creationId: crypto.randomUUID(), maxSets: 3, pointsPerSet: 10, decidingSetPoints: 7, home: { name: 'Test H', players: roster(), color: '#ffffff' }, away: { name: 'Test A', players: roster(), color: '#111827' } };
        const created = await call(manual, 'save', request(null, config));
        assert.equal(created.code, 201);
        const id = created.data.match.id;
        assert.equal(created.data.match.competition_id, null);
        assert.equal(created.data.match.manual_published, 0);
        assert.equal(created.data.match.manual_lifecycle, 'draft');
        assert.equal((await call(manual, 'save', request(null, config))).data.match.id, id);
        assert.equal((await proxy.query('SELECT COUNT(*) AS count FROM teams')).rows[0].count, 2);
        assert.equal((await call(manual, 'read', request(id, {}, { id: 777002, role: 'scorer' }))).code, 404);
        let actionReq = request(id, { published: true }); actionReq.params.action = 'publish';
        assert.equal((await call(manual, 'action', actionReq)).code, 409);
        assert.equal((await call(manual, 'save', request(id, { ...config, ready: true }))).code, 200);
        const details = await call(scorer, 'getMatchDetails', request(id));
        assert.equal(details.data.max_sets, 3); assert.equal(details.data.competition_name, config.title);
        const rosterResponse = await call(scorer, 'getMatchRosterData', request(id));
        assert.equal(rosterResponse.code, 200); assert.equal(rosterResponse.data.home.players.length, 6);
        assert.equal(rosterResponse.data.away.players.length, 6);
        const auth = {
            verifyToken(req, res, next) { if (!req.user) return res.status(401).json({ error: 'No token' }); return next(); },
            requireApprovedUser(req, res, next) { return next(); }
        };
        const guard = load('../middleware/manualScorerAccess', { './authMiddleware': auth });
        async function access(user, method = 'GET', suffix = '') {
            const req = { ...request(id, {}, user), user, path: `/scorer/match/${id}${suffix}`, method };
            const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
            let allowed = false; await guard(req, res, () => { allowed = true; }); return { ...res, allowed };
        }
        assert.equal((await access(null)).code, 401);
        assert.equal((await access({ id: 777002, role: 'scorer' })).code, 404);
        assert.equal((await access({ id: 777001, role: 'scorer' })).allowed, true);
        assert.equal((await call(manual, 'action', actionReq)).code, 200);
        assert.equal((await access(null)).allowed, true);
        assert.equal((await access({ id: 777002, role: 'scorer' }, 'PUT', '/state')).code, 404);
        actionReq.body = { published: false }; await call(manual, 'action', actionReq);
        assert.equal((await access(null)).code, 401);
        await proxy.query("UPDATE matches SET status='live',first_serve_team_id=home_team_id WHERE id=?", [id]);
        assert.equal((await call(manual, 'save', request(id, config))).code, 409);
        for (const setNumber of [1,2]) {
            const ended = await call(scorer, 'endSet', request(id, { setNumber, homeScore: 10, awayScore: 2, duration: 1 }));
            assert.equal(ended.code, 200);
        }
        assert.equal((await proxy.query('SELECT status FROM matches WHERE id=?', [id])).rows[0].status, 'completed');
        actionReq.params.action = 'confirm'; actionReq.body = {};
        assert.equal((await call(manual, 'action', actionReq)).code, 200);
        assert.equal((await access({ id: 777001, role: 'scorer' }, 'PUT', '/state')).code, 409);
        const backup = await call(manual, 'backup', request(id));
        assert.equal(backup.data.format, 'volley-manual-scorer'); assert.equal(backup.data.sets.length, 2);
        assert.equal((await call(manual, 'list', request(null, {}, { id: 777002, role: 'scorer' }))).data.length, 0);
        assert.equal((await call(manual, 'list', request(null))).data[0].manual_lifecycle, 'confirmed');
    } finally {
        await connection.query('DROP TEMPORARY TABLE IF EXISTS teams_manual_away_test');
        for (const table of [...tables].reverse()) await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${table}_manual_test`);
        connection.release(); await db.pool.end();
    }
});
