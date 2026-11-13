// Adopt a manually installed baseline only after comparing its actual structure.
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
const {Client}=require('pg');
const {poolOptions}=require('../config/postgres');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});

async function describe(client,schema){
    const queries={
        columns:`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,
        constraints:`SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY c.relname,k.conname`,
        indexes:`SELECT c.relname,i.relname AS name,pg_get_indexdef(i.oid) AS definition FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY c.relname,i.relname`,
        triggers:`SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
        functions:`SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND (p.proname='touch_updated_at' OR (p.proname='valid_json' AND pg_get_function_identity_arguments(p.oid)='value text')) ORDER BY p.proname`,
    };
    const result={};
    for(const [name,sql] of Object.entries(queries)){
        const rows=(await client.query(sql,[schema])).rows;
        result[name]=JSON.stringify(rows).replaceAll(schema+'.','').replaceAll('"'+schema+'".','');
    }
    return result;
}

async function run(){
    if(!process.env.STAGING_DATABASE_URL)throw Error('STAGING_DATABASE_URL is required');
    const client=new Client(poolOptions({...process.env,DATABASE_URL:process.env.STAGING_DATABASE_URL,DB_SSL:'true'}));
    const verification='volley_verify_'+randomBytes(8).toString('hex');
    const sql=fs.readFileSync(path.join(__dirname,'../migrations/postgres/001_baseline.sql'),'utf8');
    try{
        await client.connect();await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('volley_postgres_migrations'))");
        await client.query(sql.replace(/\bvolley\b/g,verification));
        const actual=await describe(client,'volley'),expected=await describe(client,verification);
        const differences=Object.keys(expected).filter(key=>actual[key]!==expected[key]);
        if(differences.length)throw Error('Existing baseline differs in: '+differences.join(', '));
        await client.query(`DROP SCHEMA ${verification} CASCADE`);
        if(!process.argv.includes('--apply')){await client.query('ROLLBACK');console.log('Existing baseline matches; no migration history changed.');return;}
        await client.query('CREATE SCHEMA IF NOT EXISTS volley_meta');
        await client.query('REVOKE ALL ON SCHEMA volley_meta FROM PUBLIC');
        await client.query('CREATE TABLE IF NOT EXISTS volley_meta.schema_migrations (filename text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
        const checksum=createHash('sha256').update(sql).digest('hex');
        const previous=(await client.query('SELECT checksum FROM volley_meta.schema_migrations WHERE filename=$1',['001_baseline.sql'])).rows[0];
        if(previous&&previous.checksum!==checksum)throw Error('Baseline checksum mismatch');
        await client.query('INSERT INTO volley_meta.schema_migrations (filename,checksum) VALUES ($1,$2) ON CONFLICT (filename) DO NOTHING',['001_baseline.sql',checksum]);
        await client.query('COMMIT');console.log('Verified and adopted existing baseline; application records unchanged.');
    }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}
    finally{await client.end();}
}
if(require.main===module)run().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
