const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');

test('workflow lifecycle adopts fixtures, confirms ranking, routes winner/loser and protects started descendants',async()=>{
    const h=await setup();
    try{
        const d=h.db;
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'OrganizerAdmin','x','super_admin','active'),(2,'Organizer','x','organizer','active'),(3,'Scorer','x','scorer','active'),(4,'Reviewer','x','super_admin_scorer','active')");
        await d.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(1,'Eight teams','volleyball','Male',3),(2,'Outside','volleyball','Female',5)");
        for(const id of [2,3,4])await d.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(?,1)',[id]);
        for(let id=1;id<=8;id++){
            await d.query('INSERT INTO teams(id,name,code) VALUES(?,?,?)',[id,`Team ${id}`,`T${id}`]);
            for(const competition of [1,2])await d.query("INSERT INTO team_entries(competition_id,team_id,status,gender) VALUES(?,?,'approved',?)",[competition,id,competition===1?'Male':'Female']);
        }
        const c=require('../controllers/competitionWorkflowController'),s=require('../utils/competitionWorkflowStore');
        const roles={1:'super_admin',2:'organizer',3:'scorer',4:'super_admin_scorer'};
        const call=async(action,body={},userId=1,competitionId=1)=>invoke(c,'mutate',{revision:(await s.read(d,competitionId))?.revision||0,...body},{competitionId,action},{id:userId,role:roles[userId],username:`User ${userId}`});
        const success=async(...args)=>{const response=await call(...args);assert.equal(response.code,200,JSON.stringify(response.data));return response;};
        assert.equal((await call('configure',{format:{teamCount:8,poolCount:2}},2)).code,403);
        await success('configure',{format:{teamCount:8,poolCount:2}});
        const groups=[{name:'A',teamIds:[1,2,3,4]},{name:'B',teamIds:[5,6,7,8]}];
        assert.equal((await call('groups',{groups,revision:0},2)).code,409);
        await success('groups',{groups},2);
        // Existing fixtures are linked without replacing IDs or resetting results.
        const pairs=require('../utils/competitionWorkflow').groupPairs(groups);
        for(const [i,pair]of pairs.entries())await d.query("INSERT INTO matches(competition_id,home_team_id,away_team_id,pool_name,round_name,match_number,status,max_sets) VALUES(1,?,?,?,'Preliminary',?,'scheduled',3)",[pair.home,pair.away,pair.pool,String(i+1)]);
        const original=(await d.query('SELECT id FROM matches ORDER BY id')).rows.map(row=>row.id);
        await success('publish',{adopt:true},2);
        assert.deepEqual((await s.matches(d,1)).map(match=>match.id),original);
        assert.equal((await call('qualify',{},2)).code,409);
        assert.equal((await call('groups',{groups},2)).code,409);
        assert.equal((await call('advance',{},2,2)).code,403);
        await success('hold',{matchId:original[0],reason:'Both teams absent'},2);
        await assert.rejects(s.assertRecording(d,original[0]),/ระงับ/);
        await success('unhold',{matchId:original[0],reason:'Organizer resolved attendance'},2);
        for(const match of await s.matches(d,1))await success('forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Team did not report'},2);
        const groupMatch=(await s.matches(d,1))[0];
        assert.equal(groupMatch.home_set_score,2);assert.equal(groupMatch.result_type,'forfeit');
        assert.deepEqual(JSON.parse(groupMatch.set_scores),['25-0','25-0']);
        await assert.rejects(s.assertRecording(d,groupMatch.id),/ปรับแพ้/);
        await success('qualify',{},2);
        await success('draw',{},2);
        const knockout=(await s.matches(d,1)).filter(match=>match.phase==='knockout');
        assert.equal(knockout.length,4);
        const semi1=knockout.find(match=>match.slot_key==='R4-1'),semi2=knockout.find(match=>match.slot_key==='R4-2');
        assert.equal(semi1.home_team_id,1);assert.equal(semi1.away_team_id,6);
        assert.equal(semi2.home_team_id,5);assert.equal(semi2.away_team_id,2);
        await assert.rejects(s.assertMetadata(d,semi1.id,{home_team_id:8}),/workflow/);
        await assert.rejects(s.assertMetadata(d,semi1.id,{},true),/workflow/);
        const final=knockout.find(match=>match.slot_key==='R2-1');
        await assert.rejects(s.assertRecording(d,final.id),/ยังไม่พร้อม/);
        // A normally reviewed result also advances automatically.
        await d.query("UPDATE matches SET status='completed',home_set_score=2,away_set_score=0,winner_team_id=home_team_id,set_scores='[\"25-10\",\"25-10\"]' WHERE id=?",[semi1.id]);
        for(const n of [1,2])await d.query('INSERT INTO match_sets(match_id,set_number,home_score,away_score,end_time) VALUES(?,?,25,10,NOW())',[semi1.id,n]);
        const access=require('../controllers/accessController');
        const review=async(action,userId,body={})=>invoke(access,'review',body,{kind:'match',id:semi1.id,domain:'score',action},{id:userId,role:roles[userId]});
        let result=await review('submit',3);assert.equal(result.code,200,JSON.stringify(result.data));
        result=await review('confirm',4,{revision:1});assert.equal(result.code,200,JSON.stringify(result.data));
        await success('forfeit',{matchId:semi2.id,losingTeamId:semi2.away_team_id,reason:'Opponent did not report'},2);
        let rows=await s.matches(d,1),championship=rows.find(match=>match.slot_key==='R2-1'),bronze=rows.find(match=>match.slot_key==='BRONZE-1');
        assert.deepEqual([championship.home_team_id,championship.away_team_id],[1,5]);
        assert.deepEqual([bronze.home_team_id,bronze.away_team_id],[6,2]);
        result=await review('reopen',4,{revision:1,reason:'Correct a source result'});assert.equal(result.code,200,JSON.stringify(result.data));
        championship=(await s.matches(d,1)).find(match=>match.slot_key==='R2-1');assert.equal(championship.home_team_id,null);
        result=await review('submit',3);assert.equal(result.code,200,JSON.stringify(result.data));
        result=await review('confirm',4,{revision:2});assert.equal(result.code,200,JSON.stringify(result.data));
        await d.query("UPDATE matches SET status='live' WHERE id=?",[final.id]);
        assert.equal((await review('reopen',4,{revision:2,reason:'Cannot overwrite a started final'})).code,409);
        assert.equal((await call('reset-bracket',{reason:'Cannot remove started final'},2)).code,409);
        assert.equal((await call('clear-forfeit',{matchId:groupMatch.id,reason:'Cannot change started bracket'},2)).code,409);
        // Best-of-five forfeits, both-absent holds, retained results on withdrawal.
        await success('configure',{format:{teamCount:8,poolCount:2}},1,2);
        assert.equal((await call('groups',{groups},2,2)).code,403);
        await success('groups',{groups},1,2);await success('publish',{},1,2);
        const fiveSetMatches=await s.matches(d,2),held=fiveSetMatches[0];
        await success('hold',{matchId:held.id,reason:'Both teams absent'},1,2);
        await assert.rejects(s.assertRecording(d,held.id),/ระงับ/);
        assert.equal((await call('qualify',{},1,2)).code,409);
        await success('unhold',{matchId:held.id,reason:'Ruling resolved by organizer'},1,2);
        await success('forfeit',{matchId:held.id,losingTeamId:held.away_team_id,reason:'Opponent absent'},1,2);
        const score=(await d.query('SELECT home_set_score,set_scores,result_type FROM matches WHERE id=?',[held.id])).rows[0];
        assert.equal(score.home_set_score,3);assert.deepEqual(JSON.parse(score.set_scores),['25-0','25-0','25-0']);assert.equal(score.result_type,'forfeit');
        await success('clear-forfeit',{matchId:held.id,reason:'Correct the administrative ruling'},1,2);
        assert.equal((await d.query('SELECT status FROM matches WHERE id=?',[held.id])).rows[0].status,'scheduled');
        for(const match of fiveSetMatches)await success('forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Recorded match ruling'},1,2);
        const retained=(await d.query('SELECT home_set_score,away_set_score FROM matches WHERE id=?',[held.id])).rows[0];
        await success('withdraw',{teamId:1,reason:'Withdraw after completed fixtures'},1,2);
        assert.deepEqual((await d.query('SELECT home_set_score,away_set_score FROM matches WHERE id=?',[held.id])).rows[0],retained);
        const blocked=await call('qualify',{},1,2);assert.equal(blocked.code,409);assert.match(blocked.data.error,/ถอนตัว/);
        // Real 24-team manual draw, including same-pool rejection and fixed path.
        await d.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(3,'Twenty four','volleyball','Male',3)");
        for(let id=9;id<=24;id++)await d.query('INSERT INTO teams(id,name,code) VALUES(?,?,?)',[id,`Team ${id}`,`T${id}`]);
        for(let id=1;id<=24;id++)await d.query("INSERT INTO team_entries(competition_id,team_id,status,gender) VALUES(3,?,'approved','Male')",[id]);
        const eightGroups=Array.from({length:8},(_,i)=>({name:String.fromCharCode(65+i),teamIds:[i*3+1,i*3+2,i*3+3]}));
        await success('configure',{format:{teamCount:24,poolCount:8}},1,3);await success('groups',{groups:eightGroups},1,3);await success('publish',{},1,3);
        for(const match of await s.matches(d,3))await success('forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Recorded preliminary result'},1,3);
        await success('qualify',{},1,3);
        const bad=eightGroups.map(group=>({home:group.teamIds[0],away:group.teamIds[1]}));
        assert.equal((await call('draw',{pairs:bad},1,3)).code,409);
        const realDraw=eightGroups.map((group,i)=>({home:group.teamIds[0],away:eightGroups[(i+1)%8].teamIds[1]}));
        await success('draw',{pairs:realDraw},1,3);
        assert.equal((await s.matches(d,3)).filter(match=>match.phase==='knockout').length,16);
        assert.equal((await call('draw',{pairs:realDraw},1,3)).code,409);
        await d.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(4,'Ranking draw','volleyball','Male',3)");
        for(let id=1;id<=6;id++)await d.query("INSERT INTO team_entries(competition_id,team_id,status,gender) VALUES(4,?,'approved','Male')",[id]);
        await success('configure',{format:{teamCount:6,poolCount:2}},1,4);
        await success('groups',{groups:[{name:'A',teamIds:[1,2,3]},{name:'B',teamIds:[4,5,6]}]},1,4);
        await success('publish',{},1,4);
        for(const match of await s.matches(d,4)){
            const losing=match.away_team_id-match.home_team_id===2?match.home_team_id:match.away_team_id;
            await success('forfeit',{matchId:match.id,losingTeamId:losing,reason:'Cyclic equal results'},1,4);
        }
        assert.equal((await call('qualify',{},1,4)).code,409);
        await success('qualify',{rankDraws:{A:[3,1,2],B:[6,4,5]}},1,4);
        const finalized=await s.read(d,4);
        assert.deepEqual(finalized.state.qualification.qualifiers.map(team=>team.teamId),[3,1,6,4]);
        const publishedRanks=await s.attachRanks(d,4,[{id:1},{id:2},{id:3}]);
        assert.deepEqual(publishedRanks.map(team=>team.workflow_rank),[2,3,1]);
        const audits=(await d.query("SELECT count(*) AS count FROM audit_logs WHERE action LIKE 'workflow.%'")).rows[0];assert.ok(Number(audits.count)>15);
    }finally{await h.close();}
});
