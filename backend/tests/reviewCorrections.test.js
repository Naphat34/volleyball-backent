const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {replayScore,replayVims}=require('../utils/reviewCorrections');
const {createPayload,view,commandPayload}=require('../utils/customVis');
function scoreFixture(){
    const match={id:1,home_team_id:1,away_team_id:2,status:'completed',live_state:{workflowStep:'MATCH_FINISHED'}};
    const events=[],sets=[],lineups=[];let id=0;
    for(let set=1;set<=2;set++){
        for(let team=1;team<=2;team++)lineups.push({set_number:set,team_id:team,...Object.fromEntries(Array.from({length:6},(_,i)=>[`player_id_p${i+1}`,team*10+i]))});
        events.push({id:++id,set_id:set,team_id:1,skill:'FIRST_SERVE',details:'{}'});
        for(let point=0;point<30;point++)events.push({id:++id,set_id:set,team_id:point<5?2:1,skill:'POINT',details:'{}'});
        sets.push({id:set,set_number:set,home_score:25,away_score:5,end_time:'2026-11-16'});
    }
    return {match,events,sets,lineups,competition:{max_sets:3}};
}
test('score corrections replay the full journal, keep completed status, and reject incomplete/unauthorized fields',()=>{
    const f=scoreFixture();
    const result=replayScore(f.match,f.events,f.lineups,f.sets,f.competition,[{id:2,team_id:1},{id:7,team_id:2}]);
    assert.deepEqual(result.won,{home:2,away:0});assert.equal(result.live.workflowStep,'MATCH_FINISHED');
    assert.equal(f.match.status,'completed');assert.equal(result.events[1].score_home,1);assert.equal(result.events[1].score_away,0);
    assert.deepEqual(result.sets.map(s=>[s.home_score,s.away_score]),[[25,5],[25,5]]);
    assert.throws(()=>replayScore(f.match,f.events,f.lineups,f.sets,f.competition,[{id:7,team_id:2}]),/incomplete/);
    assert.throws(()=>replayScore(f.match,f.events,f.lineups,f.sets,f.competition,[{id:7,score_home:100}]),/Unsupported/);
    assert.throws(()=>replayScore(f.match,f.events,[],f.sets,f.competition,[{id:7,team_id:2}]),/lineup/);
});
function visFixture(){
    const players=Array.from({length:6},(_,i)=>({number:i+1,first_name:'Player',last_name:String(i),position:'OH'}));
    let payload=createPayload({title:'Correction',maxSets:3,home:{name:'H',players},away:{name:'A',players}},'custom-11111111-1111-4111-8111-111111111111');
    let n=0;
    const send=command=>{payload=commandPayload(payload,{revision:payload.revision,operationId:`test-correction-${++n}`,command:{...command,context:{key:view(payload).state.context.key}}}).payload;};
    for(let set=1;set<=2;set++){
        send({type:'SET_LINEUP',lineups:{home:[1,2,3,4,5,6],away:[1001,1002,1003,1004,1005,1006]},servingTeam:'home',firstSetHomeLeft:true});
        for(let point=0;point<25;point++)send({type:'RALLY',events:[{team:'home',player:1,skill:'A',grade:'#'}]});
    }
    return payload;
}
test('VIMS historical replay recomputes codes and contexts, retains event IDs and keeps an ended match completed',()=>{
    const source=visFixture(),result=replayVims(source,[{id:1,player_id:2}]);
    assert.equal(result.actions[0].event_code,'*02A#');assert.equal(source.actions[0].player_id,1);
    assert.deepEqual(result.actions.map(e=>e.id),source.actions.map(e=>e.id));
    assert.equal(view(result).state.phase,'MATCH_FINISHED');assert.equal(view(result).match.status,'completed');
    assert.throws(()=>replayVims(source,[{id:1,grade:'='}]),/set boundaries|incomplete|on court/);
    assert.throws(()=>replayVims(source,[{id:1,player_id:9999}]),/on court/);
});
test('corrections require reopened domain reviews, VIMS approval release, reason and current snapshot',async()=>{
    const {setup,invoke}=require('./helpers/postgresHarness'),h=await setup();
    try{
        const d=h.db;
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'score','x','scorer','active'),(2,'admin','x','super_admin_scorer','active')");
        await d.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(1,'Test','volleyball','Male',3)");
        for(const id of [1,2])await d.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(?,1)',[id]);
        await d.query("INSERT INTO teams(id,name,code) VALUES(1,'H','H'),(2,'A','A')");
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,home_set_score,away_set_score,winner_team_id) VALUES(1,1,1,2,'completed',2,0,1)");
        const f=scoreFixture();
        for(let team=1;team<=2;team++)for(let index=0;index<6;index++)await d.query("INSERT INTO players(id,team_id,number,first_name,last_name) VALUES(?,?,?,'Player',?)",[team*10+index,team,index+1,String(index)]);
        for(const l of f.lineups)await d.query('INSERT INTO match_lineups(match_id,team_id,set_number,player_id_p1,player_id_p2,player_id_p3,player_id_p4,player_id_p5,player_id_p6) VALUES(1,?,?,?,?,?,?,?,?)',[l.team_id,l.set_number,...Array.from({length:6},(_,i)=>l[`player_id_p${i+1}`])]);
        for(const e of f.events)await d.query('INSERT INTO match_events(id,match_id,set_id,team_id,skill,details) VALUES(?,1,?,?,?,?)',[e.id,e.set_id,e.team_id,e.skill,e.details]);
        for(const s of f.sets)await d.query('INSERT INTO match_sets(match_id,set_number,home_score,away_score,end_time) VALUES(1,?,?,?,NOW())',[s.set_number,s.home_score,s.away_score]);
        const c=require('../controllers/reviewCorrectionController'),params={kind:'match',id:1,domain:'score'},actor={id:1,role:'scorer'};
        assert.equal((await invoke(c,'load',{},params,actor)).code,409);
        await d.query("INSERT INTO match_reviews(match_id,domain,competition_id,revision,fingerprint,status,submitted_by) VALUES(1,'score',1,1,?,'reopened',1)",['0'.repeat(64)]);
        assert.equal((await invoke(c,'load',{},params,{id:2,role:'super_admin_scorer'})).code,403);
        let loaded=await invoke(c,'load',{},params,actor);assert.equal(loaded.code,200);
        const body={revision:1,fingerprint:loaded.data.fingerprint,reason:'Correct two point winners',edits:[{id:2,team_id:1},{id:7,team_id:2}]};
        assert.equal((await invoke(c,'save',{...body,reason:''},params,actor)).code,400);
        assert.equal((await invoke(c,'save',{...body,fingerprint:'old'},params,actor)).code,409);
        await d.query('UPDATE matches SET live_state=? WHERE id=1',[JSON.stringify({matchSignatures:{referee1:'signed-result'}})]);
        await d.query("INSERT INTO match_reviews(match_id,domain,competition_id,revision,fingerprint,status,submitted_by) VALUES(1,'vims',1,1,?,'confirmed',1)",['0'.repeat(64)]);
        assert.equal((await invoke(c,'save',body,params,actor)).code,409);
        await d.query("UPDATE match_reviews SET status='reopened' WHERE domain='vims'");
        loaded=await invoke(c,'load',{},params,actor);body.fingerprint=loaded.data.fingerprint;
        const saved=await invoke(c,'save',body,params,actor);assert.equal(saved.code,200,JSON.stringify(saved.data));
        const stored=(await d.query('SELECT live_state FROM matches WHERE id=1')).rows[0].live_state;
        const live=typeof stored==='string'?JSON.parse(stored):stored;
        assert.equal(live.matchSignatures.referee1,'signed-result');
        assert.equal(live.resultCorrection.signaturesRetained,true);assert.equal(live.resultCorrection.reviewRevision,2);
        assert.equal((await d.query('SELECT status FROM matches WHERE id=1')).rows[0].status,'completed');
        assert.equal((await invoke(c,'save',body,params,actor)).code,409);
        const audit=(await d.query("SELECT details FROM audit_logs WHERE action='score.correct_events'")).rows[0];
        const details=typeof audit.details==='string'?JSON.parse(audit.details):audit.details;
        assert.equal(details.before.events[1].team_id,2);assert.equal(details.after.events[1].team_id,1);
        const beforeLive=typeof details.before.live_state==='string'?JSON.parse(details.before.live_state):details.before.live_state;
        assert.equal(beforeLive.matchSignatures.referee1,'signed-result');
        const review=require('../controllers/accessController');
        const submitted=await invoke(review,'review',{}, {...params,action:'submit'},actor);
        assert.equal(submitted.code,200,JSON.stringify(submitted.data));assert.equal(submitted.data.revision,2);
    }finally{await h.close();}
});
test('official and custom VIMS corrections persist replayed statistics using locked jersey snapshots',async()=>{
    const {setup,invoke}=require('./helpers/postgresHarness'),h=await setup();
    try{
        const d=h.db,payload=visFixture(),customId=payload.match.id;
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'vims','x','vims_operator','active')");
        await d.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(1,'Test','volleyball','Male',3)");
        await d.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(1,1)');
        await d.query("INSERT INTO teams(id,name,code) VALUES(1,'H','H'),(2,'A','A')");
        for(const side of ['home','away'])for(const player of payload.config[side].players)await d.query('INSERT INTO players(id,team_id,number,first_name,last_name,gender) VALUES(?,?,?,?,?,?)',[player.id,side==='home'?1:2,player.number,player.first_name,player.last_name,'Male']);
        await d.query("INSERT INTO matches(id,competition_id,home_team_id,away_team_id,status,match_setup,vis_state) VALUES(1,1,1,2,'completed',?,?)",[JSON.stringify(payload.config),JSON.stringify(payload.match.vis_state)]);
        for(const event of payload.actions)await d.query('INSERT INTO match_actions(id,match_id,action_type,set_number,team_id,player_id,skill,grade,score_home,score_away,description,details) VALUES(?,1,?,?,?,?,?,?,?,?,?,?)',
            [event.id,'VIS_STAT',event.set_number,event.team_id,event.player_id,event.skill,event.grade,event.score_home,event.score_away,event.event_code,JSON.stringify(event.details)]);
        await d.query('INSERT INTO custom_vis_matches(id,owner_id,competition_id,public_token,payload) VALUES(?,1,1,?,?)',[customId,'c'.repeat(48),JSON.stringify(payload)]);
        await d.query("INSERT INTO match_reviews(match_id,domain,competition_id,revision,fingerprint,status,submitted_by) VALUES(1,'vims',1,1,?,'reopened',1)",['0'.repeat(64)]);
        await d.query("INSERT INTO match_reviews(custom_match_id,domain,competition_id,revision,fingerprint,status,submitted_by) VALUES(?,'vims',1,1,?,'reopened',1)",[customId,'0'.repeat(64)]);
        await d.query('UPDATE players SET number=99 WHERE id=2');
        delete require.cache[require.resolve('../controllers/reviewCorrectionController')];
        const c=require('../controllers/reviewCorrectionController'),actor={id:1,role:'vims_operator'};
        for(const [kind,id]of [['match',1],['custom',customId]]){
            const params={kind,id,domain:'vims'},loaded=await invoke(c,'load',{},params,actor);
            assert.equal(loaded.code,200,JSON.stringify(loaded.data));
            const saved=await invoke(c,'save',{revision:1,fingerprint:loaded.data.fingerprint,reason:'Correct athlete identity',edits:[{id:1,player_id:2}]},params,actor);
            assert.equal(saved.code,200,JSON.stringify(saved.data));
        }
        assert.equal((await d.query('SELECT description AS event_code FROM match_actions WHERE id=1')).rows[0].event_code,'*02A#');
        delete require.cache[require.resolve('../controllers/accessController')];
        const preview=await invoke(require('../controllers/accessController'),'preview',{}, {kind:'match',id:1},actor);
        assert.equal(preview.code,200,JSON.stringify(preview.data));assert.equal(preview.data.statistics[0].event_code,'*02A#');
        assert.equal((await d.query('SELECT status FROM matches WHERE id=1')).rows[0].status,'completed');
        const custom=(await d.query('SELECT payload FROM custom_vis_matches WHERE id=?',[customId])).rows[0].payload;
        assert.equal(view(typeof custom==='string'?JSON.parse(custom):custom).match.status,'completed');
    }finally{await h.close();}
});
