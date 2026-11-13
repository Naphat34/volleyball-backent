const {spawnSync}=require('node:child_process');
const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
if(!process.env.STAGING_DATABASE_URL) {
    console.error('STAGING_DATABASE_URL is missing. Supabase staging tests were NOT run.');
    process.exitCode=1;
} else {
    const result=spawnSync(process.execPath,['--test','tests/postgresSql.test.js','tests/postgresWorkflows.test.js'],{
        cwd:path.join(__dirname,'..'),stdio:'inherit',
        env:{...process.env,DB_PROVIDER:'postgres',RUN_SUPABASE_STAGING_TESTS:'1'},
    });
    process.exitCode=result.status??1;
}
