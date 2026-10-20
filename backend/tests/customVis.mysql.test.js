const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('custom VIS persists JSON in MySQL with owner isolation, publish/revoke, replay and atomic undo', { skip: process.env.RUN_MYSQL_CUSTOM_VIS_TESTS !== '1' }, async () => {
    const db = require('../config/db');
    const connection = await db.connect();
    try {
        await connection.query('CREATE TEMPORARY TABLE custom_vis_matches_integration LIKE custom_vis_matches');
        const proxy = { query: (sql, args) => connection.query(sql.replace(/\bcustom_vis_matches\b/g, 'custom_vis_matches_integration'), args),
            beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(), rollback: () => connection.rollback(), release() {} };
        const scope = { exports: {}, console: { error() {} }, require: name => name === '../config/db' ? { connect: async () => proxy } : require(name) };
        vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/customVisController'), 'utf8'), scope);
        const call = async (method, body = {}, params = {}, owner = 7) => {
            const res = { code: 200, status(code) { this.code = code; return this; }, set() {}, json(data) { this.data = data; } };
            await scope.exports[method]({ user: { id: owner, role: 'statistician' }, params, body, app: { get: () => null } }, res);
            return res;
        };
        const players = Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: 'Test', last_name: String(i) }));
        const config = { title: 'Integration only', maxSets: 3, creationId: require('node:crypto').randomUUID(), home: { name: 'H', players }, away: { name: 'A', players } };
        const created = await call('create', config);
        assert.equal(created.code, 201);
        const id = created.data.match.id, token = created.data.match.public_token;
        assert.equal((await call('create', config)).data.match.id, id);
        assert.equal((await connection.query('SELECT * FROM custom_vis_matches_integration')).rows.length, 1);
        assert.equal((await call('read', {}, { id }, 8)).code, 404);
        const send = async command => {
            const current = await call('read', {}, { id });
            return call('command', { operationId: require('node:crypto').randomUUID(), revision: current.data.state.revision,
                command: { ...command, context: { key: current.data.state.context.key } } }, { id });
        };
        assert.equal((await send({ type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true })).code, 200);
        const scored = await send({ type: 'RALLY', events: [{ team: 'home', player: 1, skill: 'S', grade: '=' }, { team: 'away', player: null, skill: 'OP', grade: '#' }] });
        assert.equal(scored.code, 200);
        assert.deepEqual(scored.data.state.score, { home: 0, away: 1 });
        const snapshot = (await call('read', {}, { id })).data.backup;
        const imported = await call('create', { creationId: require('node:crypto').randomUUID(), importBackup: snapshot });
        assert.equal(imported.code, 201);
        assert.notEqual(imported.data.match.id, id);
        assert.deepEqual((await call('read', {}, { id: imported.data.match.id })).data.state.score, { home: 0, away: 1 });
        assert.equal(imported.data.match.published, false);
        assert.equal((await call('publicView', {}, { token })).code, 404);
        assert.equal((await call('publish', { published: true }, { id })).code, 200);
        assert.deepEqual((await call('publicView', {}, { token })).data.score, { home: 0, away: 1 });
        assert.equal((await send({ type: 'UNDO' })).code, 200);
        assert.deepEqual((await call('read', {}, { id })).data.state.score, { home: 0, away: 0 });
        await call('publish', { published: false }, { id });
        assert.equal((await call('publicView', {}, { token })).code, 404);
    } finally { await connection.query('DROP TEMPORARY TABLE IF EXISTS custom_vis_matches_integration'); connection.release(); await db.pool.end(); }
});
