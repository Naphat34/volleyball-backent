const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DB_PROVIDER = 'postgres';
const { setup, invoke } = require('./helpers/postgresHarness');
const { loadTeamRosterEntries, syncTeamEntries, confirmEntryRoster } = require('../utils/automaticEntryRoster');
const { setupPlayers } = require('../utils/matchSetup');

test('only Live freezes rosters; setup, lineups, dates and registration closure do not', async () => {
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
        assert.equal(entries[0].roster_locked_at,null);
        assert.equal(entries[1].roster_locked_at,null);
        assert.equal((await c.query('SELECT player_id FROM team_entry_players WHERE team_entry_id=2')).rows[0].player_id,2);
        assert.deepEqual(setupPlayers({status:'scheduled',match_setup:{away:{players:[]}}},'away',[{id:2}],{fillEmpty:true}),[{id:2}]);
        await c.query('INSERT INTO match_lineups(match_id,team_id,set_number) VALUES(?,2,1)',[match.insertId]);
        const awayEntries = await loadTeamRosterEntries(c,2);
        assert.equal(Number(awayEntries.find(e=>e.id===2).has_history),1);
        await syncTeamEntries(c,2);
        assert.equal((await c.query('SELECT roster_locked_at FROM team_entries WHERE id=2')).rows[0].roster_locked_at,null);
        await assert.rejects(confirmEntryRoster(c, 2, 2), /Live/);
        await assert.rejects(confirmEntryRoster(c, 2, 1), /not found/);
        await c.query("UPDATE competitions SET status='closed',start_date='2020-01-01' WHERE id=?",[comp.insertId]);
        await c.query("UPDATE team_entries SET roster_locked_at=CURRENT_TIMESTAMP WHERE id=2");
        await syncTeamEntries(c,2);
        assert.equal((await c.query('SELECT roster_locked_at FROM team_entries WHERE id=2')).rows[0].roster_locked_at,null);
        await c.query("UPDATE matches SET status='live' WHERE id=?",[match.insertId]);
        await syncTeamEntries(c,1);
        await syncTeamEntries(c,2);
        assert.ok((await c.query('SELECT roster_locked_at FROM team_entries WHERE id=1')).rows[0].roster_locked_at);
        assert.ok((await c.query('SELECT roster_locked_at FROM team_entries WHERE id=2')).rows[0].roster_locked_at);
        await confirmEntryRoster(c,1,1);
        await c.query("UPDATE matches SET status='completed' WHERE id=?",[match.insertId]);
        await syncTeamEntries(c,1);
        assert.ok((await c.query('SELECT roster_locked_at FROM team_entries WHERE id=1')).rows[0].roster_locked_at);
        await c.rollback();
    } catch (error) { await c.rollback(); throw error; }
    finally { c.release(); await h.close(); }
});

test('saved lineup retains shirt numbers and names after team register changes', async () => {
    const h = await setup();
    try {
        const db = h.db;
        await db.query("INSERT INTO teams(id,name,code,gender) VALUES(1,'Home','HOME','Male'),(2,'Away','AWAY','Male')");
        const comp = await db.query("INSERT INTO competitions(title,sport,gender,start_date,status,max_players) VALUES('Snapshot cup','Volleyball','Male','2099-01-01','open',14) RETURNING id");
        for (let id=1;id<=6;id++) await db.query("INSERT INTO players(id,team_id,number,first_name,gender) VALUES(?,1,?,'Original','Male')",[id,id]);
        const match = await db.query("INSERT INTO matches(competition_id,home_team_id,away_team_id,status) VALUES(?,1,2,'scheduled') RETURNING id",[comp.insertId]);
        const controllerPath = require.resolve('../controllers/scorerController');
        delete require.cache[controllerPath];
        const controller = require(controllerPath);
        const saved = await invoke(controller,'saveLineup',{team_id:1,set_number:1,player_positions:[1,2,3,4,5,6],libero_id:null},{matchId:match.insertId});
        assert.equal(saved.code,200,JSON.stringify(saved.data));
        await db.query("UPDATE players SET number=99,first_name='Changed' WHERE id=1");
        const response = await invoke(controller,'getMatchLineup',{}, {matchId:match.insertId});
        assert.equal(response.code,200);
        assert.equal(response.data[0].lineup[0].number,1);
        assert.equal(response.data[0].lineup[0].first_name,'Original');
        delete require.cache[controllerPath];
    } finally { await h.close(); }
});

test('starting a set syncs the latest team athletes before the Live lock', async () => {
    const h = await setup();
    try {
        const db = h.db;
        await db.query("INSERT INTO age_groups(id,name) VALUES(1,'Open')");
        await db.query("INSERT INTO teams(id,name,code,gender) VALUES(1,'Home','HOME','Male'),(2,'Away','AWAY','Male')");
        const comp = await db.query("INSERT INTO competitions(title,sport,gender,age_group_id,start_date,status,max_players) VALUES('Start cup','Volleyball','Male',1,'2099-01-01','closed',14) RETURNING id");
        await db.query('INSERT INTO team_entries(team_id,competition_id) VALUES(1,?),(2,?)',[comp.insertId,comp.insertId]);
        await db.query("INSERT INTO players(team_id,number,first_name,gender) VALUES(1,1,'Home','Male'),(2,2,'Away','Male')");
        const match = await db.query("INSERT INTO matches(competition_id,home_team_id,away_team_id,status) VALUES(?,1,2,'scheduled') RETURNING id",[comp.insertId]);
        await db.query('UPDATE matches SET match_setup=? WHERE id=?',[JSON.stringify({home:{name:'Home',players:[{id:999,number:99}]},away:{name:'Away',players:[]}}),match.insertId]);
        const controllerPath = require.resolve('../controllers/scorerController');
        delete require.cache[controllerPath];
        const controller = require(controllerPath);
        const response = await invoke(controller,'startSet',{setNumber:1},{matchId:match.insertId});
        assert.equal(response.code,200,JSON.stringify(response.data));
        assert.equal((await db.query('SELECT status FROM matches WHERE id=?',[match.insertId])).rows[0].status,'live');
        const entries = (await db.query('SELECT roster_locked_at FROM team_entries')).rows;
        assert.equal(entries.length,2);
        assert.ok(entries.every(row => row.roster_locked_at));
        assert.equal((await db.query('SELECT COUNT(*) AS count FROM team_entry_players')).rows[0].count,2);
        const frozenSetup = (await db.query('SELECT match_setup FROM matches WHERE id=?',[match.insertId])).rows[0].match_setup;
        const setup = typeof frozenSetup === 'string' ? JSON.parse(frozenSetup) : frozenSetup;
        assert.equal(setup.home.players.length,1);
        assert.equal(setup.away.players.length,1);
        assert.equal(setup.home.players[0].number,1);
        delete require.cache[controllerPath];
    } finally { await h.close(); }
});
