const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');

test('optional bronze fixture preserves numbers, blocks started removal and completes joint third standings',async()=>{
    const h=await setup();
    try{
        const d=h.db,c=require('../controllers/competitionWorkflowController'),s=require('../utils/competitionWorkflowStore');
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'Admin','x','super_admin','active')");
        for(let id=1;id<=4;id++)await d.query('INSERT INTO teams(id,name,code) VALUES(?,?,?)',[id,`Team ${id}`,`T${id}`]);
        for(const [index,mode] of ['joint','bronze','late'].entries()){
            const thirdPlace=mode!=='joint',competitionId=index+1;
            await d.query("INSERT INTO competitions(id,title,sport,gender,max_sets) VALUES(?,?,'volleyball','Male',3)",[competitionId,`Competition ${competitionId}`]);
            for(let id=1;id<=4;id++)await d.query("INSERT INTO team_entries(competition_id,team_id,status,gender) VALUES(?,?,'approved','Male')",[competitionId,id]);
            const call=async(action,body={})=>invoke(c,'mutate',{revision:(await s.read(d,competitionId))?.revision||0,...body},{competitionId,action},{id:1,role:'super_admin'});
            const ok=async(action,body={})=>{const res=await call(action,body);assert.equal(res.code,200,JSON.stringify(res.data));};
            await ok('configure',{format:{teamCount:4,poolCount:2,thirdPlace}});
            await ok('groups',{groups:[{name:'A',teamIds:[1,2]},{name:'B',teamIds:[3,4]}]});
            await ok('publish');await ok('plan-bracket',{mode:'selected',startNumber:19});
            let knockout=(await s.matches(d,competitionId)).filter(match=>match.phase==='knockout');
            assert.equal(knockout.length,thirdPlace?4:3);
            const final=knockout.find(match=>match.slot_key==='R2-1'),finalNumber=final.match_number;
            if(!thirdPlace){
                await ok('third-place',{enabled:true});
                let bronze=(await s.matches(d,competitionId)).find(match=>match.slot_key==='BRONZE-1');
                assert.ok(bronze);
                assert.equal((await call('third-place',{enabled:false})).code,409);
                await d.query("UPDATE matches SET status='live' WHERE id=?",[bronze.id]);
                assert.equal((await call('third-place',{enabled:false,confirmRemoval:true})).code,409);
                await d.query("UPDATE matches SET status='scheduled' WHERE id=?",[bronze.id]);
                await ok('third-place',{enabled:false,confirmRemoval:true});
                assert.equal((await s.matches(d,competitionId)).find(match=>match.id===final.id).match_number,finalNumber);
            }
            for(const match of (await s.matches(d,competitionId)).filter(match=>match.phase==='group'))await ok('forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Absent opponent'});
            await ok('qualify');
            for(const match of (await s.matches(d,competitionId)).filter(match=>match.slot_key?.startsWith('R4-')))await ok('forfeit',{matchId:match.id,losingTeamId:match.away_team_id,reason:'Absent opponent'});
            const last=(await s.matches(d,competitionId)).find(match=>match.slot_key==='R2-1');
            await ok('forfeit',{matchId:last.id,losingTeamId:last.away_team_id,reason:'Absent opponent'});
            if(mode==='late')await ok('third-place',{enabled:false,confirmRemoval:true});
            else if(thirdPlace){
                assert.equal((await s.read(d,competitionId)).state.status,'bracket');
                const bronze=(await s.matches(d,competitionId)).find(match=>match.slot_key==='BRONZE-1');
                await ok('forfeit',{matchId:bronze.id,losingTeamId:bronze.away_team_id,reason:'Absent opponent'});
            }
            const state=(await s.read(d,competitionId)).state;
            assert.equal(state.status,'completed');
            assert.equal(state.podium.champion,1);
            if(mode==='bronze'){assert.equal(state.podium.third,4);assert.equal(state.podium.fourth,2);}
            else{assert.deepEqual(state.podium.thirdJoint,[4,2]);assert.equal(state.podium.fourth,undefined);}
            assert.equal((await call('third-place',{enabled:!thirdPlace})).code,409);
        }
    }finally{await h.close();}
});
