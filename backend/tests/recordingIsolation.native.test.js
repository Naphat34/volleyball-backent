const {publicTestUrl}=require('./helpers/publicTestUrl');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomBytes}=require('node:crypto');
const {Client}=require('pg');
const jwt=require('jsonwebtoken'),dotenv=require('dotenv');
const {localOptions}=require('../scripts/migrateLocalAccess');
test('native recording isolation covers encoded IDs, domains, leases and assignment revocation',{
    skip:process.env.RUN_LOCAL_ACCESS_TESTS!=='1',timeout:30000,
},async()=>{
    const env=dotenv.parse(fs.readFileSync(path.join(__dirname,'../.env'))),options=localOptions(env);
    const schema='volley_step5_test_'+randomBytes(8).toString('hex'),admin=new Client(options);
    let db,server,locker;
    try{
        await admin.connect();
        for(const file of ['001_baseline.sql','002_json_helpers.sql','003_public_uuid_identifiers.sql','004_access_control.sql','005_bilingual_official_names.sql','006_custom_vis_public_ids.sql','007_competition_workflows.sql'])await admin.query(fs.readFileSync(path.join(__dirname,'../migrations/postgres',file),'utf8').replace(/\bvolley\b/g,schema));
        for(const key of ['DB_PROVIDER','DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','DB_SSL','JWT_SECRET'])if(env[key]!==undefined)process.env[key]=env[key];
        delete process.env.DATABASE_URL;process.env.DB_PG_SCHEMA=schema;process.env.DB_POSTGRES_PREVIEW='true';
        db=require('../config/db');
        for(const [id,role]of [[1,'super_admin'],[2,'scorer'],[3,'vims_operator'],[4,'super_admin_scorer'],[5,'super_admin_vims'],[6,'organizer'],[7,'team_staff'],[8,'referee']])await db.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(?,?,'x',?,'active')",[id,'Fixture'+id,role]);
        await db.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(1,'Allowed','volleyball','Male',3),(2,'Outside','volleyball','Male',3)");
        for(const id of [2,3,4,5])await db.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(?,1)',[id]);
        await db.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','H'),(2,'Away','A')");
        for(const team of [1,2])for(let i=1;i<=6;i++)await db.query("INSERT INTO players(id,team_id,number,first_name,last_name,gender,position) VALUES(?,?,?,'Player',?,'Male','OH')",[team===1?i:1000+i,team,i,String(i)]);
        await db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,live_state) VALUES(1,1,1,2,'live','{}'),(10,2,1,2,'live','{}')");
        const setup={title:'Fixture',maxSets:3,pointsPerSet:25,decidingSetPoints:15,gender:'Male'};
        for(const side of ['home','away'])setup[side]={name:side,players:Array.from({length:6},(_,i)=>({id:side==='home'?i+1:1001+i,number:i+1,first_name:'Player',last_name:String(i),position:'OH',is_playing:1}))};
        await db.query('UPDATE matches SET match_setup=? WHERE id=1',[JSON.stringify(setup)]);
        await db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,manual_owner_id,manual_lifecycle,manual_vis_shared) VALUES(20,1,1,2,'scheduled',2,'ready',1)");
        const {app}=require('../server');server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
        const origin=`http://127.0.0.1:${server.address().port}/api`;
        const publicFetch=async(url,options)=>fetch(await publicTestUrl(db,url),options);
        const token=async id=>jwt.sign((await db.query('SELECT id,role,authorization_version FROM users WHERE id=?',[id])).rows[0],env.JWT_SECRET,{expiresIn:'5m'});
        const request=async(id,url,method='POST',body={})=>{
            const res=await publicFetch(origin+url,{method,headers:{Authorization:'Bearer '+await token(id),'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
            return {status:res.status,body:await res.json()};
        };
        for(const id of [1,2,3,4,5,6,7,8])for(const endpoint of ['/event','/vis','/offline-sync','/vis-offline-sync']){
            const result=await request(id,'/scorer/match/1'+endpoint);
            const allowed=id===2&&['/event','/offline-sync'].includes(endpoint)||id===3&&['/vis','/vis-offline-sync'].includes(endpoint);
            if(allowed)assert.ok([400,409].includes(result.status),JSON.stringify({id,endpoint,result}));
            else assert.equal(result.status,403,JSON.stringify({id,endpoint,result}));
        }
        const state={state:{score:{home:1,away:0},setsWon:{home:0,away:0},workflowStep:'MATCH'}};
        for(const id of ['10','1%30','%31%30','1%2530','1%2f0','1%5c0']){
            for(const suffix of ['/state','/offline-sync','/vis-offline-sync']){
                const result=await request(suffix.startsWith('/vis')?3:2,`/scorer/match/${id}${suffix}`,suffix==='/state'?'PUT':'POST',state);
                assert.ok([400,403].includes(result.status),JSON.stringify({id,suffix,result}));
            }
        }
        assert.deepEqual(JSON.parse((await db.query('SELECT live_state FROM matches WHERE id=10')).rows[0].live_state),{});
        assert.equal((await request(2,'/scorer/match/%31/state','PUT',state)).status,200);
        const before=(await db.query('SELECT live_state,team_a_score,team_b_score FROM matches WHERE id=1')).rows[0];
        const lineup={operationId:'stage-five-lineup-operation',revision:0,command:{type:'SET_LINEUP',lineups:{home:[1,2,3,4,5,6],away:[1001,1002,1003,1004,1005,1006]},servingTeam:'home',firstSetHomeLeft:true}};
        const saved=await request(3,'/scorer/match/1/vis','POST',lineup);assert.equal(saved.status,200,JSON.stringify(saved));
        assert.deepEqual((await db.query('SELECT live_state,team_a_score,team_b_score FROM matches WHERE id=1')).rows[0],before);
        const deviceId='stage-five-device-0001';
        const checkout=await request(3,'/scorer/match/1/vis-offline-checkout','POST',{deviceId});
        assert.equal(checkout.status,200,JSON.stringify(checkout));
        assert.equal((await request(2,'/scorer/match/1/state','PUT',state)).status,409);
        const payload=checkout.body.payload;
        const rally={operationId:'stage-five-offline-rally',revision:payload.revision,command:{type:'RALLY',events:[{team:'home',player:1,skill:'A',grade:'#'}],context:{key:require('../utils/customVis').view(payload).state.context.key}}};
        const syncBody={deviceId,offlineSession:payload.offlineSession,baseRevision:payload.revision,operations:[rally],release:false};
        const synced=await request(3,'/scorer/match/1/vis-offline-sync','POST',syncBody);
        assert.equal(synced.status,200,JSON.stringify(synced));
        assert.equal((await request(3,'/scorer/match/1/vis-offline-sync','POST',syncBody)).status,200);
        assert.equal(Number((await db.query("SELECT COUNT(*) AS count FROM match_actions WHERE match_id=1 AND action_type='VIS_STAT'")).rows[0].count),1);
        assert.deepEqual((await db.query('SELECT live_state,team_a_score,team_b_score FROM matches WHERE id=1')).rows[0],before);
        const release=await request(3,'/scorer/match/1/vis-offline-release','POST',{deviceId,offlineSession:checkout.body.payload.offlineSession});
        assert.equal(release.status,200,JSON.stringify(release));
        assert.equal((await request(2,'/scorer/match/1/state','PUT',state)).status,200);
        const scoreCheckout=await request(2,'/scorer/match/1/offline-checkout','POST',{deviceId});
        assert.equal(scoreCheckout.status,200,JSON.stringify(scoreCheckout));
        assert.equal((await request(3,'/scorer/match/1/vis-offline-checkout','POST',{deviceId})).status,409);
        const cancel=await request(2,'/scorer/match/1/offline-cancel-checkout','POST',{deviceId,checkoutToken:scoreCheckout.body.checkoutToken,fingerprint:scoreCheckout.body.fingerprint});
        assert.equal(cancel.status,200,JSON.stringify(cancel));
        const visBefore=(await db.query('SELECT vis_state FROM matches WHERE id=1')).rows[0].vis_state;
        const reserved=await request(2,'/scorer/match/1/offline-checkout','POST',{deviceId});assert.equal(reserved.status,200);
        const scoreSync={deviceId,fingerprint:reserved.body.fingerprint,release:true,operations:[
            {id:'stage-five-score-point-01',method:'POST',path:'event',at:Date.now(),body:{event_type:'POINT',set_number:1,team_id:1,score_home:2,score_away:0,local_event_id:'stage5-point-01'}},
            {id:'stage-five-score-state-01',method:'PUT',path:'state',at:Date.now(),body:{state:{score:{home:2,away:0},setsWon:{home:0,away:0},matchData:{currentSet:1},workflowStep:'MATCH'}}},
        ]};
        const scoreSynced=await request(2,'/scorer/match/1/offline-sync','POST',scoreSync);assert.equal(scoreSynced.status,200,JSON.stringify(scoreSynced));
        assert.equal((await request(2,'/scorer/match/1/offline-sync','POST',scoreSync)).status,200);
        assert.equal(Number((await db.query('SELECT COUNT(*) AS count FROM match_events WHERE match_id=1')).rows[0].count),1);
        assert.deepEqual((await db.query('SELECT vis_state FROM matches WHERE id=1')).rows[0].vis_state,visBefore);
        // A pending claim must re-check the actor after waiting on the same resource lock.
        locker=new Client(require('../config/postgres').poolOptions({...env,DB_PG_SCHEMA:schema}));await locker.connect();await locker.query('BEGIN');
        await locker.query('SELECT pg_advisory_xact_lock(hashtext($1))',[require('../middleware/recordingLock').lockKey('match',20)]);
        let done=false;const pending=request(3,'/scorer/manual-vis-matches/0%3020/claim').then(result=>{done=true;return result;});
        await new Promise(r=>setTimeout(r,150));assert.equal(done,false);
        await db.query('UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=3 AND competition_id=1');
        await locker.query('ROLLBACK');assert.equal((await pending).status,403);
        assert.equal((await db.query('SELECT manual_vis_assignee_id FROM matches WHERE id=20')).rows[0].manual_vis_assignee_id,null);
        await db.query('UPDATE user_competition_access SET revoked_at=NULL WHERE user_id=3 AND competition_id=1');
        assert.equal((await request(3,'/scorer/manual-vis-matches/20/claim')).status,200);
        await locker.query('BEGIN');
        await locker.query('SELECT pg_advisory_xact_lock(hashtext($1))',[require('../middleware/recordingLock').lockKey('match',20)]);
        let released=false;const waitingRelease=request(3,'/scorer/manual-vis-matches/20/release').then(result=>{released=true;return result;});
        await new Promise(r=>setTimeout(r,150));assert.equal(released,false);
        await db.query('UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=3 AND competition_id=1');
        await locker.query('ROLLBACK');assert.equal((await waitingRelease).status,403);
        assert.equal(Number((await db.query('SELECT manual_vis_assignee_id FROM matches WHERE id=20')).rows[0].manual_vis_assignee_id),3);
    }finally{
        if(locker){await locker.query('ROLLBACK').catch(()=>{});await locker.end();}
        if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
        if(db)await db.pool.end();
        if(/^volley_step5_test_[0-9a-f]{16}$/.test(schema))await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await admin.end();
    }
});
