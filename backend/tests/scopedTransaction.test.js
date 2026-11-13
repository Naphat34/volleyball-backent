const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createRequire}=require('node:module');
function controller(){
    const file=require.resolve('../controllers/scorerOfflineController'),localRequire=createRequire(file);
    const probe=`const db=require('../config/db'); module.exports={probe:async()=>{const connection=await db.connect();try{await connection.beginTransaction();await connection.query('BEGIN');await connection.query('SELECT probe');await connection.query('COMMIT');await connection.commit();}catch(error){await connection.rollback();throw error;}finally{connection.release();}}};`;
    const scopedRequire=name=>name==='../config/db'?{}:name==='node:fs'?{...fs,readFileSync:()=>probe}:localRequire(name);
    scopedRequire.resolve=localRequire.resolve;
    const scope={exports:{},require:scopedRequire,console};
    vm.runInNewContext(fs.readFileSync(file,'utf8'),scope,{filename:file});
    return scope.exports;
}
test('scoped helpers leave outer transaction lifecycle to its owner',async()=>{
    const lifecycle=[],queries=[];
    const connection={query:async sql=>{queries.push(sql);return {rows:[]};},beginTransaction:async()=>lifecycle.push('begin'),commit:async()=>lifecycle.push('commit'),rollback:async()=>lifecycle.push('rollback'),release:()=>lifecycle.push('release')};
    await controller().scopedController(connection).probe();
    assert.deepEqual(queries,['SELECT probe']);
    assert.deepEqual(lifecycle,[]);
});
test('nested rollback preserves the original failure without rolling back or releasing the owner',async()=>{
    const error=new Error('original roster query failure');let lifecycle=0;
    const connection={query:async()=>{throw error;},rollback:async()=>lifecycle++,release:()=>lifecycle++};
    await assert.rejects(controller().scopedController(connection).probe(),actual=>actual===error);
    assert.equal(lifecycle,0);
});
