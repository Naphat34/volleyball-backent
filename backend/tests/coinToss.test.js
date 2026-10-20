const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../controllers/scorerController.js'), 'utf8');
const match = { home_team_id: 10, away_team_id: 20, status: 'scheduled' };

async function request(body, rows = [match], affectedRows = 1) {
    const calls = [];
    const db = { query: async (sql, params) => {
        calls.push({ sql, params });
        return sql.startsWith('SELECT') ? { rows } : { affectedRows };
    } };
    const context = { module: { exports: {} }, console, require: name => {
        if (name === '../config/db') return db;
        if (name === '../config/visCodes') return {};
        throw new Error(`Unexpected dependency: ${name}`);
    } };
    vm.runInNewContext(source, context);
    const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    await context.module.exports.saveCoinToss({ params: { matchId: '1' }, body, app: { get: () => null } }, res);
    return { res, calls };
}

const valid = { first_serve_team_id: 10, left_side_team_id: 20 };
test('rejects missing IDs before querying', async () => {
    const { res, calls } = await request({});
    assert.equal(res.code, 400);
    assert.equal(calls.length, 0);
});
test('returns 404 for a missing match', async () => {
    assert.equal((await request(valid, [])).res.code, 404);
});
test('rejects teams outside the match', async () => {
    const { res, calls } = await request({ ...valid, left_side_team_id: 30 });
    assert.equal(res.code, 400);
    assert.equal(calls.length, 1);
});
test('saves valid teams with an atomic match-status guard', async () => {
    const { res, calls } = await request(valid);
    assert.equal(res.code, 200);
    assert.match(calls[1].sql, /status NOT IN/);
    assert.deepEqual(Array.from(calls[1].params), [10, 20, '1', 10, 20]);
});
test('returns conflict when the match starts or changes before the update', async () => {
    assert.equal((await request(valid, [match], 0)).res.code, 409);
});
test('retries of already saved results are idempotent after start', async () => {
    const { res, calls } = await request(valid, [{ ...match, ...valid, status: 'live' }]);
    assert.equal(res.code, 200);
    assert.equal(calls.length, 1);
});
