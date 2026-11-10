const test=require('node:test');
const assert=require('node:assert/strict');
const {getMatchTeamStaff}=require('../utils/matchTeamStaff');
test('match staff prefer competition assignments belonging to the same team',async()=>{
    const queries=[];const assigned=[{id:1,role:'Head Coach'},{id:2,role:'Assistant Coach'}];
    const rows=await getMatchTeamStaff({query:async(sql,args)=>{queries.push({sql,args});return {rows:assigned};}},{competition_id:10,home_team_id:5},'home');
    assert.deepEqual(rows,assigned);assert.equal(queries.length,1);assert.deepEqual(queries[0].args,[10,5]);
    assert.ok(queries[0].sql.includes('ts.team_id=te.team_id'));
});
test('empty registration falls back to team staff; legacy coach is used only when no staff exist',async()=>{
    let calls=0;const staff=[{id:3,first_name:'Assistant',last_name:'Coach',role:'Assistant Coach 2'}];
    const database={query:async()=>({rows:++calls===1?[]:staff})};
    assert.deepEqual(await getMatchTeamStaff(database,{competition_id:10,away_team_id:6},'away'),staff);
    assert.equal(calls,2);
    assert.deepEqual(await getMatchTeamStaff({query:async()=>({rows:[]})},{home_team_id:5,home_coach:'Legacy Coach'},'home'),[{team_id:5,first_name:'Legacy Coach',last_name:'',role:'Head Coach'}]);
});
