const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { projectOfficialState } = require('../utils/visWorkflow');

test('MySQL: VIS save, retry and Undo preserve eScore scores and a newer official point', { skip: process.env.RUN_MYSQL_VIS_TESTS !== '1' }, async () => {
    require('dotenv').config({ quiet: true });
    const db = require('../config/db');
    const connection = await db.connect();
    const transaction = { query: connection.query, beginTransaction: connection.beginTransaction.bind(connection),
        commit: connection.commit.bind(connection), rollback: connection.rollback.bind(connection), release() {} };
    try {
        const available = await connection.query("SELECT id, team_id, number FROM players WHERE team_id IS NOT NULL AND CAST(number AS CHAR) REGEXP '^[0-9]+$' LIMIT 1");
        assert.ok(available.rows.length, 'Integration fixture needs an existing player with a jersey number');
        const player = available.rows[0];
        // Shadow only on this connection; do not modify real matches or events.
        await connection.query(`CREATE TEMPORARY TABLE matches (
            id INT PRIMARY KEY, competition_id INT, age_group_id INT, gender VARCHAR(20),
            home_team_id INT, away_team_id INT, current_set INT, left_side_team_id INT,
            team_a_score INT, team_b_score INT, home_set_score INT, away_set_score INT,
            status VARCHAR(20), winner_team_id INT, set_scores JSON, live_state JSON, vis_state JSON
        )`);
        await connection.query(`CREATE TEMPORARY TABLE match_sets (match_id INT, set_number INT, home_score INT, away_score INT, end_time DATETIME)`);
        await connection.query(`CREATE TEMPORARY TABLE match_lineups (match_id INT, set_number INT, team_id INT)`);
        await connection.query(`CREATE TEMPORARY TABLE match_events (
            id INT AUTO_INCREMENT PRIMARY KEY, match_id INT, set_id INT, team_id INT, player_id INT,
            skill VARCHAR(64), grade VARCHAR(32), score_home INT, score_away INT, server_player_id INT,
            details JSON, created_at DATETIME
        )`);
        await connection.query(`CREATE TEMPORARY TABLE match_actions (
            id INT AUTO_INCREMENT PRIMARY KEY, match_id INT, set_number INT, action_type VARCHAR(20),
            team_id INT, player_id INT, skill VARCHAR(10), grade VARCHAR(5), score_home INT,
            score_away INT, description TEXT, created_at DATETIME
        )`);
        const live = { workflowStep: 'RALLY', scoringSource: 'escore', matchData: { currentSet: 1 },
            score: { home: 8, away: 4 }, homeLineup: [player.id], awayLineup: [999999], servingTeam: 'home' };
        await connection.query(`INSERT INTO matches (id,home_team_id,away_team_id,current_set,team_a_score,team_b_score,home_set_score,away_set_score,status,live_state)
            VALUES (1,?,?,1,8,4,0,0,'live',?)`, [player.team_id, player.team_id + 1, JSON.stringify(live)]);
        const context = { exports: {}, console, require: name => {
            if (name === '../config/db') return { connect: async () => transaction };
            if (name === '../utils/visWorkflow') return require('../utils/visWorkflow');
            if (name === '../utils/visEventCode') return require('../utils/visEventCode');
            throw new Error(name);
        } };
        vm.runInNewContext(fs.readFileSync(require.resolve('../controllers/visController'), 'utf8'), context);
        const invoke = async body => {
            const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; } };
            await context.exports.command({ params: { matchId: 1 }, body, app: { get: () => null } }, res);
            assert.equal(res.code, 200, JSON.stringify(res.body));
            return res.body;
        };
        const match = (await connection.query('SELECT * FROM matches WHERE id=1')).rows[0];
        const state = projectOfficialState(match, [], [], []).state;
        const operation = { operationId: 'mysql-vis-operation-0001', revision: 0,
            command: { type: 'STAT', skill: 'S', grade: '#', team: 'home', player: player.id, context: { key: state.context.key } } };
        const saved = await invoke(operation);
        assert.equal(saved.state.score.home, 8);
        assert.equal(saved.event.event_code, `S${Number(player.number)}#`);
        const after = (await connection.query('SELECT * FROM matches WHERE id=1')).rows[0];
        assert.equal(JSON.stringify(after.live_state), JSON.stringify(match.live_state));
        assert.equal(after.team_a_score, 8);
        assert.equal(after.status, 'live');
        const savedAction = (await connection.query('SELECT * FROM match_actions')).rows[0];
        assert.equal(savedAction.action_type, 'VIS_STAT');
        assert.equal(savedAction.skill, 'S');
        assert.equal(JSON.parse(savedAction.description).event_code, `S${Number(player.number)}#`);
        live.score.home = 9;
        await connection.query('UPDATE matches SET live_state=?,team_a_score=9 WHERE id=1', [JSON.stringify(live)]);
        await connection.query("INSERT INTO match_events (match_id,set_id,skill,score_home,score_away,details) VALUES (1,1,'POINT',9,4,?)", [JSON.stringify({ vis: false, scoringSource: 'escore' })]);
        const retry = await invoke(operation);
        assert.equal(retry.duplicate, true);
        assert.equal(retry.state.score.home, 9);
        await invoke({ operationId: 'mysql-vis-undo-operation-0001', revision: 1, command: { type: 'UNDO' } });
        const remainingEvents = (await connection.query('SELECT * FROM match_events')).rows;
        assert.equal(remainingEvents.length, 1);
        assert.equal(remainingEvents[0].skill, 'POINT');
        assert.equal((await connection.query('SELECT * FROM match_actions')).rows.length, 0);
        assert.equal((await connection.query('SELECT team_a_score FROM matches WHERE id=1')).rows[0].team_a_score, 9);
        assert.equal((await connection.query('SELECT * FROM match_sets')).rows.length, 0);
    } finally {
        await connection.rollback();
        await connection.query('DROP TEMPORARY TABLE IF EXISTS matches, match_events, match_actions, match_sets, match_lineups');
        connection.release();
        await db.pool.end();
    }
});
