const test=require('node:test'),assert=require('node:assert/strict');
const {competitionAccessGroups}=require('../utils/competitionAccessGroups');
const {planAccessExpansion}=require('../scripts/reconcileCompetitionAccessGroups');
const male={id:1,title:'National Cup (Male)',title_en:'National Cup (Male)',sport:'Volleyball',gender:'Male',age_group_id:5,start_date:'2026-11-25',end_date:'2026-12-06',stadium_id:1,location:'Gym'};
const female={...male,id:2,title:'National Cup (Female)',title_en:'National Cup (Female)',gender:'Female'};
test('access groups join Male/Female only for the same competition identity and preserve category IDs',()=>{
    const groups=competitionAccessGroups([male,female]);assert.equal(groups.length,1);assert.equal(groups[0].title,'National Cup');assert.deepEqual(groups[0].competition_ids,[1,2]);
    assert.equal(competitionAccessGroups([{...male,title:'National Cup Male'},{...female,title:'National Cup ( Female )'}]).length,1);
    for(const change of [{age_group_id:6},{sport:'Beach volleyball'},{start_date:'2027-11-25'},{stadium_id:2},{title:'Other Cup',title_en:'Other Cup'}])assert.equal(competitionAccessGroups([male,{...female,...change}]).length,2);
    assert.equal(competitionAccessGroups([male,{...male,id:3},female]).length,3);
    assert.deepEqual(planAccessExpansion(groups,[{user_id:7,competition_id:1,revoked_at:null}]),[{user_id:7,competition_id:2}]);
    assert.throws(()=>planAccessExpansion(groups,[{user_id:7,competition_id:1},{user_id:7,competition_id:2,revoked_at:'2026-11-16'}]),/REQUIRES_REVIEW/);
});
test('grant APIs expand both categories but a domain administrator cannot grant an unmanaged sibling',async()=>{
    const {setup,invoke}=require('./helpers/postgresHarness'),h=await setup();
    try{
        const d=h.db,c=require('../controllers/accessController');
        await d.query("INSERT INTO users(id,username,password_hash,role,status) VALUES(1,'System','x','super_admin','active'),(2,'ScoreAdmin','x','super_admin_scorer','active'),(3,'Recorder','x','scorer','active')");
        await d.query("INSERT INTO competitions(id,title,sport,gender) VALUES(1,'Cup (Male)','Volleyball','Male'),(2,'Cup (Female)','Volleyball','Female')");
        await d.query('INSERT INTO user_competition_access(user_id,competition_id) VALUES(2,1)');
        assert.equal((await invoke(c,'setCompetitions',{competition_ids:[1]},{id:3},{id:2,role:'super_admin_scorer'})).code,403);
        const saved=await invoke(c,'setCompetitions',{competition_ids:[1]},{id:3},{id:1,role:'super_admin'});assert.equal(saved.code,200);
        assert.deepEqual((await d.query('SELECT competition_id FROM user_competition_access WHERE user_id=3 AND revoked_at IS NULL ORDER BY competition_id')).rows.map(row=>row.competition_id),[1,2]);
        const list=await invoke(c,'competitions',{}, {},{id:1,role:'super_admin'});assert.equal(list.code,200);
        assert.ok(list.data.every(row=>row.access_group_title==='Cup'&&row.access_group_competition_ids.length===2));
        await d.query("SELECT setval(pg_get_serial_sequence('users','id'),(SELECT MAX(id) FROM users))");
        const created=await invoke(c,'createUser',{username:'NewOperator',password:'Fixture-password',role:'vims_operator',competition_ids:[2]},{},{id:1,role:'super_admin'});
        assert.equal(created.code,201,JSON.stringify(created.data));
        assert.equal(Number((await d.query('SELECT COUNT(*) AS count FROM user_competition_access WHERE user_id=?',[created.data.id])).rows[0].count),2);
    }finally{await h.close();}
});
