const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PROVIDER = 'postgres';
const { setup } = require('./helpers/postgresHarness');
const { loadTeamRosterEntries, syncTeamEntries } = require('../utils/automaticEntryRoster');
const { setupPlayers } = require('../utils/matchSetup');

test('a home lineup and setup lock only home; away can sync until its own roster is used', async () => {
    const h = await setup();
    const c = await h.db.connect();
    try {
        await c.beginTransaction();
        await c.query("INSERT INTO age_groups(id,name) VALUES(1,'U18'),(2,'U16')");
        await c.query("INSERT INTO teams(id,name,code,gender) VALUES(1,'Home','HOME','Male'),(2,'Away','AWAY','Male')");
        const comp = await c.query("INSERT INTO competitions(title,sport,gender,age_group_id,start_date,status,max_players) VALUES('Cup','Volleyball','Male',1,'2099-01-01','open',14) RETURNING id");
        await c.query('INSERT INTO team_entries(id,team_id,competition_id,age_group_id) VALUES(1,1,?,1),(2,2,?,1)', [comp.insertId,comp.insertId]);
        await c.query("INSERT INTO players(id,team_id,number,first_name,gender,birth_date) VALUES(1,1,1,'Home','Male','2085-01-01'),(2,2,2,'Away','Male','2082-01-01')");
        const match = await c.query("INSERT INTO matches(competition_id,home_team_id,away_team_id,age_group_id,status,match_setup) VALUES(?,1,2,1,'scheduled',?) RETURNING id", [comp.insertId,JSON.stringify({home:{players:[{id:1}]},away:{players:[]}})]);
        await c.query('INSERT INTO match_lineups(match_id,team_id,set_number) VALUES(?,1,1)',[match.insertId]);
        assert.equal(Number((await loadTeamRosterEntries(c,1))[0].has_history),1);
        assert.equal(Number((await loadTeamRosterEntries(c,2))[0].has_history),0);
        await syncTeamEntries(c,1);
        await syncTeamEntries(c,2);
        const entries = (await c.query('SELECT id,roster_locked_at FROM team_entries ORDER BY id')).rows;
        assert.ok(entries[0].roster_locked_at);
        assert.equal(entries[1].roster_locked_at,null);
        assert.equal((await c.query('SELECT player_id FROM team_entry_players WHERE team_entry_id=2')).rows[0].player_id,2);
        assert.deepEqual(setupPlayers({status:'scheduled',match_setup:{away:{players:[]}}},'away',[{id:2}],{fillEmpty:true}),[{id:2}]);
        await c.query('INSERT INTO match_lineups(match_id,team_id,set_number) VALUES(?,2,1)',[match.insertId]);
        const awayEntries = await loadTeamRosterEntries(c,2);
        assert.equal(Number(awayEntries.find(e=>e.id===2).has_history),1);
        await syncTeamEntries(c,2);
        assert.ok((await c.query('SELECT roster_locked_at FROM team_entries WHERE id=2')).rows[0].roster_locked_at);
        await c.query("UPDATE matches SET status='live' WHERE id=?",[match.insertId]);
        assert.equal(Number((await loadTeamRosterEntries(c,2)).find(e=>e.id===2).has_history),1);
        await c.rollback();
    } catch (error) { await c.rollback(); throw error; }
    finally { c.release(); await h.close(); }
});
