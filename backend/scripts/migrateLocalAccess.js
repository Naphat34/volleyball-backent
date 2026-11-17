const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomBytes}=require('node:crypto');
const {Client}=require('pg');
const dotenv=require('dotenv');
const {poolOptions}=require('../config/postgres');
const {describe}=require('./adoptPostgresBaseline');
const {spawnSync}=require('node:child_process');
function localOptions(env){
    const options=poolOptions(env);
    if(env.DB_PROVIDER!=='postgres'||options.connectionString||!['localhost','127.0.0.1','::1'].includes(options.host)
        ||options.database!=='Volley_db2026'||options.port!==5432||(env.DB_PG_SCHEMA||'volley')!=='volley')throw Error('LOCAL_VOLLEY_DATABASE_REQUIRED');
    return options;
}
async function equivalentLiberoConstraint(c,actual,expected,reference){
    const keep=rows=>JSON.parse(rows).filter(r=>!(r.relname==='team_entry_players'&&r.conname==='chk_entry_libero'));
    if(JSON.stringify(keep(actual.constraints))!==JSON.stringify(keep(expected.constraints)))return false;
    const expression=async schema=>(await c.query("SELECT pg_get_expr(conbin,conrelid) AS expression FROM pg_constraint WHERE conrelid=($1||'.team_entry_players')::regclass AND conname='chk_entry_libero'",[schema])).rows[0]?.expression;
    const a=await expression('volley'),b=await expression(reference);
    if(!a||!b)return false;
    const result=(await c.query(`SELECT count(*)::int AS cases,count(*) FILTER(WHERE (${a}) IS DISTINCT FROM (${b}))::int AS differences
        FROM unnest(ARRAY[NULL,'','L','L1','L1+C','L2','L2+C','C','OH','unknown']::varchar[]) AS r(role)
        CROSS JOIN unnest(ARRAY[NULL,-1,0,1,2]) AS x(is_libero1) CROSS JOIN unnest(ARRAY[NULL,-1,0,1,2]) AS y(is_libero2)`)).rows[0];
    return result.cases===250&&result.differences===0;
}
async function run({apply=false,acceptEquivalentLibero=false}={}) {
    const env=dotenv.parse(fs.readFileSync(path.join(__dirname,'../.env'))),options=localOptions(env);
    const c=new Client(options),directory=path.join(__dirname,'../migrations/postgres');
    const files=['001_baseline.sql','002_json_helpers.sql','003_public_uuid_identifiers.sql','004_access_control.sql'];
    try{
        await c.connect();await c.query('BEGIN');
        await c.query("SET LOCAL lock_timeout='5s'");
        await c.query("SELECT pg_advisory_xact_lock(hashtext('volley_postgres_migrations'))");
        const present=(await c.query("SELECT to_regclass('volley_meta.schema_migrations') AS name")).rows[0].name;
        const history=present?(await c.query('SELECT filename,checksum FROM volley_meta.schema_migrations')).rows:[];
        for(const previous of history){
            if(!files.includes(previous.filename))throw Error('UNREVIEWED_MIGRATION_HISTORY');
            const hash=createHash('sha256').update(fs.readFileSync(path.join(directory,previous.filename))).digest('hex');
            if(hash!==previous.checksum)throw Error('MIGRATION_CHECKSUM_MISMATCH');
        }
        if(history.some(h=>h.filename==='004_access_control.sql')){await c.query('ROLLBACK');console.log('Access migration already applied; checksums verified.');return;}
        const reference='volley_verify_'+randomBytes(8).toString('hex');
        for(const file of files.slice(0,3))await c.query(fs.readFileSync(path.join(directory,file),'utf8').replace(/\bvolley\b/g,reference));
        const actual=await describe(c,'volley'),expected=await describe(c,reference);
        let different=Object.keys(expected).filter(key=>actual[key]!==expected[key]);
        if(acceptEquivalentLibero&&different.length===1&&different[0]==='constraints'&&await equivalentLiberoConstraint(c,actual,expected,reference)){
            different=[];console.log('Verified the explicitly accepted Libero cast difference in 250 synthetic cases; original constraint retained.');
        }
        if(different.length)throw Error('SCHEMA_DIFFERS:'+different.join(','));
        const functions=async schema=>JSON.stringify((await c.query("SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 ORDER BY p.proname,args",[schema])).rows.map(row=>({...row,definition:row.definition.replace(/\r\n/g,'\n')}))).replaceAll(schema+'.','').replaceAll('"'+schema+'".','');
        if(await functions('volley')!==await functions(reference))throw Error('SCHEMA_FUNCTIONS_DIFFER');
        // Generated schema is created only inside this transaction, in this explicitly local database.
        await c.query(`DROP SCHEMA ${reference} CASCADE`);
        await c.query('SET search_path TO volley, public');
        if(!apply){await c.query('ROLLBACK');console.log('Local schema matches migrations 001-003; ready to adopt history and apply 004. No changes committed.');return;}
        const backupDirectory=path.resolve(__dirname,'../../tmp/master-data-audit');
        fs.mkdirSync(backupDirectory,{recursive:true});
        const backup=path.join(backupDirectory,`access-before-004-${Date.now()}.dump`);
        const dump=spawnSync('D:/Program Files/PostgreSQL/18/bin/pg_dump.exe',
            ['--format=custom','--schema=volley','--no-owner','--no-acl','--dbname=Volley_db2026','--file',backup],
            {env:{...process.env,PGHOST:options.host,PGPORT:String(options.port),PGUSER:options.user,PGPASSWORD:options.password,
                PGSSLMODE:options.ssl===false?'disable':'verify-full',PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on'},
            windowsHide:true,encoding:'utf8',timeout:120000});
        if(dump.error||dump.status!==0||!fs.existsSync(backup)||fs.statSync(backup).size===0)throw Error('PRE_MIGRATION_BACKUP_FAILED');
        console.log('Saved a local application-schema backup before migration 004.');
        await c.query('CREATE SCHEMA IF NOT EXISTS volley_meta');
        await c.query('REVOKE ALL ON SCHEMA volley_meta FROM PUBLIC');
        await c.query('CREATE TABLE IF NOT EXISTS volley_meta.schema_migrations(filename text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
        for(const file of files){
            const sql=fs.readFileSync(path.join(directory,file),'utf8');
            if(file==='004_access_control.sql')await c.query(sql);
            await c.query('INSERT INTO volley_meta.schema_migrations(filename,checksum) VALUES($1,$2) ON CONFLICT(filename) DO NOTHING',[file,createHash('sha256').update(sql).digest('hex')]);
        }
        await c.query('COMMIT');console.log('Adopted local schema history and applied access control migration 004.');
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{await c.end();}
}
if(require.main===module)run({apply:process.argv.includes('--apply'),acceptEquivalentLibero:process.argv.includes('--accept-equivalent-libero')}).catch(e=>{console.error('Local access migration failed:',e.code||e.message);process.exitCode=1;});
module.exports={run,localOptions,equivalentLiberoConstraint};
