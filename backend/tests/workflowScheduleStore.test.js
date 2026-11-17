const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');

test('advance schedules resolve confirmed pool ranks and preserve waiting draw fixtures',async()=>{
    const h=await setup();
    try{
        const d=h.db,c=require('../controllers/competitionWorkflowController'),s=require('../utils/competitionWorkflowStore');
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Admin','x','super_admin','active')");
        for(let id=1;id<=4;id++)await d.query('INSERT INTO teams(id,name,code) VALUES(?,?,?)',[id,`Team ${id}`,`T${id}`]);
        for(const competitionId of [1,2]){
            await d.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(?,?,'volleyball','Male',3)",[competitionId,`Competition ${competitionId}`]);
            for(let id=1;id<=4;id++)await d.query("INSERT INTO team_entries(competition_id,team_id,status,gender) VALUES(?,?,'approved','Male')",[competitionId,id]);
            const call=async(action,body={})=>invoke(c,'mutate',{revision:(await s.read(d,competitionId))?.revision||0,...body},{competitionId,action},{id:1,role:'super_admin'});
            const ok=async(action,body={})=>{const res=await call(action,body);assert.equal(res.code,200,JSON.stringify(res.data));return res;};
            await ok('configure',{format:{teamCount:4,poolCount:2}});
            await ok('groups',{groups:[{name:'A',teamIds:[1,2]},{name:'B',teamIds:[3,4]}]});
            await ok('publish');
            await ok('plan-bracket',{mode:competitionId===1?'selected':'waiting',startNumber:19});
            assert.equal((await call('plan-bracket')).code,409);
            let knockout=(await s.matches(d,competitionId)).filter(match=>match.phase==='knockout');
            assert.equal(knockout.length,4);
            assert.ok(knockout.every(match=>!match.home_team_id&&!match.away_team_id));
            const ids=knockout.map(match=>match.id),semi=knockout.find(match=>match.slot_key==='R4-1');
            await assert.rejects(s.assertRecording(d,semi.id),/ยังไม่พร้อม/);
            const entry={id:semi.id,match_number:'29',round_name:'รอบรองชนะเลิศ',match_date:'2026-11-20',start_time:'14:30',location:'Court 2'};
            assert.equal((await call('schedule',{matches:[{...entry,round_name:'   '}]})).code,409);
            assert.equal((await call('schedule',{matches:[{...entry,round_name:'x'.repeat(101)}]})).code,409);
            assert.equal((await call('schedule',{matches:[{...entry,match_number:'20'}]})).code,409);
            assert.equal((await call('schedule',{matches:[{...entry,match_date:'2026-02-30'}]})).code,409);
            assert.equal((await call('schedule',{matches:[{...entry,id:999}]})).code,409);
            await ok('schedule',{matches:[entry]});
            const waiting=await require('../utils/workflowSchedule').attachScheduleSources(d,knockout);
            assert.equal(waiting[0].awaiting_teams,true);
            assert.match(waiting[0].home_source_label_en,competitionId===1?/Rank 1 Pool A/:/Awaiting draw/);
            for(const match of (await s.matches(d,competitionId)).filter(match=>match.phase==='group'))await ok('forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Absent opponent'});
            knockout=(await s.matches(d,competitionId)).filter(match=>match.phase==='knockout');
            assert.ok(knockout.every(match=>!match.home_team_id));
            await ok('qualify');
            if(competitionId===2){
                assert.equal((await s.read(d,competitionId)).state.status,'qualified');
                await ok('draw');
            }
            knockout=(await s.matches(d,competitionId)).filter(match=>match.phase==='knockout');
            assert.deepEqual(knockout.map(match=>match.id),ids);
            const resolved=knockout.find(match=>match.id===semi.id);
            assert.deepEqual([resolved.home_team_id,resolved.away_team_id],[1,4]);
            assert.deepEqual(JSON.parse(resolved.home_source),{type:'pool',pool:'A',rank:1});
            assert.equal(String(resolved.match_number),'29');assert.equal(resolved.location,'Court 2');
            assert.equal(resolved.round_name,'รอบรองชนะเลิศ');assert.equal(resolved.slot_key,'R4-1');
            const normalized=require('../utils/matchSchedule').normalizeMatchSchedule(resolved);
            assert.equal(normalized.match_date,'2026-11-20');assert.equal(normalized.start_time,'14:30');
            assert.equal((await s.read(d,competitionId)).state.status,'bracket');
            const final=knockout.find(match=>match.slot_key==='R2-1');
            await assert.rejects(s.assertRecording(d,final.id),/ยังไม่พร้อม/);
            await d.query("UPDATE matches SET status='live' WHERE id=?",[semi.id]);
            assert.equal((await call('schedule',{matches:[entry]})).code,409);
            assert.equal((await call('reset-bracket',{reason:'Started bracket'})).code,409);
        }
    }finally{await h.close();}
});
