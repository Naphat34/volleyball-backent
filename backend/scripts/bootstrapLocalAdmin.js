const fs=require('node:fs');
const path=require('node:path');
const dotenv=require('dotenv');
const bcrypt=require('bcryptjs');
const {Client}=require('pg');
const {poolOptions}=require('../config/postgres');
async function run(){
    const env=dotenv.parse(fs.readFileSync(path.join(__dirname,'../.env'))),options=poolOptions(env);
    if(options.connectionString||!['localhost','127.0.0.1','::1'].includes(options.host)||options.database!=='Volley_db2026')throw Error('LOCAL_DATABASE_REQUIRED');
    const username=String(env.BOOTSTRAP_ADMIN_USERNAME||'').trim(),password=String(env.BOOTSTRAP_ADMIN_PASSWORD||'');
    if(!username||username.length>50||password.length<8)throw Error('SET_BOOTSTRAP_ADMIN_USERNAME_AND_PASSWORD_IN_LOCAL_ENV');
    const hash=await bcrypt.hash(password,10),c=new Client(options);
    try{
        await c.connect();await c.query('BEGIN');
        await c.query("SELECT pg_advisory_xact_lock(hashtext('volley-account-administration'))");
        if(Number((await c.query('SELECT COUNT(*) AS count FROM volley.users')).rows[0].count)!==0)throw Error('EXISTING_USERS_REQUIRE_REVIEW_NO_ACCOUNT_CHANGED');
        const user=(await c.query("INSERT INTO volley.users(username,password_hash,role,status) VALUES($1,$2,'super_admin','active') RETURNING id",[username,hash])).rows[0];
        await c.query("INSERT INTO volley.audit_logs(user_id,username,role,action,entity_type,entity_id,details) VALUES($1,$2,'super_admin','identity.bootstrap','user',$3,'{}')",[user.id,username,String(user.id)]);
        await c.query('COMMIT');console.log('Created the initial local super_admin. No password was printed.');
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{await c.end();}
}
if(require.main===module)run().catch(error=>{console.error('Local bootstrap failed:',error.code||error.message);process.exitCode=1;});
module.exports={run};
