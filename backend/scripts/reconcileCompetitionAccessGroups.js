const fs=require('node:fs'),path=require('node:path');
const {Client}=require('pg');
const dotenv=require('dotenv');
const {localOptions}=require('./migrateLocalAccess');
const {competitionAccessGroups,competitionColumns}=require('../utils/competitionAccessGroups');
function planAccessExpansion(groups,grants){
    const active=new Set(grants.filter(row=>!row.revoked_at).map(row=>`${row.user_id}:${row.competition_id}`)),plan=[];
    for(const group of groups)for(const userId of new Set(grants.filter(row=>!row.revoked_at&&group.competition_ids.includes(Number(row.competition_id))).map(row=>Number(row.user_id)))){
        for(const competitionId of group.competition_ids)if(!active.has(`${userId}:${competitionId}`)){
            if(grants.some(row=>Number(row.user_id)===userId&&Number(row.competition_id)===competitionId&&row.revoked_at))throw Error('REVOKED_SIBLING_REQUIRES_REVIEW');
            plan.push({user_id:userId,competition_id:competitionId});active.add(`${userId}:${competitionId}`);
        }
    }
    return plan;
}
async function run({apply=false,actorId=1}={}){
    const env=dotenv.parse(fs.readFileSync(path.join(__dirname,'../.env'))),c=new Client(localOptions(env));
    try{
        await c.connect();await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'; SET LOCAL search_path TO volley,public");
        await c.query("SELECT pg_advisory_xact_lock(hashtext('volley-account-administration'))");
        const users=(await c.query('SELECT id,username,role,status FROM users ORDER BY id FOR UPDATE')).rows;
        const actor=users.find(row=>Number(row.id)===Number(actorId)&&row.role==='super_admin'&&row.status==='active');
        if(!actor)throw Error('ACTIVE_LOCAL_SUPER_ADMIN_REQUIRED');
        const competitions=(await c.query(`SELECT ${competitionColumns} FROM competitions ORDER BY id FOR SHARE`)).rows;
        const grants=(await c.query('SELECT * FROM user_competition_access ORDER BY user_id,competition_id FOR UPDATE')).rows;
        const groups=competitionAccessGroups(competitions),plan=planAccessExpansion(groups,grants);
        console.log(JSON.stringify({competition_groups:groups,missing_access:plan}));
        if(!apply){await c.query('ROLLBACK');return;}
        if(!plan.length){await c.query('ROLLBACK');console.log('No existing access needs expansion.');return;}
        const directory=path.resolve(__dirname,'../../tmp/master-data-audit');fs.mkdirSync(directory,{recursive:true});
        const backup=path.join(directory,`competition-access-before-grouping-${Date.now()}.json`);
        fs.writeFileSync(backup,JSON.stringify({competitions,grants,plan},null,2));
        for(const row of plan)await c.query('INSERT INTO user_competition_access(user_id,competition_id,granted_by) VALUES($1,$2,$3)',[row.user_id,row.competition_id,actorId]);
        await c.query("INSERT INTO audit_logs(user_id,username,role,action,entity_type,details) VALUES($1,$2,'super_admin','identity.expand_competition_groups','competition_access',$3)",[actorId,actor.username,JSON.stringify({reason:'User approved shared Male/Female competition access',added:plan,groups})]);
        await c.query('COMMIT');console.log(`Expanded ${plan.length} local competition grants; previous grant metadata backed up.`);
    }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{await c.end();}
}
if(require.main===module)run({apply:process.argv.includes('--apply')}).catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
module.exports={planAccessExpansion,run};
