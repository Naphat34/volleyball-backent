const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { createRequire } = require('node:module');
test('MySQL dashboard counts only ended official sets and returns separate live point snapshots', { skip: process.env.RUN_MYSQL_DASHBOARD !== '1' }, async t => {
    const db = require('../config/db'), connection = await db.connect();
    const tables = ['matches', 'match_sets', 'match_actions'];
    try {
        for (const table of tables) await connection.query(`CREATE TEMPORARY TABLE dashboard_test_${table} LIKE ${table}`);
        await connection.query('INSERT INTO dashboard_test_matches SELECT * FROM matches LIMIT 1');
        const row = (await connection.query('SELECT * FROM dashboard_test_matches')).rows[0];
        if (!row) { t.skip('Requires a read-only reference match'); return; }
        await connection.query("UPDATE dashboard_test_matches SET status='live', vis_state='{}', home_set_score=0, away_set_score=0, live_state=? WHERE id=?", [JSON.stringify({ score: { home: 12, away: 9 }, matchData: { currentSet: 2 } }), row.id]);
        await connection.query('INSERT INTO dashboard_test_match_sets (match_id,set_number,home_score,away_score,end_time) VALUES (?,1,25,19,NOW()), (?,2,12,9,NULL)', [row.id, row.id]);
        const database = { query: (sql, args) => connection.query(sql.replace(/\b(matches|match_sets|match_actions)\b/g, name => `dashboard_test_${name}`), args) };
        const file = require.resolve('../controllers/matchController'), localRequire = createRequire(file);
        const scope = { module: { exports: {} }, exports: {}, console, require: name => name === '../config/db' ? database : localRequire(name) };
        const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.data = value; } };
        vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope, { filename: file });
        await scope.module.exports.getAllMatches({}, res);
        assert.equal(res.code, 200, JSON.stringify(res.data));
        const match = res.data.find(item => item.id === row.id);
        assert.equal(Number(match.home_set_score), 1); assert.equal(Number(match.away_set_score), 0);
        assert.deepEqual(typeof match.set_scores === 'string' ? JSON.parse(match.set_scores) : match.set_scores, ['25-19']);
        assert.deepEqual(match.official_summary.score, { home: 12, away: 9 });
        assert.equal(match.official_summary.currentSet, 2);
        assert.equal(match.vis_summary.status, 'idle');
        assert.equal(match.vis_summary.hasActivity, false);
        assert.equal((await connection.query('SELECT home_set_score FROM dashboard_test_matches')).rows[0].home_set_score, 0);
    } finally {
        for (const table of [...tables].reverse()) await connection.query(`DROP TEMPORARY TABLE IF EXISTS dashboard_test_${table}`);
        connection.release(); await db.pool.end();
    }
});
