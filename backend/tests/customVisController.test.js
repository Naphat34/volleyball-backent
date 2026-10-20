const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { createPayload } = require('../utils/customVis');
function harness() {
    const row = { id: 'custom-test', owner_id: 7, public_token: 'a'.repeat(48), published: 0,
        payload: createPayload({ title: 'Private match', maxSets: 3,
            home: { name: 'Home', players: [{ number: 1, first_name: 'Public', last_name: 'Name' }] },
            away: { name: 'Away', players: [] } }, 'custom-test') };
    const updates = [];
    const connection = { beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {}, query: async (sql, p) => {
        if (sql.startsWith('SELECT payload')) return { rows: row.published ? [{ payload: row.payload }] : [] };
        if (sql.startsWith('SELECT *')) return { rows: [row] };
        if (sql.startsWith('UPDATE custom_vis_matches SET published')) { updates.push(sql); row.published = p[0]; return {}; }
        throw Error(sql);
    } };
    const scope = { exports: {}, console: { error() {} }, require: name => name === '../config/db' ? { connect: async () => connection } : require(name) };
    // Resolve controller-relative imports from this test file's matching ../utils directory.
    vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/customVisController'), 'utf8'), scope);
    return { row, updates, request: async (name, user = { id: 7, role: 'statistician' }, body = {}) => {
        const res = { code: 200, status(code) { this.code = code; return this; }, set() { return this; }, json(data) { this.data = data; } };
        await scope.exports[name]({ user, params: { id: row.id, token: row.public_token }, body }, res);
        return res;
    } };
}
test('only owner/admin can read or publish a private custom match', async () => {
    const h = harness();
    assert.equal((await h.request('read', { id: 8, role: 'statistician' })).code, 404);
    assert.equal((await h.request('publish', { id: 8, role: 'statistician' }, { published: true })).code, 404);
    assert.equal(h.updates.length, 0);
    assert.equal((await h.request('read', { id: 8, role: 'admin' })).code, 200);
});
test('public endpoint stays private by default and revocation takes effect immediately', async () => {
    const h = harness();
    assert.equal((await h.request('publicView', undefined)).code, 404);
    assert.equal((await h.request('publish', undefined, { published: true })).code, 200);
    const published = await h.request('publicView', undefined);
    assert.equal(published.code, 200);
    assert.equal(published.data.players[0].name, 'Public Name');
    assert.equal(published.data.owner_id, undefined);
    assert.equal(published.data.operations, undefined);
    assert.equal(published.data.public_token, undefined);
    await h.request('publish', undefined, { published: false });
    assert.equal((await h.request('publicView', undefined)).code, 404);
});
