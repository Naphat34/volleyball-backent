const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');
test('admin detail enforces scope, projects safe snapshot data and keeps reads free of writes',async t=>{
    const h=await setup();
    try{
        const d=h.db;
        await d.query(`INSERT INTO users(id,username,password_hash,role,status) VALUES
            (1,'Central','SECRET_HASH','super_admin','active'),(2,'ScoreAdmin','x','super_admin_scorer','active'),
            (3,'VimsAdmin','x','super_admin_vims','active'),(4,'Recorder','x','scorer','active'),(5,'Organizer','x','organizer','active')`);
        await d.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Visible','Volleyball','Male'),(2,'Hidden','Volleyball','Female')");
        for(const id of [2,3,5])await d.query('INSERT INTO user_competition_access(user_id,competition_id,granted_by) VALUES(?,1,1)',[id]);
        await d.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','H'),(2,'Away','A')");
        await d.query("INSERT INTO team_entries(id,team_id,competition_id,status) VALUES(1,1,1,'approved'),(2,2,1,'approved')");
        await d.query("INSERT INTO players(id,team_id,number,first_name,national_id) VALUES(1,1,7,'Current','9912345678901')");
        await d.query('INSERT INTO team_entry_players(team_entry_id,player_id,number,athlete_snapshot) VALUES(1,1,8,?)',[JSON.stringify({first_name:'Registered',birth_date:'2010-01-01'})]);
        const live=JSON.stringify({offlineLease:{checkoutToken:'SECRET_TOKEN'},matchSignatures:{captainA:'SECRET_SIGNATURE'},resultCorrection:{reviewRevision:2,signaturesRetained:true}});
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,live_state) VALUES(1,1,1,2,'scheduled',?),(2,2,1,2,'scheduled',?),(3,NULL,1,2,'scheduled',?)",[live,live,live]);
        await d.query("INSERT INTO match_reviews(match_id,domain,competition_id,revision,fingerprint,status,submitted_by) VALUES(1,'score',1,1,'secret','returned',4),(1,'score',1,2,'secret','submitted',4),(1,'vims',1,1,'secret','confirmed',4)");
        await d.query("INSERT INTO match_actions(match_id,set_number,action_type,skill) VALUES(1,1,'VIS_STAT','A')");
        const controller=require('../controllers/adminMatchDetailController');
        const get=(id,role='super_admin_scorer',userId=2,query={})=>invoke(controller,'detail',{}, {id}, {id:userId,role},query);
        await t.test('scope, role and strict ID validation apply to numeric and UUID links',async()=>{
            assert.equal((await get('2')).code,403);
            assert.equal((await get('3')).code,409);
            assert.equal((await get('1','scorer',4)).code,403);
            assert.equal((await get('1oops')).code,400);
            assert.equal((await get('1','super_admin_scorer',2,{eventPage:'no'})).code,400);
            const uuid=(await d.query('SELECT public_id FROM matches WHERE id=1')).rows[0].public_id;
            const numeric=await get('1'),byUuid=await get(uuid);
            assert.equal(byUuid.code,200);
            assert.equal(numeric.data.match.public_id,uuid);
            assert.deepEqual(byUuid.data.match,numeric.data.match);
            const deniedUuid=(await d.query('SELECT public_id FROM matches WHERE id=2')).rows[0].public_id;
            const forbidden=await get(deniedUuid);
            assert.equal(forbidden.code,403);
            assert.ok(!JSON.stringify(forbidden.data).includes(deniedUuid));
            const list=await invoke(require('../controllers/accessController'),'matches',{}, {}, {id:2,role:'super_admin_scorer'});
            assert.equal(list.data.matches[0].public_id,uuid);
            assert.equal((await get('2','super_admin',1)).code,200);
        });
        await t.test('safe roster snapshots and domain-specific actions exclude personal/session payloads',async()=>{
            const score=await get('1');assert.equal(score.code,200,JSON.stringify(score.data));
            assert.equal(score.data.roster.home.players[0].first_name,'Registered');
            assert.equal(score.data.roster.home.players[0].number,8);
            assert.deepEqual(score.data.latest.score.actions,['confirm','return']);
            assert.deepEqual(score.data.latest.vims.actions,[]);
            assert.equal(score.data.latest.score.revision,2);
            assert.equal(score.data.statisticCount,1);assert.equal(score.data.statistics.length,0);
            assert.equal(score.data.correction.signaturesRetained,true);
            assert.ok(!JSON.stringify(score.data).includes('SECRET_'));
            assert.ok(!JSON.stringify(score.data).includes('birth_date')); assert.ok(!JSON.stringify(score.data).includes('9912345678901'));
            const vims=await get('1','super_admin_vims',3);
            assert.deepEqual(vims.data.latest.vims.actions,['reopen']);
            assert.deepEqual(vims.data.latest.score.actions,[]);
            assert.equal(vims.data.statistics.length,1);
            const central=await get('1','super_admin',1);
            assert.deepEqual(central.data.latest.score.actions,[]);
            await d.query('UPDATE match_reviews SET submitted_by=2 WHERE match_id=1 AND domain=\'score\' AND revision=2');
            assert.deepEqual((await get('1')).data.latest.score.actions,[]);
        });
        await t.test('organizer detail is scope-limited and exposes only readonly review summaries',async()=>{
            const result=await get('1','organizer',5);assert.equal(result.code,200,JSON.stringify(result.data));
            assert.equal((await get('2','organizer',5)).code,403);
            assert.equal(result.data.roster.home.players.length,1);
            assert.equal(result.data.latest.score.revision,2);
            assert.deepEqual(result.data.latest.score.actions,[]);
            assert.deepEqual(result.data.latest.vims.actions,[]);
            assert.equal(result.data.latest.score.reason,undefined);
            assert.equal(result.data.latest.score.submitted_username,undefined);
            for(const field of ['reviews','history','events','statistics'])assert.deepEqual(result.data[field],[]);
            assert.equal(result.data.officials.length,4);
            assert.ok(result.data.officials.every(o=>Object.keys(o).every(k=>['role','name'].includes(k))));
            const c=require('../controllers/accessController');
            const deniedAction=await invoke(c,'review',{revision:2},{kind:'match',id:'1',domain:'score',action:'confirm'},{id:5,role:'organizer'});
            assert.equal(deniedAction.code,403);
            await d.query('UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=5');
            assert.equal((await get('1','organizer',5)).code,403);
        });
        await t.test('completed rosters use match snapshots and event pages are bounded',async()=>{
            const setup={title:'Saved match',gender:'Male',home:{name:'Saved home',players:[{id:1,number:9,first_name:'Match snapshot',national_id:'SECRET_SNAPSHOT'}],staff:[]},away:{name:'Saved away',players:[],staff:[]}};
            await d.query("UPDATE matches SET status='completed',match_setup=?,match_setup_revision=3 WHERE id=1",[JSON.stringify(setup)]);
            await d.query("INSERT INTO match_events(match_id,skill,details) SELECT 1,'POINT','{}' FROM generate_series(1,101)");
            const first=(await get('1')).data,second=(await get('1','super_admin_scorer',2,{eventPage:'2'})).data;
            assert.equal(first.roster.home.source,'match_snapshot');assert.equal(first.roster.home.players[0].number,9);
            assert.equal(first.events.length,100);assert.equal(second.events.length,1);assert.equal(first.eventTotal,101);
            assert.ok(!JSON.stringify(first).includes('SECRET_'));
            assert.equal((await d.query('SELECT roster_locked_at FROM team_entries WHERE id=1')).rows[0].roster_locked_at,null);
            assert.equal((await d.query('SELECT number FROM team_entry_players WHERE team_entry_id=1')).rows[0].number,8);
        });
    }finally{await h.close();}
});
