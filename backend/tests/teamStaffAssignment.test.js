const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function harness(ownEntry = true, ownStaff = true) {
    const calls = [];
    const connection = { async query(sql, params) {
        calls.push({ sql, params });
        if (sql.startsWith('SELECT team_id FROM users')) return { rows: [{ team_id: 45 }] };
        if (sql.startsWith('SELECT id FROM team_entries')) return { rows: ownEntry ? [{ id: 83 }] : [] };
        if (sql.includes('SELECT id, team_id FROM team_staff')) return { rows: [{ id: 7, team_id: ownStaff ? 45 : 99 }] };
        return { rows: [] };
    }, release() {} };
    const filename = require.resolve('../controllers/competitionsController');
    const scope = { module: { exports: {} }, console: { error() {} }, require: name => name === '../config/db' ? { pool: { connect: async () => connection } } : name === '../utils/auditLogger' ? { writeAuditLog: async () => {} } : require(path.resolve(path.dirname(filename), name)) };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), scope);
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    return { calls, controller: scope.module.exports, res };
}
test('team staff save officials only to their own registered entry', async () => {
    const h = harness();
    await h.controller.updateMyTeamEntryStaff({ user: { id: 4, role: 'team_staff' }, params: { entryId: 83 }, body: { staff_ids: [7] } }, h.res);
    assert.equal(h.res.code, 200);
    const scope = h.calls.find(row => row.sql.startsWith('SELECT id FROM team_entries'));
    assert.deepEqual(Array.from(scope.params), [83, 45]);
    assert.ok(h.calls.some(row => row.sql === 'COMMIT'));
});
test('another team entry or staff member cannot be assigned', async () => {
    for (const [ownEntry, ownStaff, code] of [[false, true, 404], [true, false, 400]]) {
        const h = harness(ownEntry, ownStaff);
        await h.controller.updateMyTeamEntryStaff({ user: { id: 4 }, params: { entryId: 83 }, body: { staff_ids: [7] } }, h.res);
        assert.equal(h.res.code, code);
        assert.ok(!h.calls.some(row => row.sql.startsWith('DELETE') || row.sql.startsWith('INSERT')));
    }
});
test('admin assignment endpoints are removed and assignment writes are restricted to team_staff', () => {
    const routes = fs.readFileSync(require.resolve('../routes/api'), 'utf8');
    assert.ok(!routes.includes("'/reports/team-composition/:entryId/staff'"));
    assert.ok(routes.includes("router.put('/my-team/entries/:entryId/staff', authMiddleware.hasAnyRole(['team_staff']), authMiddleware.canManageOwnTeam,"));
});
