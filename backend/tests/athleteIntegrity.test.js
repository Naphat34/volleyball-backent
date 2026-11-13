const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { normalizeAthleteRoles, withAthleteTransaction, validateTeamPlayerNumber, athleteError } = require('../utils/athleteIntegrity');
const { linkAthlete, retainUnchangedLinks } = require('../utils/customAthleteLinks');

test('partial role updates preserve current Libero, reject double flags, and clear flags when leaving L', () => {
    const current = { position:'L', is_libero1:1, is_libero2:0 };
    assert.deepEqual(normalizeAthleteRoles({is_libero1:'1'},current),{position:'L',is_libero1:true,is_libero2:false});
    assert.throws(()=>normalizeAthleteRoles({is_libero2:true},current),/L1/);
    assert.deepEqual(normalizeAthleteRoles({position:'OH'},current),{position:'OH',is_libero1:false,is_libero2:false});
    assert.throws(()=>normalizeAthleteRoles({position:'OH',is_libero1:1}),/ตำแหน่ง L/);
    assert.deepEqual(normalizeAthleteRoles({number:25},current),{number:25});
});

function response() { return { code:200,status(code){this.code=code;return this;},json(value){this.value=value;},send(value){this.value=value;} }; }
test('role changes roll back on failed validation and responses wait for commit', async()=>{
    for(const status of [200,400]) {
        const calls=[];
        const c={beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release')};
        const res=response();
        await withAthleteTransaction({connect:async()=>c},async(req,r)=>{assert.equal(res.value,undefined);r.status(status).json({ok:status===200});})({},res);
        assert.deepEqual(calls,['begin',status===200?'commit':'rollback','release']);assert.equal(res.code,status);
    }
});

function controller(file,query) {
    const filename=require.resolve(file),localRequire=createRequire(filename);
    const connection={query,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}};
    const scope={exports:{},module:{exports:{}},console:{error(){}},require:name=>name==='../config/db'?{query,connect:async()=>connection,pool:{connect:async()=>connection}}:name==='../utils/auditLogger'?{writeAuditLog(){}}:localRequire(name)};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),scope,{filename});
    return Object.keys(scope.module.exports).length ? scope.module.exports : scope.exports;
}
test('team master number edit does not rewrite locked competition snapshots',async()=>{
    const queries=[];
    const c=controller('../controllers/teamController',async(sql,args)=>{
        queries.push(sql);
        if(sql.includes('FROM users u'))return {rows:[{team_id:2}]};
        if(sql.includes('SELECT te.*')) return {rows:[{id:3,roster_locked_at:'2026-01-01',has_completed_match:1}]};
        if(sql.includes('AND (? IS NULL OR id<>?)')) return {rows:[]};
        if(sql.startsWith('UPDATE players'))return {rows:[],affectedRows:1};
        return {rows:[{id:5,team_id:2,number:args?.[0]===25?25:7,position:'OH'}]};
    });
    const res=response();await c.updatePlayer({params:{id:5},user:{id:1},body:{number:25}},res);
    assert.equal(res.code,200);assert.ok(queries.some(sql=>sql.startsWith('UPDATE players')));
    assert.ok(queries.every(sql=>!sql.trim().startsWith('DELETE FROM team_entry_players') && !sql.trim().startsWith('INSERT INTO team_entry_players')));
});

test('jersey validation checks team scope, excludes the edited player, and normalizes leading zeroes', async()=>{
    const calls=[];
    const connection={query:async(sql,args)=>{calls.push({sql,args});return {rows:[]};}};
    await validateTeamPlayerNumber(connection,2,'007',5);
    assert.deepEqual(calls[0].args,[2,7,5,5]);
    assert.ok(calls[0].sql.includes('COALESCE(is_active,1)=1'));
    await assert.rejects(validateTeamPlayerNumber({query:async()=>({rows:[{id:6}]})},2,7,5),error=>error.status===409);
    for(const value of ['',0,-1,1.5,'7x',1000,null]) await assert.rejects(validateTeamPlayerNumber(connection,2,value),error=>error.status===400);
    assert.equal(calls.length,1,'invalid input must not reach SQL');
    assert.equal(athleteError({code:'ER_DUP_ENTRY',message:'uq_players_team_active_number'}).status,409);
    assert.match(athleteError({code:'ER_DUP_ENTRY',message:'uq_players_team_active_number'}).message,/Jersey number/);
});
test('both player delete endpoints archive and preserve referenced rows',async()=>{
    for(const file of ['../controllers/teamController','../controllers/adminController']){
        const queries=[];const c=controller(file,async sql=>{queries.push(sql);return {rows:sql.includes('SELECT te.*')?[]:[{team_id:2}],affectedRows:1,rowCount:1};});
        const res=response();await c.deletePlayer({params:{id:5},user:{id:1}},res);
        assert.ok(res.code<400);assert.ok(queries.some(sql=>sql.includes('SET is_active = 0')));assert.ok(queries.every(sql=>!sql.startsWith('DELETE')));
    }
});
test('custom identity links require explicit admin confirmation and an existing active athlete',async()=>{
    const payload={config:{home:{players:[{id:1}]} }}, queries=[];
    const c={query:async(sql,args)=>{queries.push({sql,args});return {rows:[{id:8}]};}};
    await assert.rejects(linkAthlete(c,payload,'custom-1',{id:2,role:'vis'},{side:'home',localPlayerId:1,playerId:8}),/ผู้ดูแล/);
    assert.equal(queries.length,0);
    await linkAthlete(c,payload,'custom-1',{id:2,role:'admin'},{side:'home',localPlayerId:1,playerId:8});
    assert.ok(queries.some(q=>q.sql.includes('FOR UPDATE')));assert.ok(queries.some(q=>q.sql.startsWith('INSERT')));
    await assert.rejects(linkAthlete({query:async()=>({rows:[]})},payload,'x',{id:2,role:'admin'},{side:'home',localPlayerId:1,playerId:99}),/ทะเบียนหลัก/);
});
test('editing/reordering custom roster invalidates links instead of attaching a different person',async()=>{
    const queries=[], before={config:{home:{players:[{id:1,first_name:'A',last_name:'B'}]}}}, after={config:{home:{players:[{id:1,first_name:'C',last_name:'D'}]}}};
    await retainUnchangedLinks({query:async sql=>{queries.push(sql);return {rows:[{side:'home',local_player_id:1}]};}},'custom-1',before,after);
    assert.ok(queries.some(sql=>sql.startsWith('DELETE')));
});

test('manual entry saves are rejected because rosters come from the team register',async()=>{
    const queries=[];
    const c=controller('../controllers/competitionsController',async sql=>{queries.push(sql);return {rows:[]};});
    const res=response();
    await c.updateMyTeamEntryPlayers({params:{entryId:3},user:{id:1},body:{player_ids:[5]}},res);
    assert.equal(res.code,409);assert.equal(queries.length,0);
});
