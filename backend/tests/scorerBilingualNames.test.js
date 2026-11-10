const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const player = { id:7,team_id:1,number:28,first_name:'ชื่อ',last_name:'ไทย',first_name_th:'ชื่อ',last_name_th:'ไทย',first_name_en:'Registered',last_name_en:'Athlete' };
function harness() {
    const writes=[];
    const db={query:async(sql,params)=>{
        if(sql.includes('FROM match_lineups'))return{rows:[{match_id:1,team_id:1,set_number:1,player_id_p1:7,libero_id:null}]};
        if(sql.includes('FROM players')&&sql.includes('WHERE id IN'))return{rows:[player]};
        if(sql.startsWith('SELECT home_team_id'))return{rows:[{home_team_id:1,away_team_id:2,competition_id:null,gender:'Male'}]};
        if(sql.includes('SELECT p.id, p.team_id'))return{rows:[{id:7,team_id:1}]};
        if(sql.startsWith('SELECT id FROM players'))return{rows:[]};
        if(sql.startsWith('SELECT * FROM players'))return{rows:[player]};
        if(sql.startsWith('UPDATE players')||sql.includes('INSERT INTO players')){writes.push({sql,params});return{rows:[],insertId:7};}
        throw Error(sql);
    }};
    const filename=require.resolve('../controllers/scorerController');
    const context={module:{exports:{}},console:{error(){}},require:name=>name==='../config/db'?db:require(path.resolve(path.dirname(filename),name))};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),context);
    const res=()=>({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
    return{controller:context.module.exports,writes,res};
}
for(const method of ['createMatchTeamPlayer','updateMatchTeamPlayer'])test(`${method} stores both registered name languages through the endpoint`,async()=>{
    const h=harness(),res=h.res();
    await h.controller[method]({params:{matchId:1,teamId:1,playerId:7},body:{...player}},res);
    assert.equal(res.code,method.startsWith('create')?201:200);
    const write=h.writes.find(row=>row.sql.includes('first_name_en'));
    assert.ok(write,'Translated names must be written, not just returned by the client');
    for(const value of ['ชื่อ','ไทย','Registered','Athlete'])assert.ok(write.params.includes(value));
    assert.equal(res.body.first_name_en,'Registered');
});
test('lineup endpoint retains translated fields after reloading a saved match',async()=>{
    const h=harness(),res=h.res();
    await h.controller.getMatchLineup({params:{matchId:1}},res);
    assert.equal(res.code,200);
    assert.equal(res.body[0].lineup[0].first_name_en,'Registered');
    assert.equal(res.body[0].lineup[0].last_name_th,'ไทย');
    assert.equal(res.body[0].lineup[0].id,7);
});
test('translated-name validation and team ownership checks prevent unintended writes',async()=>{
    for(const body of [{...player,first_name_en:'X'.repeat(51)},player]){
        const h=harness(),res=h.res();
        await h.controller.updateMatchTeamPlayer({params:{matchId:1,teamId:body===player?3:1,playerId:7},body},res);
        assert.equal(res.code,400);
        assert.equal(h.writes.length,0);
    }
});
