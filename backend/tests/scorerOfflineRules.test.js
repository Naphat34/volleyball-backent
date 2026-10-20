const {test}=require('node:test');
const assert=require('node:assert/strict');
const {initialCheckpoint,checkOperation}=require('../utils/scorerOfflineRules');
const base=()=>initialCheckpoint({home_team_id:1,away_team_id:2,max_sets:3,live_state:{score:{home:0,away:0},matchData:{currentSet:1}}});
const point=(home,away,team=1)=>({path:'event',body:{event_type:'POINT',set_number:1,team_id:team,score_home:home,score_away:away}});
test('official offline replay validates one-point increments and rejects invented scores',()=>{
 const before=base(), next=checkOperation(before,point(1,0));
 assert.deepEqual(next.scores[1],{home:1,away:0});assert.equal(before.scores[1].home,0);
 assert.throws(()=>checkOperation(next,point(4,0)));
 assert.throws(()=>checkOperation(next,{path:'state',body:{state:{score:{home:9,away:0},matchData:{currentSet:1}}}}));
});
test('Undo restores a verified pre-command checkpoint; cannot rewrite pre-checkout history',()=>{
 let state=checkOperation(base(),point(1,0)); state=checkOperation(state,point(1,1,2));
 const undone=checkOperation(state,{path:'undo',body:{state:{score:{home:1,away:0},matchData:{currentSet:1},completedSets:[]}}});
 assert.deepEqual(undone.scores[1],{home:1,away:0});
 assert.throws(()=>checkOperation(base(),{path:'undo',body:{state:{score:{home:50,away:0}}}}));
});
test('set end requires verified score, target and a two-point lead',()=>{
 let state=base();for(let i=1;i<=25;i++)state=checkOperation(state,point(i,0));
 assert.throws(()=>checkOperation(state,{path:'end-set',body:{setNumber:1,homeScore:24,awayScore:0}}));
 state=checkOperation(state,{path:'end-set',body:{setNumber:1,homeScore:25,awayScore:0}});
 state=checkOperation(state,{path:'state',body:{state:{score:{home:0,away:0},matchData:{currentSet:2}}}});
 assert.equal(state.set,2);assert.equal(state.completed[1].home,25);
 assert.throws(()=>checkOperation(base(),{path:'state',body:{state:{score:{home:0,away:0},matchData:{currentSet:2}}}}));
});
