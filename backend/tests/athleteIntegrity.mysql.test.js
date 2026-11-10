const test = require('node:test');
const assert = require('node:assert/strict');

test('MySQL enforces athlete numbers, roles, and retained references without changing production rows', {skip: process.env.RUN_ATHLETE_MYSQL !== '1'}, async()=>{
    const db=require('../config/db');
    const connection=await db.connect();
    try {
        await connection.beginTransaction();
        const team=await connection.query('INSERT INTO teams(name,code) VALUES(?,?)',['Integrity test','Q'+Date.now().toString(36).slice(-8)]);
        const teamId=team.insertId;
        const competition=await connection.query('SELECT id FROM competitions ORDER BY id LIMIT 1');
        assert.ok(competition.rows.length,'A competition is required for the rollback-only test');
        const entry=await connection.query('INSERT INTO team_entries(team_id,competition_id) VALUES(?,?)',[teamId,competition.rows[0].id]);
        const player=await connection.query("INSERT INTO players(team_id,number,first_name,position,is_libero1) VALUES(?,7,'Fixture','L',1)",[teamId]);
        const second=await connection.query("INSERT INTO players(team_id,number,first_name,position) VALUES(?,8,'Fixture','OH')",[teamId]);
        await assert.rejects(connection.query('UPDATE players SET is_libero2=1 WHERE id=?',[player.insertId]),error=>error.code==='ER_CHECK_CONSTRAINT_VIOLATED');
        await assert.rejects(connection.query("UPDATE players SET position='L',is_libero1=1 WHERE id=?",[second.insertId]),error=>error.code==='ER_DUP_ENTRY');
        await connection.query("INSERT INTO team_entry_players(team_entry_id,player_id,number,role) VALUES(?,?,7,'L')",[entry.insertId,player.insertId]);
        await assert.rejects(connection.query('INSERT INTO team_entry_players(team_entry_id,player_id,number) VALUES(?,?,7)',[entry.insertId,second.insertId]),error=>error.code==='ER_DUP_ENTRY');
        await connection.query('UPDATE players SET number=22 WHERE id=?',[player.insertId]);
        const snapshot=await connection.query('SELECT number FROM team_entry_players WHERE player_id=?',[player.insertId]);
        assert.equal(snapshot.rows[0].number,7);
        await connection.query('UPDATE players SET is_active=0,is_playing=0 WHERE id=?',[player.insertId]);
        const retained=await connection.query('SELECT player_id FROM team_entry_players WHERE player_id=?',[player.insertId]);
        assert.equal(retained.rows.length,1);
        // A link is a real FK, independent of editable/offline match JSON.
        const customId='custom-integrity-'+Date.now();
        await connection.query('INSERT INTO custom_vis_matches(id,owner_id,public_token,payload) VALUES(?,1,?,?)',[customId,customId+'-token','{}']);
        await connection.query("INSERT INTO custom_vis_player_links(match_id,side,local_player_id,player_id,linked_by) VALUES(?,'home',1,?,1)",[customId,player.insertId]);
        await assert.rejects(connection.query('DELETE FROM players WHERE id=?',[player.insertId]),error=>error.code==='ER_ROW_IS_REFERENCED_2');
        const rules=await connection.query("SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='players' AND TABLE_NAME IN ('match_actions','match_events','match_lineups')");
        assert.equal(rules.rows.length,10);assert.ok(rules.rows.every(row=>row.DELETE_RULE==='RESTRICT'));
    } finally {await connection.rollback();connection.release();await db.pool.end();}
});
