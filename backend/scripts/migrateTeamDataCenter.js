// Apply only migration 008 to the configured PostgreSQL database.
// Coordinate deployment with the backend; old automatic roster writers must be stopped.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Pool}=require('pg');
const {poolOptions}=require('../config/postgres');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
async function run(){
    if(process.env.DB_PROVIDER!=='postgres')throw Error('This migration requires DB_PROVIDER=postgres');
    if(process.env.DB_PG_SCHEMA&&process.env.DB_PG_SCHEMA!=='volley')throw Error('Migration 008 targets the volley schema; verify DB_PG_SCHEMA');
    const pool=new Pool(poolOptions(process.env));let c;
    const file='008_team_data_center.sql',sql=fs.readFileSync(path.join(__dirname,'../migrations/postgres',file),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
    try{
        c=await pool.connect();
        const present=(await c.query("SELECT to_regclass('volley.team_data_history') AS present")).rows[0].present;
        if(!process.argv.includes('--apply')){console.log(present?'Team data center schema exists; verify migration history before deployment.':'Migration 008 is pending. Stop old backend writers and back up the database before applying.');return;}
        await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('volley_postgres_migrations'))");
        await c.query('CREATE SCHEMA IF NOT EXISTS volley_meta');await c.query('REVOKE ALL ON SCHEMA volley_meta FROM PUBLIC');
        await c.query('CREATE TABLE IF NOT EXISTS volley_meta.schema_migrations(filename text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
        const previous=(await c.query('SELECT checksum FROM volley_meta.schema_migrations WHERE filename=$1',[file])).rows[0];
        if(previous){if(previous.checksum!==checksum)throw Error('Migration checksum differs; do not overwrite applied schema');}
        else{if(present)throw Error('Schema already exists without matching migration history; inspect before applying');await c.query(sql);await c.query('INSERT INTO volley_meta.schema_migrations(filename,checksum) VALUES($1,$2)',[file,checksum]);}
        await c.query('COMMIT');console.log('Migration 008 is applied. Deploy the updated backend and frontend together.');
    }catch(error){if(c)await c.query('ROLLBACK');throw error;}finally{c?.release();await pool.end();}
}
if(require.main===module)run().catch(error=>{console.error('Team data center migration failed:',error.code||error.message);process.exitCode=1;});
module.exports={run};
