const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('MySQL saves English-only name edits while retaining Thai and legacy names', {skip:process.env.RUN_BILINGUAL_MYSQL !== '1'},async()=>{
    const db=require('../config/db'), connection=await db.connect();
    try {
        await connection.beginTransaction();
        const team=await connection.query('INSERT INTO teams(name,name_th,name_en,code) VALUES(?,?,?,?)',['ทีมทดสอบ','ทีมทดสอบ','Test Team','N'+Date.now().toString(36).slice(-8)]);
        const inserted=await connection.query('INSERT INTO players(team_id,number,first_name,last_name,first_name_th,last_name_th) VALUES(?,1,?,?,?,?)',[team.insertId,'สมชาย','ใจดี','สมชาย','ใจดี']);
        const filename=require.resolve('../controllers/adminController'), localRequire=createRequire(filename);
        const transaction={query:connection.query.bind(connection),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}};
        const scope={module:{exports:{}},console,require:name=>name==='../config/db'?{connect:async()=>transaction}:localRequire(name)};
        vm.runInNewContext(fs.readFileSync(filename,'utf8'),scope,{filename});
        const response={status(code){this.code=code;return this;},json(body){this.body=body;}};
        await scope.module.exports.updatePlayer({params:{id:inserted.insertId},body:{first_name_en:'Somchai',last_name_en:'Jaidee'}},response);
        assert.equal(response.code,200);
        const actual=(await connection.query('SELECT first_name,first_name_th,first_name_en,last_name_en FROM players WHERE id=?',[inserted.insertId])).rows[0];
        assert.equal(actual.first_name,'สมชาย');assert.equal(actual.first_name_th,'สมชาย');assert.equal(actual.first_name_en,'Somchai');assert.equal(actual.last_name_en,'Jaidee');
        assert.equal(response.body.first_name_en,'Somchai');
    } finally {await connection.rollback();connection.release();await db.pool.end();}
});
