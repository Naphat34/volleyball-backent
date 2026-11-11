const test = require('node:test');
const assert = require('node:assert/strict');
const { roleHasPermission } = require('../config/permissions');
test('admin and organizer may export reports, other roles retain their restrictions', () => {
    assert.equal(roleHasPermission('admin', 'report.export'), true);
    assert.equal(roleHasPermission('organizer', 'report.export'), true);
    for (const role of ['scorer', 'referee', 'team_staff']) assert.equal(roleHasPermission(role, 'report.export'), false);
});
test('all report queries and CSV/Excel responses work against the configured MySQL schema', { skip: process.env.RUN_REPORT_DB_TESTS !== '1' }, async () => {
    const db = require('../config/db');
    const { exportReport } = require('../controllers/reportController');
    try {
        for (const type of ['competitions', 'teams', 'matches', 'audit']) for (const format of ['csv', 'xls']) {
            const response = { code: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.error = body; return this; }, send(body) { this.body = body; return this; } };
            await exportReport({ user: { role: 'admin' }, params: { type, format } }, response);
            assert.equal(response.code, 200, `${type}.${format}: ${JSON.stringify(response.error)}`);
            assert.ok(response.body?.length > 0, `${type}.${format}: empty response`);
            assert.match(response.headers['Content-Disposition'], /attachment/);
        }
        const composition = require('../controllers/teamCompositionReportController');
        const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; }, setHeader() {} };
        await composition.entries({}, response);
        assert.equal(response.code, 200);
        assert.ok(Array.isArray(response.body));
        // Validate all entry-scoped SELECTs even if the database has no registered teams.
        const source = require('node:fs').readFileSync(require.resolve('../controllers/teamCompositionReportController'), 'utf8') + require('node:fs').readFileSync(require.resolve('../utils/teamCompositionStaff'), 'utf8');
        const selects = [...source.matchAll(/(?:connection|database)\.query\(`([^`]+)`, \[entryId\]\)/g)];
        assert.equal(selects.length, 4);
        for (const match of selects) await db.query(`EXPLAIN ${match[1]}`, [0]);
    } finally { await db.pool.end(); }
});
