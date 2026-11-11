const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { roleHasPermission } = require('../config/permissions');
function harness(found = true) {
    const calls = [];
    const query = async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('SELECT t.*')) return { rows: found ? [{ id: 7, team_entry_id: 11, name: 'ทีมทดสอบ', competition_name_en: 'Championship' }] : [] };
        if (sql.includes('FROM team_entry_players')) return { rows: [{ id: 42, selected: 1, entry_number: 28, entry_is_captain: 0 }] };
        if (sql.includes('FROM team_entry_staff')) return { rows: [{ id: 5, selected: 1, role: 'Head Coach' }] };
        return { rows: [] };
    };
    const connection = { query, release() {} };
    const scope = { exports: {}, console: { error() {} }, require: name => name === '../config/db' ? { query, connect: async () => connection } : name === '../utils/auditLogger' ? { writeAuditLog: async () => {} } : name === '../utils/automaticEntryRoster' ? require('../utils/automaticEntryRoster') : require('../utils/teamCompositionStaff') };
    vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/teamCompositionReportController'), 'utf8'), scope);
    const res = { code: 200, headers: {}, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; } };
    return { calls, controller: scope.exports, res };
}
test('composition report reads the exact registered entry and preserves entry numbers and flags', async () => {
    const h = harness();
    await h.controller.detail({ params: { entryId: '11' } }, h.res);
    assert.equal(h.res.code, 200);
    assert.equal(h.res.body.players[0].entry_number, 28);
    assert.equal(h.res.body.players[0].entry_is_captain, 0);
    assert.equal(h.res.body.staff[0].id, 5);
    assert.equal(h.res.headers['Cache-Control'], 'no-store');
    for (const call of h.calls.filter(call => call.sql.includes('WHERE'))) assert.equal(call.params[0], 11);
    assert.ok(h.calls.some(call => call.sql.includes('p.team_id=te.team_id')));
    assert.ok(h.calls.some(call => call.sql.includes('s.team_id=te.team_id')));
    assert.ok(h.calls.some(call => call.sql === 'COMMIT'));
});
test('missing or invalid entry never falls back to all team players', async () => {
    for (const [id, status] of [['abc', 400], ['0', 400], ['11', 404]]) {
        const h = harness(false);
        await h.controller.detail({ params: { entryId: id } }, h.res);
        assert.equal(h.res.code, status);
        assert.ok(!h.calls.some(call => call.sql.includes('FROM team_entry_players')));
    }
});
test('both composition endpoints require export permission, retaining other role restrictions', () => {
    const routes = fs.readFileSync(require.resolve('../routes/api'), 'utf8');
    for (const path of ['/reports/team-composition/entries', '/reports/team-composition/:entryId']) assert.ok(routes.includes(`router.get('${path}', authMiddleware.canExportReports,`));
    assert.equal(roleHasPermission('admin', 'report.export'), true);
    assert.equal(roleHasPermission('team_staff', 'report.export'), false);
});
