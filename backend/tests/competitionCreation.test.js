const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fixture = { title_th: 'การแข่งขันทดสอบ', title_en: 'Test Championship', start_date: '2026-12-01', end_date: '2026-12-02', stadium_id: 1, sport: 'Volleyball', status: 'open', max_sets: 3, max_players: 14,
    categories: [{ age_group_id: 1, gender: 'Male' }, { age_group_id: 2, gender: 'Female', max_sets: 5 }] };
function harness(failInsert = false) {
    const calls = [];
    const connection = { async query(sql, params = []) {
        calls.push({ sql, params });
        if (sql.includes('SELECT id FROM age_groups')) return { rows: [{ id: 1 }, { id: 2 }] };
        if (sql.includes('SELECT id, title, gender')) return { rows: [] };
        if (sql.includes('INSERT INTO competitions') && failInsert) throw Error('Simulated write failure');
        return { rows: [], insertId: 1 };
    }, release() {} };
    const db = { pool: { connect: async () => connection } };
    const filename = require.resolve('../controllers/competitionsController');
    const context = { module: { exports: {} }, console: { error() {} }, require: name => name === '../config/db' ? db : name === '../utils/auditLogger' ? { writeAuditLog() {} } : require(path.resolve(path.dirname(filename), name)) };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context);
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    return { calls, controller: context.module.exports, res };
}
test('creation persists both languages and only the two selected matrix pairs atomically', async () => {
    const h = harness();
    await h.controller.createCompetition({ body: fixture }, h.res);
    assert.equal(h.res.code, 200);
    assert.equal(h.res.body.created_count, 2);
    const inserts = h.calls.filter(call => call.sql.includes('INSERT INTO competitions'));
    assert.equal(inserts.length, 2);
    assert.deepEqual(inserts.map(call => [call.params[4], call.params[3], call.params[9]]), [[1, 'Male', 3], [2, 'Female', 5]]);
    for (const insert of inserts) {
        assert.equal((insert.sql.match(/\?/g) || []).length, insert.params.length);
        assert.equal(insert.params[14], fixture.title_th);
        assert.equal(insert.params[15], fixture.title_en);
        assert.equal(insert.params[0], fixture.title_th);
    }
    assert.ok(h.calls.some(call => call.sql === 'COMMIT'));
});
test('invalid publication and failed writes never commit partially created categories', async () => {
    for (const [failure, body, code] of [[false, { ...fixture, title_en: '' }, 400], [true, fixture, 500]]) {
        const h = harness(failure);
        await h.controller.createCompetition({ body }, h.res);
        assert.equal(h.res.code, code);
        assert.ok(!h.calls.some(call => call.sql === 'COMMIT'));
    }
});
