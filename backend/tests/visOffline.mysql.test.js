const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { createPayload, commandPayload, view } = require('../utils/customVis');
test('MySQL offline sync is atomic, owner-scoped, idempotent and enforces exclusive checkout', { skip: process.env.RUN_MYSQL_CUSTOM_VIS_TESTS !== '1' }, async () => {
    const db = require('../config/db'), connection = await db.connect();
    try {
        await connection.query('CREATE TEMPORARY TABLE vis_offline_integration LIKE custom_vis_matches');
        const proxy = { query: (sql, args) => connection.query(sql.replace(/\bcustom_vis_matches\b/g, 'vis_offline_integration'), args),
            beginTransaction: () => connection.beginTransaction(), commit: () => connection.commit(), rollback: () => connection.rollback(), release() {} };
        const scope = { exports: {}, console: { error() {} }, require: name => name === '../config/db' ? { connect: async () => proxy } : require(name) };
        vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/customVisController'), 'utf8'), scope);
        const call = async (method, id, body = {}, owner = 7) => {
            const res = { code: 200, status(code) { this.code = code; return this; }, set() {}, json(data) { this.data = data; } };
            await scope.exports[method]({ user: { id: owner, role: 'statistician' }, params: { id }, body, app: { get: () => null } }, res);
            return res;
        };
        const id = `custom-${randomUUID()}`, deviceId = randomUUID();
        const players = Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: 'Test', last_name: String(i) }));
        const config = { title: 'Offline integration only', maxSets: 3, home: { name: 'H', players }, away: { name: 'A', players } };
        let local = createPayload(config, id); const operations = [];
        const send = command => {
            const op = { revision: local.revision, operationId: randomUUID(), command: { ...command, context: { key: view(local).state.context.key } } };
            local = commandPayload(local, op).payload; operations.push(op);
        };
        send({ type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true });
        send({ type: 'RALLY', events: [{ team: 'away', player: null, skill: 'OP', grade: '#' }] });
        const request = { config, deviceId, baseRevision: 0, operations };
        assert.equal((await call('offlineSync', id, request)).code, 200);
        assert.equal((await call('offlineSync', id, request)).code, 200);
        assert.equal((await call('offlineSync', id, request, 8)).code, 404);
        assert.equal((await call('offlineCheckout', id, { deviceId: randomUUID() })).code, 409);
        assert.equal((await call('publish', id, { published: true })).code, 409);
        assert.equal((await call('command', id, { operationId: randomUUID(), revision: 2, command: { type: 'TIMEOUT', team: 'home' } })).code, 409);
        assert.equal((await call('offlineSync', id, { deviceId, baseRevision: 99, operations: [] })).code, 409);
        assert.deepEqual((await call('read', id)).data.state.score, { home: 0, away: 1 });
        const failedId = `custom-${randomUUID()}`;
        assert.equal((await call('offlineSync', failedId, { ...request, operations: [...operations, { operationId: randomUUID(), revision: 2, command: { type: 'CONFIRM' } }] })).code, 400);
        assert.equal((await call('read', failedId)).code, 404);
        assert.equal((await connection.query('SELECT * FROM vis_offline_integration')).rows.length, 1);
        assert.equal((await call('offlineSync', id, { ...request, release: true })).code, 200);
        assert.equal((await call('command', id, { operationId: randomUUID(), revision: 2, command: { type: 'TIMEOUT', team: 'home' } })).code, 200);
        assert.equal((await call('read', id)).data.state.timeouts.home, 1);
        const checked = await call('offlineCheckout', id, { deviceId });
        assert.equal(checked.code, 200); assert.equal(checked.data.leaseCreated, true);
        const token = checked.data.payload.offlineLease.checkoutToken;
        const repeated = await call('offlineCheckout', id, { deviceId });
        assert.equal(repeated.data.leaseCreated, false); assert.equal(repeated.data.payload.offlineLease.checkoutToken, token);
        assert.equal((await call('offlineCancelCheckout', id, { deviceId, revision: 3, checkoutToken: randomUUID() })).code, 409);
        assert.equal((await call('offlineCancelCheckout', id, { deviceId, revision: 3, checkoutToken: token })).code, 200);
        const next = await call('offlineCheckout', id, { deviceId });
        assert.notEqual(next.data.payload.offlineLease.checkoutToken, token);
        assert.equal((await call('offlineCancelCheckout', id, { deviceId, revision: 3, checkoutToken: token })).code, 409);
    } finally {
        await connection.query('DROP TEMPORARY TABLE IF EXISTS vis_offline_integration');
        connection.release(); await db.pool.end();
    }
});
