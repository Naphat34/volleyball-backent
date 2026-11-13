const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {resolvePublicId,uuidPattern}=require('../middleware/publicId');
const uuid='1eef4efa-04dd-4ffb-96b0-265953ec981b';
const response=()=>({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('UUID migration backfills old rows, generates new UUIDs, and preserves integer IDs, hashes and foreign keys',async()=>{
    const db=new PGlite();
    const migrations=path.join(__dirname,'../migrations/postgres');
    try{
        for(const file of ['001_baseline.sql','002_json_helpers.sql'])await db.exec(fs.readFileSync(path.join(migrations,file),'utf8'));
        await db.exec("INSERT INTO users (id,username,password_hash,role,status) VALUES (7,'before-a','unchanged-a','admin','active'),(8,'before-b','unchanged-b','team_staff','active')");
        const foreignKeys=()=>db.query("SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='volley' AND k.contype IN ('p','f') ORDER BY c.relname,k.conname");
        const before=(await foreignKeys()).rows;
        await db.exec(fs.readFileSync(path.join(migrations,'003_public_uuid_identifiers.sql'),'utf8'));
        assert.deepEqual((await foreignKeys()).rows,before);
        const columns=(await db.query("SELECT table_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='volley' AND column_name='public_id'")).rows;
        assert.equal(columns.length,20);
        assert.ok(columns.every(column=>column.data_type==='uuid'&&column.is_nullable==='NO'&&column.column_default.includes('gen_random_uuid')));
        const users=(await db.query('SELECT id,username,password_hash,public_id FROM users ORDER BY id')).rows;
        assert.deepEqual(users.map(user=>[user.id,user.password_hash]),[[7,'unchanged-a'],[8,'unchanged-b']]);
        assert.ok(users.every(user=>uuidPattern.test(user.public_id)));
        assert.notEqual(users[0].public_id,users[1].public_id);
        const inserted=(await db.query("INSERT INTO users (id,username,password_hash) VALUES (9,'after','unchanged-c') RETURNING id,public_id")).rows[0];
        assert.equal(inserted.id,9);assert.ok(uuidPattern.test(inserted.public_id));
        await assert.rejects(db.query("INSERT INTO users (id,username,password_hash,public_id) VALUES (10,'duplicate','x',$1)",[users[0].public_id]),{code:'23505'});
        await assert.rejects(db.query('UPDATE users SET public_id=NULL WHERE id=7'),{code:'23502'});
    }finally{await db.close();}
});

test('legacy integer URLs pass through without database work; UUIDs resolve with bound values',async()=>{
    const calls=[],database={query:async(sql,params)=>{calls.push({sql,params});return {rows:[{id:42}]};}};
    const resolve=resolvePublicId('teams','teamId',{database});
    let next=0;
    const numeric={params:{teamId:'42'}};
    await resolve(numeric,response(),()=>next++);
    assert.equal(calls.length,0);assert.equal(numeric.params.teamId,'42');
    const external={params:{teamId:uuid}};
    await resolve(external,response(),()=>next++);
    assert.equal(external.params.teamId,'42');assert.equal(next,2);
    assert.deepEqual(calls,[{sql:'SELECT id FROM teams WHERE public_id = ?',params:[uuid]}]);
});

test('query UUIDs work with Express 5 query getters without dropping other filters',async()=>{
    const request={params:{teamId:'2'}};
    Object.defineProperty(request,'query',{get:()=>({competitionId:uuid,other:'keep'}),configurable:true});
    let next=0;
    await resolvePublicId('competitions','competitionId',{query:true,database:{query:async()=>({rows:[{id:3}]})}})(request,response(),()=>next++);
    assert.deepEqual(request.query,{competitionId:'3',other:'keep'});assert.equal(next,1);
});

test('invalid IDs never reach SQL, missing UUIDs return 404, and table names are whitelisted',async()=>{
    let calls=0,next=0;
    const resolve=resolvePublicId('players','id',{database:{query:async()=>{calls++;return {rows:[]};}}});
    const invalid=response();await resolve({params:{id:"1'; DROP TABLE users;--"}},invalid,()=>next++);
    assert.equal(invalid.code,400);assert.equal(calls,0);
    const missing=response();await resolve({params:{id:uuid}},missing,()=>next++);
    assert.equal(missing.code,404);assert.equal(next,0);
    assert.throws(()=>resolvePublicId('users;drop table teams','id'),/Unsupported/);
});
