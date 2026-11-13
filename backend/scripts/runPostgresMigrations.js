const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Pool}=require('pg');
const {poolOptions}=require('../config/postgres');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});

async function run() {
    const seeds=process.argv.includes('--seed');
    const history=seeds?'seed_migrations':'schema_migrations';
    const directory=path.join(__dirname,seeds?'../seeds/postgres':'../migrations/postgres');
    const files=()=>fs.readdirSync(directory).filter(file=>file.endsWith('.sql')).sort();
    // This command intentionally never falls back to production DATABASE_URL.
    if(!process.env.STAGING_DATABASE_URL)throw Error('Set STAGING_DATABASE_URL for a separate staging project');
    const pool=new Pool(poolOptions({...process.env,DATABASE_URL:process.env.STAGING_DATABASE_URL,DB_SSL:'true'}));
    let client;
    try {
        client=await pool.connect();
        if(!process.argv.includes('--apply')) {
            const present=await client.query('SELECT to_regclass($1) AS present',[`volley_meta.${history}`]);
            const applied=present.rows[0].present?(await client.query(`SELECT filename FROM volley_meta.${history}`)).rows:[];
            for(const file of files())console.log(`${applied.some(row=>row.filename===file)?'applied':'pending'} ${file}`);
            return;
        }
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('volley_postgres_migrations'))");
        await client.query('CREATE SCHEMA IF NOT EXISTS volley_meta');
        await client.query('REVOKE ALL ON SCHEMA volley_meta FROM PUBLIC');
        await client.query(`CREATE TABLE IF NOT EXISTS volley_meta.${history} (filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
        const applied=(await client.query(`SELECT filename,checksum FROM volley_meta.${history}`)).rows;
        for(const file of files()) {
            const sql=fs.readFileSync(path.join(directory,file),'utf8');
            const checksum=createHash('sha256').update(sql).digest('hex');
            const previous=applied.find(row=>row.filename===file);
            if(previous) {if(previous.checksum!==checksum)throw Error(`Applied migration changed: ${file}`);continue;}
            await client.query(sql);
            await client.query(`INSERT INTO volley_meta.${history} (filename,checksum) VALUES ($1,$2)`,[file,checksum]);
            console.log(`applied ${file}`);
        }
        await client.query('COMMIT');
    } catch(error) {
        if(client)await client.query('ROLLBACK');
        throw error;
    } finally {if(client)client.release();await pool.end();}
}
if(require.main===module)run().catch(error=>{console.error('PostgreSQL migration failed:',error.code||error.message);process.exitCode=1;});
module.exports={run};
