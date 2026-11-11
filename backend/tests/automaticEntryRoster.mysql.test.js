const test = require('node:test');
const assert = require('node:assert/strict');
const { syncTeamEntries, restoreSnapshot } = require('../utils/automaticEntryRoster');

test('MySQL automatic rosters sync master edits, archive players, and retain identity after closure (rollback only)', {skip:process.env.RUN_ROSTER_MYSQL !== '1'}, async () => {
    const db = require('../config/db');
    const c = await db.connect();
    try {
        await c.beginTransaction();
        const age = (await c.query("SELECT id FROM age_groups WHERE name IN ('Open','ประชาชน') LIMIT 1")).rows[0];
        assert.ok(age,'Open age group must exist');
        const team = await c.query('INSERT INTO teams(name,code,gender) VALUES(?,?,?)',['Auto roster fixture','R'+Date.now().toString(36).slice(-8),'Male']);
        const comp = await c.query(`INSERT INTO competitions(title,sport,gender,age_group_id,start_date,end_date,status,max_players,max_sets)
            VALUES ('Automatic roster fixture','Volleyball','Male',?,DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY),DATE_ADD(CURRENT_DATE,INTERVAL 31 DAY),'open',14,3)`,[age.id]);
        const entry = await c.query('INSERT INTO team_entries(team_id,competition_id,gender) VALUES(?,?,?)',[team.insertId,comp.insertId,'Male']);
        const player = await c.query("INSERT INTO players(team_id,number,first_name,last_name,position,gender) VALUES(?,7,'Original','Athlete','OH','Male')",[team.insertId]);
        const read = async () => (await c.query('SELECT p.*,ep.number AS entry_number,ep.athlete_snapshot FROM team_entry_players ep JOIN players p ON p.id=ep.player_id WHERE ep.team_entry_id=?',[entry.insertId])).rows.map(restoreSnapshot);
        await syncTeamEntries(c,team.insertId);
        assert.equal((await read())[0].entry_number,7);
        await c.query('UPDATE players SET number=8 WHERE id=?',[player.insertId]);
        await syncTeamEntries(c,team.insertId);
        assert.equal((await read())[0].entry_number,8);
        const second = await c.query("INSERT INTO players(team_id,number,first_name,last_name,position,gender) VALUES(?,9,'Second','Athlete','OH','Male')",[team.insertId]);
        await assert.rejects(c.query('UPDATE players SET number=8 WHERE id=?',[second.insertId]),e=>e.code==='ER_DUP_ENTRY');
        await assert.rejects(c.query("INSERT INTO players(team_id,number,first_name,gender) VALUES(?,8,'Duplicate','Male')",[team.insertId]),e=>e.code==='ER_DUP_ENTRY');
        await c.query('UPDATE players SET is_active=0 WHERE id=?',[second.insertId]);
        await c.query('UPDATE players SET is_active=0 WHERE id=?',[player.insertId]);
        await syncTeamEntries(c,team.insertId);
        assert.equal((await read()).length,0);
        const reused = await c.query("INSERT INTO players(team_id,number,first_name,gender) VALUES(?,8,'Reused','Male')",[team.insertId]);
        await assert.rejects(c.query('UPDATE players SET is_active=1 WHERE id=?',[player.insertId]),e=>e.code==='ER_DUP_ENTRY');
        await c.query('UPDATE players SET is_active=0 WHERE id=?',[reused.insertId]);
        await c.query('UPDATE players SET is_active=1 WHERE id=?',[player.insertId]);
        await syncTeamEntries(c,team.insertId);
        await c.query("UPDATE competitions SET status='closed' WHERE id=?",[comp.insertId]);
        await syncTeamEntries(c,team.insertId);
        await c.query("UPDATE players SET first_name='Changed',number=9,is_active=0 WHERE id=?",[player.insertId]);
        await syncTeamEntries(c,team.insertId);
        const saved = (await read())[0];
        assert.equal(saved.first_name,'Original');assert.equal(saved.entry_number,8);
        await c.query("UPDATE competitions SET status='open' WHERE id=?",[comp.insertId]);
        await syncTeamEntries(c,team.insertId);
        assert.equal((await read())[0].entry_number,8,'reopening must not unlock a frozen roster');
    } finally { await c.rollback();c.release();await db.pool.end(); }
});
