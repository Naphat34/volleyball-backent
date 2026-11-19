const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');

test('manual selection, confirmation, scope, stale edits and locked approval preserve historical matches',async()=>{
    const h=await setup();
    try{
        delete require.cache[require.resolve('../controllers/teamDataController')];
        const d=h.db,c=require('../controllers/teamDataController');
        await d.query("INSERT INTO teams(id,name,code,gender) VALUES(1,'Home','HOME','Male'),(2,'Away','AWAY','Male')");
        await d.query("INSERT INTO users(id,username,password_hash,role,team_id,status) VALUES(1,'Team','x','team_staff',1,'active'),(2,'Other','x','team_staff',2,'active'),(3,'Admin','x','super_admin',NULL,'active'),(4,'ScoreAdmin','x','super_admin_scorer',NULL,'active')");
        await d.query("INSERT INTO age_groups(id,name) VALUES(1,'Open')");
        await d.query("INSERT INTO competitions(id,title,sport,gender,age_group_id,start_date,max_players) VALUES(1,'Cup','volleyball','Male',1,'2026-11-19',14)");
        await d.query('INSERT INTO team_entries(id,competition_id,team_id,age_group_id) VALUES(1,1,1,1),(2,1,2,1)');
        for(let id=1;id<=7;id++)await d.query("INSERT INTO players(id,team_id,number,first_name,last_name,gender,position,birth_date) VALUES(?,1,?,?,?,'Male','OH','2010-01-01')",[id,id,'Player'+id,'Family']);
        await d.query("INSERT INTO team_staff(id,team_id,first_name,last_name,role) VALUES(1,1,'Original','Coach','Head Coach')");
        const team={id:1,role:'team_staff'},admin={id:3,role:'super_admin'};
        const call=(method,body={},params={},user=team)=>invoke(c,method,body,params,user);
        let overview=await call('overview');assert.equal(overview.code,200,JSON.stringify(overview.data));assert.equal(overview.data.entries[0].roster_confirmed_at,null);
        assert.equal(Number((await d.query('SELECT count(*) AS n FROM team_entry_players')).rows[0].n),0,'master register must not auto-select players');
        assert.equal((await call('entry',{}, {entryId:1},{id:2,role:'team_staff'})).code,404);
        const state=(await call('entry',{}, {entryId:1})).data;
        const players=Array.from({length:6},(_,i)=>({player_id:i+1,number:i+1,role:'OH',master_revision:0}));
        let payload={players,staff_ids:[1],revision:state.entry.roster_revision,confirm:true};
        let result=await call('saveEntry',payload,{entryId:1});assert.equal(result.code,200,JSON.stringify(result.data));
        assert.equal((await call('saveEntry',payload,{entryId:1})).code,409,'stale selection cannot overwrite a confirmation');
        await d.query("UPDATE players SET first_name='Revised',master_revision=master_revision+1 WHERE id=1");
        const refreshed=await call('overview');assert.equal(refreshed.code,200);
        assert.equal(refreshed.data.entries[0].roster_confirmed_at,null,'selected master identity changes require reconfirmation');
        assert.equal((await d.query('SELECT count(*) AS n FROM team_entry_players WHERE team_entry_id=1')).rows[0].n,6,'master edits never auto-add a seventh athlete');
        players[0].master_revision=1;
        result=await call('saveEntry',{...payload,players,revision:refreshed.data.entries[0].roster_revision},{entryId:1});assert.equal(result.code,200,JSON.stringify(result.data));
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,age_group_id,status,team_a_score,team_b_score) VALUES(1,1,1,2,1,'completed',3,0)");
        assert.equal((await call('saveEntry',{...payload,revision:result.data.revision},{entryId:1})).code,409);
        payload={...payload,revision:result.data.revision,reason:'Replace sixth athlete',players:[...players.slice(0,5),{player_id:7,number:7,role:'OH',master_revision:0}]};
        result=await call('requestChange',payload,{entryId:1});assert.equal(result.code,200,JSON.stringify(result.data));
        const requestId=result.data.id;
        assert.equal((await call('decideRequest',{request_id:requestId,decision:'approved',reason:'Verified change'}, {},{id:4,role:'super_admin_scorer'})).code,403);
        result=await call('decideRequest',{request_id:requestId,decision:'approved',reason:'Verified change'}, {},admin);assert.equal(result.code,200,JSON.stringify(result.data));
        const match=(await d.query('SELECT * FROM matches WHERE id=1')).rows[0],snapshot=typeof match.match_setup==='string'?JSON.parse(match.match_setup):match.match_setup;
        assert.equal(match.team_a_score,3);assert.equal(match.team_b_score,0);
        assert.deepEqual(snapshot.home.players.map(p=>p.id),[1,2,3,4,5,6]);
        assert.deepEqual((await d.query('SELECT player_id FROM team_entry_players WHERE team_entry_id=1 ORDER BY player_id')).rows.map(p=>p.player_id),[1,2,3,4,5,7]);
        result=await call('saveStaff',{first_name:'Updated',last_name:'Coach',role:'Head Coach',master_revision:0},{id:1});assert.equal(result.code,200,JSON.stringify(result.data));
        const historical=(await d.query('SELECT match_setup FROM matches WHERE id=1')).rows[0].match_setup;
        assert.equal((typeof historical==='string'?JSON.parse(historical):historical).home.staff[0].first_name,'Original');
        assert.equal((await call('saveStaff',{first_name:'Stale',last_name:'Coach',role:'Head Coach',master_revision:0},{id:1})).code,409);
        assert.ok((await call('history')).data.length>=4);
    }finally{await h.close();}
});

test('duplicate staff, archive, atomic bulk and recording confirmation guards',async()=>{
    const h=await setup();
    try{
        delete require.cache[require.resolve('../controllers/teamDataController')];
        const d=h.db,c=require('../controllers/teamDataController'),user={id:1,role:'team_staff'};
        await d.query("INSERT INTO teams(id,name,code,gender) VALUES(1,'Home','HOME','Male'),(2,'Away','AWAY','Male')");
        await d.query("INSERT INTO users(id,username,password_hash,role,team_id,status) VALUES(1,'Team','x','team_staff',1,'active')");
        await d.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Cup','volleyball','Male')");
        await d.query('INSERT INTO team_entries(id,team_id,competition_id) VALUES(1,1,1)');
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status) VALUES(1,1,1,2,'scheduled')");
        const guard=require('../utils/manualTeamRoster').assertManualRostersReady;
        await assert.rejects(guard(d,1),/confirm/);
        await d.query('UPDATE team_entries SET roster_confirmed_at=CURRENT_TIMESTAMP WHERE id=1');
        await guard(d,1);
        const call=(method,body={},params={})=>invoke(c,method,body,params,user);
        let res=await call('saveStaff',{first_name:'Alex',last_name:'Coach',role:'Head Coach'});assert.equal(res.code,200,JSON.stringify(res.data));
        const id=res.data.id;
        res=await call('saveStaff',{first_name:'Alex',last_name:'Coach',role:'Head Coach'});assert.equal(res.code,409);assert.equal(res.data.duplicate,'similar');
        res=await call('saveStaff',{first_name:'Second',last_name:'Coach',role:'Assistant Coach'});assert.equal(res.code,200);const second=res.data.id;
        res=await call('bulk',{kind:'staff',items:[{id,revision:0},{id:second,revision:8}],patch:{is_active:0}});assert.equal(res.code,409);
        assert.equal((await d.query('SELECT is_active FROM team_staff WHERE id=?',[id])).rows[0].is_active,1,'bulk failure rolls back earlier records');
        res=await call('staffStatus',{is_active:0,master_revision:0},{id});assert.equal(res.code,200,JSON.stringify(res.data));
        assert.equal((await d.query('SELECT count(*) AS n FROM team_staff')).rows[0].n,2,'archive retains records');
    }finally{await h.close();}
});
