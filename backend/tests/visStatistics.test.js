const { test } = require('node:test');
const assert = require('node:assert/strict');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch { /* SQL checks require Node 22.13+. */ }
const fs = require('node:fs');
const vm = require('node:vm');
const { visStatisticsSource } = require('../utils/visStatistics');
// SQLite checks the aggregation/fallback logic; MySQL-specific character-set
// coercion is exercised by the opt-in integration test below.
const sqliteSql = sql => sql.replace(/CONVERT\(((?:[ae]\.)?(?:skill|grade)) USING utf8mb4\) COLLATE utf8mb4_unicode_ci/g, '$1');

test('shared statistics prefer match_actions and retain legacy event-only matches', { skip: !DatabaseSync }, () => {
    const db = new DatabaseSync(':memory:');
    try {
        for (const table of ['match_events', 'match_actions']) db.exec(`CREATE TABLE ${table} (id INTEGER, match_id INTEGER, team_id INTEGER, player_id INTEGER, skill TEXT, grade TEXT)`);
        db.exec(`INSERT INTO match_events VALUES (1, 1, 10, 1, 'A', '#'), (2, 1, 10, 1, 'A', '+'), (3, 1, 10, 1, 'R', '#');
            INSERT INTO match_actions VALUES (4, 1, 10, 1, 'A', '#'), (5, 2, 10, 1, 'A', '#');`);
        const rows = db.prepare(sqliteSql(`SELECT COUNT(*) AS actions, SUM(CASE WHEN skill = 'A' THEN 1 ELSE 0 END) AS attempts FROM (${visStatisticsSource})`)).get();
        assert.equal(rows.actions, 2);
        assert.equal(rows.attempts, 2);
    } finally { db.close(); }
});

test('public best scorers exclude perfect reception and setting while preserving skill rankings', { skip: !DatabaseSync }, async () => {
    const db = new DatabaseSync(':memory:');
    try {
        db.function('CONCAT', (...values) => values.join(''));
        db.exec(`CREATE TABLE matches (id INTEGER, competition_id INTEGER);
            CREATE TABLE players (id INTEGER, first_name TEXT, last_name TEXT, number INTEGER, photo TEXT, team_id INTEGER);
            CREATE TABLE teams (id INTEGER, name TEXT);
            CREATE TABLE match_events (id INTEGER, match_id INTEGER, team_id INTEGER, player_id INTEGER, skill TEXT, grade TEXT);
            CREATE TABLE match_actions (id INTEGER, match_id INTEGER, team_id INTEGER, player_id INTEGER, skill TEXT, grade TEXT);
            INSERT INTO matches VALUES (1, 99);
            INSERT INTO players VALUES (1, 'Test', 'Player', 1, NULL, 10);
            INSERT INTO teams VALUES (10, 'Test team');
            INSERT INTO match_actions VALUES (1, 1, 10, 1, 'A', '#'), (2, 1, 10, 1, 'R', '#'),
                (3, 1, 10, 1, 'E', '#'), (4, 1, 10, 1, 'D', '+'), (5, 1, 10, 1, 'S', '=');`);
        const context = { module: { exports: {} }, console, require: name => {
            if (name === '../config/db') return { query: async (sql, params) => [db.prepare(sqliteSql(sql)).all(...params)] };
            if (name === '../utils/visStatistics') return { visStatisticsSource };
            throw new Error(`Unexpected dependency: ${name}`);
        } };
        vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/publicController'), 'utf8'), context);
        const res = { json(body) { this.body = body; }, status(code) { throw new Error(`Unexpected status: ${code}`); } };
        await context.module.exports.getStatistics({ params: { competitionId: 99 } }, res);
        assert.equal(res.body.best_scorers[0].value, 1);
        assert.equal(res.body.best_setters[0].value, 1);
        assert.equal(res.body.best_diggers[0].value, 2);
        assert.equal(res.body.best_servers.length, 0);
    } finally { db.close(); }
});

test('MySQL statistics UNION supports mixed collations and retains canonical and legacy events', { skip: process.env.RUN_MYSQL_VIS_TESTS !== '1' }, async () => {
    require('dotenv').config({ quiet: true });
    const db = require('../config/db');
    const connection = await db.connect();
    try {
        // Connection-local temporary tables shadow the real tables; match data
        // and the persistent schema are never modified by this regression test.
        for (const [table, collation] of [['match_events', 'utf8mb4_0900_ai_ci'], ['match_actions', 'utf8mb4_unicode_ci']]) {
            await connection.query(`CREATE TEMPORARY TABLE ${table} (
                id INT, match_id INT, team_id INT, player_id INT,
                skill VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ${collation},
                grade VARCHAR(32) CHARACTER SET utf8mb4 COLLATE ${collation}
            )`);
        }
        await connection.query("INSERT INTO match_events VALUES (1,1,10,1,'A','#'),(2,1,10,1,'R','#'),(3,3,10,1,'TIMEOUT',NULL)");
        await connection.query("INSERT INTO match_actions VALUES (1,1,10,1,'A','#'),(2,2,10,1,'S','#'),(3,3,10,1,'A','=')");
        // MySQL cannot reference a TEMPORARY table twice in a query. Use an
        // identical connection-local copy for the legacy fallback check.
        await connection.query('CREATE TEMPORARY TABLE vis_statistics_action_lookup LIKE match_actions');
        await connection.query('INSERT INTO vis_statistics_action_lookup SELECT * FROM match_actions');
        const source = visStatisticsSource.replace('SELECT 1 FROM match_actions a WHERE a.match_id',
            'SELECT 1 FROM vis_statistics_action_lookup a WHERE a.match_id');
        const result = await connection.query(`SELECT * FROM (${source}) stats ORDER BY match_id, id`);
        assert.equal(result.rows.length, 3);
        assert.equal(result.rows.filter(row => row.match_id === 1).length, 1);
        assert.equal(result.rows.find(row => row.match_id === 2).skill, 'S');
        assert.equal(result.rows.find(row => row.grade === '=').match_id, 3);
        const metadata = await connection.query(`SELECT COLLATION(skill) AS skill_collation, COLLATION(grade) AS grade_collation FROM (${source}) stats LIMIT 1`);
        assert.equal(metadata.rows[0].skill_collation, 'utf8mb4_unicode_ci');
        assert.equal(metadata.rows[0].grade_collation, 'utf8mb4_unicode_ci');
    } finally {
        try {
            await connection.query('DROP TEMPORARY TABLE IF EXISTS match_events, match_actions, vis_statistics_action_lookup');
        } finally {
            connection.release();
            await db.pool.end();
        }
    }
});
