const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');

test('PostgreSQL workflows: identity, registration, integrity, custom VIS, manual scorer and reports',async t=>{
    const h=await setup(),db=h.db;
    t.diagnostic(h.staging?'Target: Supabase staging, isolated schema':'Target: local PGlite PostgreSQL; not Supabase staging');
    try {
        const bcrypt=require('bcryptjs');
        const hash=await bcrypt.hash('migration-test-password',4);
        await db.query("INSERT INTO users (id,username,password_hash,role,status) VALUES (1,'MigrationAdmin',?,'admin','active'),(2,'TeamOwner',?,'team_staff','active')",[hash,hash]);
        await db.query("INSERT INTO age_groups (id,name) VALUES (1,'U18')");
        await db.query("INSERT INTO teams (id,name,code,user_id,status,gender) VALUES (1,'ทีมทดสอบ','TEST1',2,'active','Male'),(2,'ทีมคู่แข่ง','TEST2',NULL,'active','Male')");
        await db.query('UPDATE users SET team_id=1 WHERE id=2');
        // Explicit fixture IDs must not collide with controller-generated identities.
        for(const table of ['users','teams','age_groups'])await db.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),(SELECT max(id) FROM ${table}))`);

        await t.test('login accepts existing bcrypt hashes and case-insensitive usernames',async()=>{
            const auth=require('../controllers/authController');
            const result=await invoke(auth,'login',{username:'migrationadmin',password:'migration-test-password'});
            assert.equal(result.code,200,JSON.stringify(result.data));
            assert.match(result.data.user.public_id,/^[0-9a-f-]{36}$/i);
            assert.equal(require('jsonwebtoken').decode(result.data.token).id,1,'JWT continues using the internal integer ID');
            const bad=await invoke(auth,'login',{username:'MigrationAdmin',password:'wrong'});
            assert.equal(bad.code,401);
        });
        await t.test('database keeps casefold uniqueness and rejects invalid JSON/enums',async()=>{
            await assert.rejects(db.query("INSERT INTO users (username,password_hash,role) VALUES ('MIGRATIONADMIN','x','admin')"),{code:'ER_DUP_ENTRY'});
            await assert.rejects(db.query("INSERT INTO players (team_id,number,position) VALUES (1,90,'invalid')"),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});
            await assert.rejects(db.query("INSERT INTO matches (set_scores) VALUES ('invalid json')"),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});
        });
        const competition=(await db.query("INSERT INTO competitions (title,title_th,title_en,sport,gender,age_group_id,start_date,end_date,status,max_players,max_sets) VALUES ('Migration Cup','รายการทดสอบ','Migration Cup','volleyball','Male',1,'2099-01-01','2099-01-02','open',14,3) RETURNING id")).insertId;
        await db.query("INSERT INTO players (team_id,number,first_name,last_name,gender,position,birth_date) VALUES (1,1,'นักกีฬา','ทดสอบ','Male','OH','2085-01-01')");
        await t.test('registration generates roster snapshots and repeated registration creates no duplicates',async()=>{
            const controller=require('../controllers/competitionsController');
            const user={id:2,role:'team_staff'};
            const response=await invoke(controller,'joinCompetition',{competition_id:competition},{},user);
            assert.equal(response.code,200,JSON.stringify(response.data));
            assert.equal((await db.query('SELECT * FROM team_entries WHERE team_id=1')).rows.length,1);
            const roster=(await db.query('SELECT * FROM team_entry_players')).rows;
            assert.equal(roster.length,1);
            assert.equal(roster[0].athlete_snapshot.first_name,'นักกีฬา');
            await invoke(controller,'joinCompetition',{competition_id:competition},{},user);
            assert.equal((await db.query('SELECT * FROM team_entries WHERE team_id=1')).rows.length,1);
        });
        await t.test('generated columns enforce active jersey numbers and captain/libero roles',async()=>{
            await assert.rejects(db.query("INSERT INTO players (team_id,number,position) VALUES (1,1,'OH')"),{code:'ER_DUP_ENTRY'});
            await db.query("INSERT INTO players (team_id,number,position,is_active) VALUES (1,1,'OH',0)");
            await assert.rejects(db.query("INSERT INTO players (team_id,number,position,is_libero1) VALUES (1,2,'OH',1)"),{code:'ER_CHECK_CONSTRAINT_VIOLATED'});
            await db.query("INSERT INTO players (team_id,number,position,is_captain) VALUES (1,3,'OH',1)");
            await assert.rejects(db.query("INSERT INTO players (team_id,number,position,is_captain) VALUES (1,4,'OH',1)"),{code:'ER_DUP_ENTRY'});
        });
        await t.test('match settings load a competition roster through nested transaction helpers',async()=>{
            const matchId=(await db.query("INSERT INTO matches (home_team_id,away_team_id,competition_id,status,set_scores) VALUES (1,2,?,'scheduled','[]') RETURNING id",[competition])).insertId;
            const controller=require('../controllers/matchSettingsController');
            const result=await invoke(controller,'read',{}, {matchId});
            assert.equal(result.code,200,JSON.stringify(result.data));
            assert.ok(result.data.draft.home.players.length>0);
            assert.ok(Array.isArray(result.data.officials.referees));
            assert.equal(result.data.revision,0);
        });
        await t.test('custom VIS creates once, isolates owner, scores, replays, undoes and publishes',async()=>{
            const controller=require('../controllers/customVisController');
            const players=Array.from({length:6},(_,i)=>({number:i+1,first_name:'Player',last_name:String(i)}));
            const config={creationId:randomUUID(),title:'Postgres VIS',maxSets:3,home:{name:'H',players},away:{name:'A',players}};
            const created=await invoke(controller,'create',config);
            assert.equal(created.code,201,JSON.stringify(created.data));
            const id=created.data.match.id,token=created.data.match.public_token;
            assert.equal((await invoke(controller,'create',config)).data.match.id,id);
            assert.equal((await invoke(controller,'read',{}, {id},{id:2,role:'statistician'})).code,404);
            const send=async(command,operationId=randomUUID())=>{
                const current=await invoke(controller,'read',{}, {id});
                const body={operationId,revision:current.data.state.revision,command:{...command,context:{key:current.data.state.context.key}}};
                return {response:await invoke(controller,'command',body,{id}),body};
            };
            assert.equal((await send({type:'SET_LINEUP',lineups:{home:[1,2,3,4,5,6],away:[1001,1002,1003,1004,1005,1006]},servingTeam:'home',firstSetHomeLeft:true})).response.code,200);
            const saved=await send({type:'RALLY',events:[{team:'home',player:1,skill:'S',grade:'='},{team:'away',player:null,skill:'OP',grade:'#'}]});
            assert.equal(saved.response.code,200,JSON.stringify(saved.response.data));
            assert.deepEqual(saved.response.data.state.score,{home:0,away:1});
            assert.equal((await invoke(controller,'command',saved.body,{id})).code,200);
            const stale={...saved.body,operationId:randomUUID(),revision:0};
            assert.equal((await invoke(controller,'command',stale,{id})).code,409);
            assert.equal((await invoke(controller,'publicView',{}, {token})).code,404);
            assert.equal((await invoke(controller,'publish',{published:true},{id})).code,200);
            assert.deepEqual((await invoke(controller,'publicView',{}, {token})).data.score,{home:0,away:1});
            assert.equal((await send({type:'UNDO'})).response.code,200);
            assert.deepEqual((await invoke(controller,'read',{}, {id})).data.state.score,{home:0,away:0});
            await invoke(controller,'publish',{published:false},{id});
            assert.equal((await invoke(controller,'publicView',{}, {token})).code,404);
        });
        await t.test('manual scorer inserts IDs, roundtrips JSON/time and retries creation once',async()=>{
            const controller=require('../controllers/manualScorerController');
            const players=Array.from({length:6},(_,i)=>({number:i+1,first_name:'Player',last_name:String(i),position:'OH'}));
            const config={creationId:randomUUID(),title:'Manual PostgreSQL',date:'2026-11-13',time:'14:30',maxSets:3,home:{name:'Manual H',players},away:{name:'Manual A',players}};
            const created=await invoke(controller,'save',config);
            assert.equal(created.code,201,JSON.stringify(created.data));
            const id=created.data.match.id;
            assert.equal(typeof id,'number');
            assert.equal((await invoke(controller,'save',config)).data.match.id,id);
            const read=await invoke(controller,'read',{}, {id});
            assert.equal(read.code,200,JSON.stringify(read.data));
            assert.equal(read.data.config.home.players.length,6);
            assert.equal(read.data.match.match_date,'2026-11-13');
        });
        const teams=[];
        for(const side of ['H','A']) {
            const team=(await db.query('INSERT INTO teams (name,code,status) VALUES (?,?,?) RETURNING id',['Official '+side,'OFF'+side,'active'])).insertId;
            const players=[];
            for(let number=1;number<=7;number++)players.push((await db.query("INSERT INTO players (team_id,number,first_name,last_name,position) VALUES (?,?,'Player',?,'OH') RETURNING id",[team,number,String(number)])).insertId);
            teams.push({id:team,players});
        }
        const initial={score:{home:0,away:0},matchData:{currentSet:1},workflowStep:'SERVING',setsWon:{home:0,away:0}};
        const officialId=(await db.query("INSERT INTO matches (home_team_id,away_team_id,status,max_sets,vis_state,live_state,set_scores) VALUES (?,?,'scheduled',3,'{}',?,'[]') RETURNING id",[teams[0].id,teams[1].id,JSON.stringify(initial)])).insertId;
        await t.test('Scorer offline checkout, conflict, atomic batch, replay and release use real transactions',async()=>{
            const controller=require('../controllers/scorerOfflineController'),deviceId=randomUUID(),params={matchId:officialId};
            const checked=await invoke(controller,'checkout',{deviceId},params);
            assert.equal(checked.code,200,JSON.stringify(checked.data));
            assert.equal((await invoke(controller,'checkout',{deviceId:randomUUID()},params,{id:2,role:'scorer'})).code,409);
            const op={id:randomUUID(),method:'POST',path:'event',at:Date.now(),body:{event_type:'POINT',set_number:1,team_id:teams[0].id,score_home:1,score_away:0,local_event_id:randomUUID(),details:{}}};
            const state={id:randomUUID(),method:'PUT',path:'state',body:{state:{...initial,score:{home:1,away:0}}}};
            const batch={deviceId,fingerprint:checked.data.fingerprint,operations:[op,state]};
            const failed=await invoke(controller,'sync',{...batch,operations:[op,{id:randomUUID(),method:'POST',path:'invalid',body:{}}]},params);
            assert.equal(failed.code,400,JSON.stringify(failed.data));
            assert.equal((await db.query('SELECT * FROM match_events WHERE match_id=?',[officialId])).rows.length,0);
            const synced=await invoke(controller,'sync',batch,params);
            assert.equal(synced.code,200,JSON.stringify(synced.data));
            assert.equal((await invoke(controller,'sync',batch,params)).code,200);
            assert.equal((await db.query('SELECT * FROM match_events WHERE match_id=?',[officialId])).rows.length,1);
            const session=(await db.query('SELECT * FROM scorer_offline_sessions WHERE match_id=?',[officialId])).rows[0];
            assert.equal(session.receipts.length,2);
            assert.equal((await invoke(controller,'sync',{...batch,fingerprint:synced.data.fingerprint,release:true},params)).code,200);
        });
        await t.test('official VIS offline sync/retry/undo preserves eScore and rejects conflicting leases',async()=>{
            const controller=require('../controllers/officialVisOfflineController');
            const {commandPayload,view}=require('../utils/customVis');
            const deviceId=randomUUID(),params={matchId:officialId};
            const checked=await invoke(controller,'checkout',{deviceId},params);
            assert.equal(checked.code,200,JSON.stringify(checked.data));
            let payload=checked.data.payload;
            const offlineSession=payload.offlineSession,baseRevision=payload.revision,operations=[];
            const lineup={type:'SET_LINEUP',lineups:{home:teams[0].players.slice(0,6),away:teams[1].players.slice(0,6)},servingTeam:'home',firstSetHomeLeft:true};
            for(const command of [lineup,{type:'RALLY',events:[{team:'home',player:teams[0].players[0],skill:'S',grade:'#'}]}]) {
                const operation={operationId:randomUUID(),revision:payload.revision,command:{...command,context:{key:view(payload).state.context.key}}};
                payload=commandPayload(payload,operation).payload;operations.push(operation);
            }
            const batch={deviceId,offlineSession,baseRevision,operations};
            const before=(await db.query('SELECT live_state,team_a_score FROM matches WHERE id=?',[officialId])).rows[0];
            const synced=await invoke(controller,'sync',batch,params);
            assert.equal(synced.code,200,JSON.stringify(synced.data));
            assert.equal((await invoke(controller,'sync',batch,params)).code,200);
            assert.equal((await db.query("SELECT * FROM match_actions WHERE match_id=? AND action_type='VIS_STAT'",[officialId])).rows.length,1);
            const after=(await db.query('SELECT live_state,team_a_score FROM matches WHERE id=?',[officialId])).rows[0];
            assert.deepEqual(after,before,'VIS must not mutate the official score');
            const current=synced.data.payload;
            const undo={operationId:randomUUID(),revision:current.revision,command:{type:'UNDO',context:{key:view(current).state.context.key}}};
            const undone=await invoke(controller,'sync',{deviceId,offlineSession,baseRevision:current.revision,operations:[undo]},params);
            assert.equal(undone.code,200,JSON.stringify(undone.data));
            assert.equal((await db.query("SELECT * FROM match_actions WHERE match_id=? AND action_type='VIS_STAT'",[officialId])).rows.length,0);
            assert.equal((await invoke(controller,'release',{deviceId,offlineSession},params)).code,200);
        });
        await t.test('history locks roster snapshots and referenced athletes cannot be deleted',async()=>{
            const match=(await db.query("INSERT INTO matches (home_team_id,away_team_id,competition_id,status) VALUES (1,2,?,'live') RETURNING id",[competition])).insertId;
            const {syncTeamEntries}=require('../utils/automaticEntryRoster');
            const connection=await db.connect();
            try {
                await connection.beginTransaction();
                await syncTeamEntries(connection,1);
                await connection.query('UPDATE players SET number=11 WHERE team_id=1 AND number=1 AND is_active=1');
                await syncTeamEntries(connection,1);
                await connection.commit();
            }catch(error){await connection.rollback();throw error;}finally{connection.release();}
            assert.equal((await db.query('SELECT number FROM team_entry_players ORDER BY id LIMIT 1')).rows[0].number,1);
            const player=(await db.query('SELECT id FROM players WHERE team_id=1 AND number=11')).rows[0].id;
            await db.query("INSERT INTO match_actions (match_id,set_number,action_type,player_id) VALUES (?,1,'VIS_STAT',?)",[match,player]);
            await assert.rejects(db.query('DELETE FROM players WHERE id=?',[player]),{code:'ER_ROW_IS_REFERENCED_2'});
        });
        await t.test('parallel checkouts and duplicate custom creation serialize on Supabase', {skip:!h.staging},async()=>{
            const scorer=require('../controllers/scorerOfflineController');
            const id=(await db.query("INSERT INTO matches (home_team_id,away_team_id,status,live_state,set_scores) VALUES (?,?,'scheduled',?,'[]') RETURNING id",[teams[0].id,teams[1].id,JSON.stringify(initial)])).insertId;
            const replies=await Promise.all([invoke(scorer,'checkout',{deviceId:randomUUID()},{matchId:id}),invoke(scorer,'checkout',{deviceId:randomUUID()},{matchId:id})]);
            assert.deepEqual(replies.map(reply=>reply.code).sort(),[200,409]);
            const controller=require('../controllers/customVisController');
            const players=Array.from({length:6},(_,i)=>({number:i+1,first_name:'Player',last_name:String(i)}));
            const config={creationId:randomUUID(),title:'Concurrent creation',maxSets:3,home:{name:'H',players},away:{name:'A',players}};
            const created=await Promise.all([invoke(controller,'create',config),invoke(controller,'create',config)]);
            assert.ok(created.every(reply=>reply.code===201));
            assert.equal(created[0].data.match.id,created[1].data.match.id);
            assert.equal((await db.query('SELECT COUNT(*) AS count FROM custom_vis_matches WHERE id=?',[created[0].data.match.id])).rows[0].count,1);
            const customId=created[0].data.match.id;
            let current=(await invoke(controller,'read',{}, {id:customId})).data;
            const setupBody={operationId:randomUUID(),revision:current.state.revision,command:{type:'SET_LINEUP',lineups:{home:[1,2,3,4,5,6],away:[1001,1002,1003,1004,1005,1006]},servingTeam:'home',firstSetHomeLeft:true,context:{key:current.state.context.key}}};
            assert.equal((await invoke(controller,'command',setupBody,{id:customId})).code,200);
            current=(await invoke(controller,'read',{}, {id:customId})).data;
            const rally={operationId:randomUUID(),revision:current.state.revision,command:{type:'RALLY',events:[{team:'home',player:1,skill:'S',grade:'#'}],context:{key:current.state.context.key}}};
            const replayed=await Promise.all([invoke(controller,'command',rally,{id:customId}),invoke(controller,'command',rally,{id:customId})]);
            assert.ok(replayed.every(reply=>reply.code===200));
            assert.deepEqual((await invoke(controller,'read',{}, {id:customId})).data.state.score,{home:1,away:0});
        });
        await t.test('public, team, competition and administrator reads execute real aggregate queries',async()=>{
            const calls=[['publicController','getCompetitions',{}],['publicController','getCompetitionTeams',{competitionId:competition}],['publicController','getStatistics',{competitionId:competition}],['teamController','getMyTeams',{}],['teamController','getAllTeamEntries',{}],['teamController','getMyCompetitions',{}],['competitionsController','getAllCompetitions',{}],['matchController','getAllMatches',{}],['matchController','getMatchesByCompetition',{competitionId:competition}],['adminVisController','overview',{}]];
            for(const [file,method,params]of calls){const controller=require('../controllers/'+file);assert.equal(typeof controller[method],'function',method);const result=await invoke(controller,method,{},params,{id:2,role:'admin'});assert.equal(result.code,200,`${file}.${method}: ${JSON.stringify(result.data)}`);}
        });
    } finally {await h.close();}
});
