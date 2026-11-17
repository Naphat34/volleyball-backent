const {publicTestUrl}=require('./helpers/publicTestUrl');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {randomBytes}=require('node:crypto');
const {Client}=require('pg');
const jwt=require('jsonwebtoken');
const dotenv=require('dotenv');
const {localOptions}=require('../scripts/migrateLocalAccess');
const {poolOptions}=require('../config/postgres');
test('real local PostgreSQL serializes recording/review and rejects a grant revoked while a writer waits',{
    skip:process.env.RUN_LOCAL_ACCESS_TESTS!=='1',timeout:30000,
},async()=>{
    const env=dotenv.parse(fs.readFileSync(path.join(__dirname,'../.env'))),local=localOptions(env);
    const schema='volley_access_test_'+randomBytes(8).toString('hex');
    const admin=new Client(local);let server,db,locker;
    try{
        await admin.connect();
        for(const file of ['001_baseline.sql','002_json_helpers.sql','003_public_uuid_identifiers.sql','004_access_control.sql','005_bilingual_official_names.sql','006_custom_vis_public_ids.sql','007_competition_workflows.sql']){
            await admin.query(fs.readFileSync(path.join(__dirname,'../migrations/postgres',file),'utf8').replace(/\bvolley\b/g,schema));
        }
        for(const key of ['DB_PROVIDER','DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','DB_SSL','JWT_SECRET'])if(env[key]!==undefined)process.env[key]=env[key];
        delete process.env.DATABASE_URL;process.env.DB_PG_SCHEMA=schema;process.env.DB_POSTGRES_PREVIEW='true';
        db=require('../config/db');
        await db.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Worker','x','scorer','active'),(2,'Reviewer','x','super_admin_scorer','active'),(3,'Statistician','x','vims_operator','active')");
        await db.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(1,'Isolated test','volleyball','Male',3)");
        for(const id of [1,2])await db.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(?,1)',[id]);
        await db.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','H'),(2,'Away','A')");
        await db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,live_state) VALUES(1,1,1,2,'live','{}')");
        const {app}=require('../server');server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        const origin=`http://127.0.0.1:${server.address().port}/api`;
        const publicFetch=async(url,options)=>fetch(await publicTestUrl(db,url),options);
        const token=async id=>jwt.sign((await db.query('SELECT id,role,authorization_version FROM users WHERE id=?',[id])).rows[0],env.JWT_SECRET,{expiresIn:'5m'});
        const write=async credential=>publicFetch(origin+'/scorer/match/1/state',{method:'PUT',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify({state:{score:{home:2,away:1},setsWon:{home:0,away:0},workflowStep:'MATCH'}})});
        const credential=await token(1);
        const first=await write(credential);assert.equal(first.status,200,await first.text());
        const athleteBody={first_name:'Fixture',last_name:'Player',number:1,birth_date:'2000-01-01',gender:'Male',position:'OH'};
        const add=await publicFetch(origin+'/scorer/match/1/teams/1/players',{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify(athleteBody)});
        assert.equal(add.status,201,await add.text());
        const outsideTeam=await publicFetch(origin+'/scorer/match/1/teams/999/players',{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify({...athleteBody,number:2})});
        assert.ok([403,404].includes(outsideTeam.status));
        await db.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,manual_owner_id,manual_lifecycle,status,manual_config) VALUES(3,1,1,2,1,'ready','scheduled','{}')");
        const encodedAction=await publicFetch(origin+'/scorer/manual-matches/3/%63onfirm',{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:'{}'});
        assert.equal(encodedAction.status,403);
        const customId='custom-11111111-1111-4111-8111-111111111111';
        const synced=await publicFetch(origin+`/vis-custom/${customId}/offline-sync`,{method:'POST',headers:{Authorization:'Bearer '+await token(3),'Content-Type':'application/json'},body:JSON.stringify({
            config:{title:'Private offline fixture',maxSets:3,home:{name:'H',players:[]},away:{name:'A',players:[]}},
            deviceId:'native-test-device-0001',baseRevision:0,operations:[],release:true,
        })});
        assert.equal(synced.status,200,await synced.text());
        const customList=await publicFetch(origin+'/vis-custom/',{headers:{Authorization:'Bearer '+await token(3)}});
        assert.deepEqual((await customList.json()).map(r=>r.id),[customId]);
        locker=new Client(poolOptions({...env,DB_PG_SCHEMA:schema}));await locker.connect();await locker.query('BEGIN');
        await locker.query('SELECT pg_advisory_xact_lock(hashtext($1))',[require('../middleware/recordingLock').lockKey('match',1)]);
        let finished=false;const waiting=write(credential).then(response=>{finished=true;return response;});
        await new Promise(resolve=>setTimeout(resolve,120));assert.equal(finished,false);
        await db.query('UPDATE user_competition_access SET revoked_at=NOW() WHERE user_id=1 AND competition_id=1');
        await locker.query('ROLLBACK');
        assert.equal((await waiting).status,403);
        // Re-grant and create a completed fixture; only the reviewer can confirm its revision.
        await db.query('UPDATE user_competition_access SET revoked_at=NULL WHERE user_id=1 AND competition_id=1');
        await db.query("UPDATE matches SET status='completed',home_set_score=2,away_set_score=0,winner_team_id=1,max_sets=3 WHERE id=1");
        for(const set of [1,2])await db.query('INSERT INTO match_sets(match_id,set_number,home_score,away_score,end_time) VALUES(1,?,25,20,NOW())',[set]);
        async function review(id,action,body){const response=await publicFetch(origin+`/access/matches/match/1/score/${action}`,{method:'POST',headers:{Authorization:'Bearer '+await token(id),'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
        assert.equal((await review(1,'submit',{})).status,200);
        const confirmed=await review(2,'confirm',{revision:1});assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
        const frozen=await write(await token(1));assert.equal(frozen.status,409);
        const stored=(await db.query('SELECT status,home_set_score,away_set_score FROM matches WHERE id=1')).rows[0];
        assert.deepEqual(stored,{status:'completed',home_set_score:2,away_set_score:0});
    }finally{
        if(locker){await locker.query('ROLLBACK').catch(()=>{});await locker.end();}
        if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
        if(db)await db.pool.end();
        if(/^volley_access_test_[a-f0-9]{16}$/.test(schema))await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        const remaining=(await admin.query('SELECT count(*)::int AS count FROM pg_namespace WHERE nspname=$1',[schema])).rows[0].count;
        await admin.end();assert.equal(remaining,0);
    }
});
