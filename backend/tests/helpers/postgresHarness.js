const fs=require('node:fs');
const path=require('node:path');
const { randomBytes }=require('node:crypto');
const { createDatabase }=require('../../config/postgres');

async function setup() {
    const schema='volley_test_'+randomBytes(8).toString('hex');
    let db, engine;
    const staging=process.env.RUN_SUPABASE_STAGING_TESTS==='1';
    if(staging) {
        require('dotenv').config({path:path.join(__dirname,'../../.env'),quiet:true});
        if(!process.env.STAGING_DATABASE_URL)throw Error('STAGING_DATABASE_URL is required; production DATABASE_URL is never used');
        db=createDatabase({...process.env,DATABASE_URL:process.env.STAGING_DATABASE_URL,DB_PG_SCHEMA:schema,DB_SSL:'true',DB_POOL_MAX:'4'});
    } else {
        const {PGlite}=require('@electric-sql/pglite');
        engine=new PGlite({parsers:{1082:value=>value,20:value=>Number(value)}});
        const query=async input=>{
            const text=typeof input==='string'?input:input.text;
            const values=typeof input==='string'?[]:input.values;
            const result=await engine.query(text,values);
            return {...result,command:text.trim().split(/\s/)[0].toUpperCase(),rowCount:result.affectedRows??result.rows.length};
        };
        const driver={types:require('pg').types,Pool:class{
            on(){} async query(input){return query(input);} async connect(){return {query,release(){}};} async end(){await engine.close();}
        }};
        db=createDatabase({DATABASE_URL:'postgres://localhost/test',DB_SSL:'false',DB_PG_SCHEMA:schema},driver);
    }
    try {
        const migrations=path.join(__dirname,'../../migrations/postgres');
        if(engine) {
            for(const file of fs.readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())await engine.exec(fs.readFileSync(path.join(migrations,file),'utf8').replace(/\bvolley\b/g,schema));
            await engine.exec(`SET search_path TO ${schema}, public; SET timezone TO 'Asia/Bangkok'`);
        } else {
            const connection=await db.connect();
            try {
                for(const file of fs.readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())await connection.query(fs.readFileSync(path.join(migrations,file),'utf8').replace(/\bvolley\b/g,schema));
            } finally {connection.release();}
        }
    } catch(error) {await db.pool.end();throw error;}
    // Real controllers and their transitive utilities share the same database.
    const dbPath=require.resolve('../../config/db');
    require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:db};
    return {db,staging,schema,async close(){
        try {await db.query(`DROP SCHEMA ${schema} CASCADE`);} finally {await db.pool.end();delete require.cache[dbPath];}
    }};
}

async function invoke(controller,method,body={},params={},user={id:1,role:'admin'},query={}) {
    const res={code:200,status(code){this.code=code;return this;},json(data){this.data=data;return this;},send(data){this.data=data;return this;},set(){return this;},cookie(){},clearCookie(){},setHeader(){}};
    const req={body,params,user,query,headers:{},app:{get:()=>null},ip:'127.0.0.1'};
    await controller[method](req,res);
    return res;
}
module.exports={setup,invoke};
