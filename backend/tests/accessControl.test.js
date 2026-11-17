const test=require('node:test');
const assert=require('node:assert/strict');
process.env.DB_PROVIDER='postgres';
const {setup,invoke}=require('./helpers/postgresHarness');
const {permissionsByRole,roleHasPermission,normalizeRole}=require('../config/permissions');
const {assertCompetition,assertMatch}=require('../utils/accessScope');

test('single-role policy separates administration, scores and statistics without wildcard privileges',()=>{
    assert.equal(normalizeRole('statistician'),'vims_operator');
    for(const role of ['super_admin','super_admin_scorer','super_admin_vims'])for(const permission of ['score.record','vims.record','match.score','score.offline','vims.offline'])assert.equal(roleHasPermission(role,permission),false,`${role}:${permission}`);
    assert.equal(roleHasPermission('scorer','vims.record'),false);
    assert.equal(roleHasPermission('vims_operator','match.score'),false);
    assert.equal(roleHasPermission('super_admin_scorer','vims.review'),false);
    assert.equal(roleHasPermission('super_admin_vims','score.review'),false);
    assert.ok(Object.values(permissionsByRole).every(p=>!p.includes('*')));
    assert.equal(roleHasPermission('user','match.view'),false);
    for(const role of ['constructor','toString','__proto__',undefined,null])assert.equal(roleHasPermission(role,'match.score'),false);
});

test('migration, competition isolation, review locks, private linking and account administration',async t=>{
    const h=await setup();
    try{
        const d=h.db;
        const catalog=(await d.query('SELECT role_code,permission_code FROM role_permissions ORDER BY role_code,permission_code')).rows;
        const expected=Object.entries(permissionsByRole).flatMap(([role,items])=>items.map(permission=>`${role}:${permission}`)).sort();
        assert.deepEqual(catalog.map(r=>`${r.role_code}:${r.permission_code}`).sort(),expected);
        await d.query(`INSERT INTO users(id,username,password_hash,role,status) VALUES
            (1,'Central','x','super_admin','active'),(2,'ScoreAdmin','x','super_admin_scorer','active'),
            (3,'Recorder','x','scorer','active'),(4,'VisAdmin','x','super_admin_vims','active'),(5,'Stats','x','vims_operator','active')`);
        await d.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Allowed','volleyball','Male'),(2,'Outside','volleyball','Female')");
        for(const id of [2,3,4,5])await d.query('INSERT INTO user_competition_access(user_id,competition_id,granted_by) VALUES(?,1,1)',[id]);
        await d.query("INSERT INTO teams(id,name,code) VALUES(1,'Home','HOME'),(2,'Away','AWAY')");
        await d.query("INSERT INTO matches(id,competition_id,status,home_team_id,away_team_id,home_set_score,away_set_score,winner_team_id) VALUES(1,1,'completed',1,2,3,0,1),(2,2,'scheduled',1,2,0,0,NULL)");
        for(let set=1;set<=3;set++)await d.query('INSERT INTO match_sets(match_id,set_number,home_score,away_score,end_time) VALUES(1,?,25,20,NOW())',[set]);
        await t.test('banned is valid and undefined or multiple roles cannot be stored',async()=>{
            await d.query("UPDATE users SET status='banned' WHERE id=5");
            await assert.rejects(d.query("UPDATE users SET role='staff' WHERE id=5"));
            await assert.rejects(d.query("UPDATE users SET role='scorer,vims_operator' WHERE id=5"));
            await d.query("UPDATE users SET status='active' WHERE id=5");
        });
        await t.test('scope allows every match in one competition without an assignment and denies others',async()=>{
            await assertMatch(d,{id:3,role:'scorer'},'match',1,'score.record');
            await assert.rejects(assertMatch(d,{id:3,role:'scorer'},'match',2,'score.record'),{status:403});
            await assert.rejects(assertMatch(d,{id:5,role:'vims_operator'},'match',1,'score.record'),{status:403});
            await assert.rejects(assertCompetition(d,{id:3,role:'scorer'},null),{status:409});
        });
        const c=require('../controllers/accessController');
        await t.test('domain administrator cannot ban/reset an entire account or grant another competition',async()=>{
            const actor={id:2,role:'super_admin_scorer'};
            assert.equal((await invoke(c,'createUser',{username:'Unassigned',password:'Fixture-password',role:'scorer',competition_ids:[]},{},actor)).code,400);
            assert.equal((await invoke(c,'updateUser',{status:'banned'},{id:3},actor)).code,403);
            assert.equal((await invoke(c,'setCompetitions',{competition_ids:[2]},{id:3},actor)).code,403);
            assert.equal((await invoke(c,'setCompetitions',{competition_ids:[1]},{id:5},actor)).code,403);
        });
        await t.test('wrong-domain review and unlinked manual submission fail',async()=>{
            const bad=await invoke(c,'review',{}, {kind:'match',id:1,domain:'score',action:'confirm'}, {id:4,role:'super_admin_vims'});
            assert.equal(bad.code,403);
            await d.query("INSERT INTO matches(id,status,manual_owner_id,manual_lifecycle) VALUES(3,'completed',3,'review')");
            const noLink=await invoke(c,'review',{}, {kind:'match',id:3,domain:'score',action:'submit'}, {id:3,role:'scorer'});
            assert.equal(noLink.code,409);
        });
        await t.test('scorer submits, own/domain violations fail, reviewer confirms a revision and locks writing',async()=>{
            const params={kind:'match',id:1,domain:'score',action:'submit'};
            const submitted=await invoke(c,'review',{},params,{id:3,role:'scorer'});
            assert.equal(submitted.code,200,JSON.stringify(submitted.data));
            const confirmed=await invoke(c,'review',{revision:1},{...params,action:'confirm'},{id:2,role:'super_admin_scorer'});
            assert.equal(confirmed.code,200,JSON.stringify(confirmed.data));
            await assert.rejects(assertMatch(d,{id:3,role:'scorer'},'match',1,'score.record',{writing:true,domain:'score'}),{status:409});
            assert.equal((await invoke(c,'review',{revision:1},{...params,action:'reopen'},{id:2,role:'super_admin_scorer'})).code,400);
            assert.equal((await invoke(c,'review',{revision:1,reason:'Correction required'},{...params,action:'reopen'},{id:2,role:'super_admin_scorer'})).code,200);
            await assert.rejects(assertMatch(d,{id:3,role:'scorer'},'match',1,'score.record',{writing:true,domain:'score'}),{status:409});
        });
        await t.test('the last active central administrator cannot be disabled',async()=>{
            const result=await invoke(c,'updateUser',{status:'banned'},{id:1},{id:1,role:'super_admin'});
            assert.equal(result.code,409);
        });
        await t.test('central administrator may create an account before assigning competitions',async()=>{
            await d.query("SELECT setval(pg_get_serial_sequence('users','id'),(SELECT MAX(id) FROM users))");
            const created=await invoke(c,'createUser',{username:'AwaitingScope',password:'Fixture-password',role:'vims_operator',competition_ids:[]},{},{id:1,role:'super_admin'});
            assert.equal(created.code,201,JSON.stringify(created.data));
            assert.equal(Number((await d.query('SELECT COUNT(*) AS count FROM user_competition_access WHERE user_id=?',[created.data.id])).rows[0].count),0);
        });
        await t.test('custom VIMS replay must actually finish and only its scoped administrator confirms and publishes',async()=>{
            const {createPayload,view,commandPayload}=require('../utils/customVis');
            const id='custom-11111111-1111-4111-8111-111111111111';
            const config={title:'Review fixture',maxSets:3,home:{name:'Home',players:[]},away:{name:'Away',players:[]}};
            for(const side of ['home','away'])config[side].players=Array.from({length:6},(_,i)=>({number:i+1,first_name:side,last_name:String(i)}));
            let payload=createPayload(config,id),n=0;
            const params={kind:'custom',id,domain:'vims',action:'submit'};
            payload.lifecycle='review';
            await d.query('INSERT INTO custom_vis_matches(id,owner_id,public_token,payload,competition_id) VALUES(?,5,?,?,1)',[id,'f'.repeat(48),JSON.stringify(payload)]);
            assert.equal((await invoke(c,'review',{},params,{id:5,role:'vims_operator'})).code,409);
            payload=createPayload(config,id);
            const send=command=>{const state=view(payload).state;payload=commandPayload(payload,{revision:payload.revision,operationId:`access-rally-operation-${++n}`,command:{...command,context:{key:state.context.key}}}).payload;};
            for(let set=1;set<=2;set++){
                send({type:'SET_LINEUP',lineups:{home:[1,2,3,4,5,6],away:[1001,1002,1003,1004,1005,1006]},servingTeam:'home',firstSetHomeLeft:true});
                for(let point=0;point<25;point++)send({type:'RALLY',events:[{team:'home',player:1,skill:'A',grade:'#'}]});
            }
            await d.query('UPDATE custom_vis_matches SET payload=? WHERE id=?',[JSON.stringify(payload),id]);
            const summary=await invoke(c,'matches',{}, {},{id:4,role:'super_admin_vims'});
            assert.equal(summary.code,200);assert.equal(summary.data.custom[0].status,'completed');
            assert.equal(summary.data.custom[0].title,'Review fixture');assert.equal(Object.hasOwn(summary.data.custom[0],'payload'),false);
            assert.equal((await invoke(c,'review',{},params,{id:5,role:'vims_operator'})).code,200);
            await d.query("UPDATE users SET role='super_admin_vims' WHERE id=5");
            assert.equal((await invoke(c,'review',{revision:1},{...params,action:'confirm'},{id:5,role:'super_admin_vims'})).code,403);
            await d.query("UPDATE users SET role='vims_operator' WHERE id=5");
            assert.equal((await invoke(c,'review',{revision:1},{...params,action:'confirm'},{id:4,role:'super_admin_vims'})).code,200);
            assert.equal((await invoke(c,'review',{revision:1,published:true},{...params,action:'publish'},{id:2,role:'super_admin_scorer'})).code,403);
            assert.equal((await invoke(c,'review',{revision:1,published:true},{...params,action:'publish'},{id:4,role:'super_admin_vims'})).code,200);
            assert.equal(Number((await d.query('SELECT published FROM custom_vis_matches WHERE id=?',[id])).rows[0].published),1);
        });
    }finally{await h.close();}
});
