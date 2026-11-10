const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { normalizeAthleteRoles, withAthleteTransaction } = require('../utils/athleteIntegrity');
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
test('team master number edit does not rewrite competition snapshots',async()=>{
    const queries=[];
    const c=controller('../controllers/teamController',async(sql,args)=>{
        queries.push(sql);
        if(sql.includes('FROM users u'))return {rows:[{team_id:2}]};
        if(sql.startsWith('UPDATE players'))return {rows:[],affectedRows:1};
        return {rows:[{id:5,team_id:2,number:args?.[0]===25?25:7,position:'OH'}]};
    });
    const res=response();await c.updatePlayer({params:{id:5},user:{id:1},body:{number:25}},res);
    assert.equal(res.code,200);assert.ok(queries.some(sql=>sql.startsWith('UPDATE players')));
    assert.ok(queries.every(sql=>!sql.includes('team_entry_players')));
});
test('both player delete endpoints archive and preserve referenced rows',async()=>{
    for(const file of ['../controllers/teamController','../controllers/adminController']){
        const queries=[];const c=controller(file,async sql=>{queries.push(sql);return {rows:[{team_id:2}],affectedRows:1,rowCount:1};});
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

test('entry saves preserve their own number, accept explicit overrides, and reject edits after match activity',async()=>{
    for(const mode of ['preserve','override','history']) {
        const queries=[];
        const c=controller('../controllers/competitionsController',async(sql,args)=>{
            const text=sql.trim();queries.push({text,args});
            if(text.startsWith('SELECT team_id FROM users'))return {rows:[{team_id:2}]};
            if(text.includes('FROM team_entries te') && text.includes('WHERE te.id'))return {rows:[{id:3,team_id:2,competition_id:4,max_players:14}]};
            if(text.startsWith('SELECT m.id FROM matches'))return {rows:mode==='history'?[{id:8}]:[]};
            if(text.startsWith('SELECT * FROM team_entry_players'))return {rows:[{player_id:5,number:7,role:'OH',is_captain:0,is_libero1:0,is_libero2:0,is_playing:1}]};
            if(text.startsWith('SELECT p.id, p.team_id'))return {rows:[{id:5,team_id:2,number:22,position:'OH',is_active:1}]};
            return {rows:[],affectedRows:1};
        });
        const res=response();await c.updateMyTeamEntryPlayers({params:{entryId:3},user:{id:1},body:{player_ids:[5],...(mode==='override'?{players:[{id:5,number:9,role:'L1'}]}:{})}},res);
        if(mode==='history') {assert.equal(res.code,409);assert.ok(!queries.some(q=>q.text.startsWith('DELETE')));}
        else {assert.equal(res.code,200);const inserted=queries.find(q=>q.text.startsWith('INSERT INTO team_entry_players'));assert.equal(inserted.args[2],mode==='override'?9:7);assert.ok(!queries.some(q=>q.text.startsWith('UPDATE players')));}
    }
});
