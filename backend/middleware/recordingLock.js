const { Client } = require('pg');
const { poolOptions } = require('../config/postgres');
const { normalizeRole } = require('../config/permissions');
const { assertMatch, denied } = require('../utils/accessScope');
const lockKey = (kind,id) => {
    // PostgreSQL resolves 001 and 1 to the same integer row; serialize them together.
    const resource=kind==='match'&&/^\d+$/.test(String(id))?BigInt(String(id)).toString():String(id);
    return `volley-access:${process.env.DB_PG_SCHEMA||'volley'}:${kind}:${resource}`;
};
async function holdRecordingAccess(req,res,kind,id,permission,options) {
    // Separate connection: controllers use their existing transactions/pool without nesting BEGIN.
    const client = new Client(poolOptions(process.env));
    let closed=false;
    const close=async()=>{ if(closed)return;closed=true;try{await client.query('ROLLBACK');}finally{await client.end();} };
    try {
        await client.connect();
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout='5s'");
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[lockKey(kind,id)]);
        const user=(await client.query('SELECT id,role,status,team_id,authorization_version FROM users WHERE id=$1 FOR SHARE',[req.user.id])).rows[0];
        if (!user||user.status!=='active'||normalizeRole(user.role)!==normalizeRole(req.user.role)||Number(user.authorization_version)!==Number(req.user.authorization_version)) throw denied('Account permissions changed');
        // Permission changes update this account via a trigger, so the shared user lock also serializes revocation.
        const db={query:async(sql,params)=>(await client.query(require('../config/postgres').prepareSql(sql,params)))};
        try {await assertMatch(db,user,kind,id,permission,options);}
        catch(error){
            if(!(error.status===404&&options?.allowCreate&&permission==='vims.record'&&normalizeRole(user.role)==='vims_operator'))throw error;
        }
        res.once('finish',()=>{void close().catch(()=>{});});
        if(kind==='match'&&['score.record','vims.record'].includes(permission))await require('../utils/competitionWorkflowStore').assertRecording(db,id);
        res.once('close',()=>{void close().catch(()=>{});});
    } catch(error) { await close().catch(()=>{}); if(error.code==='55P03')throw denied('Match is busy; retry shortly',409);throw error; }
}
module.exports={holdRecordingAccess,lockKey};
