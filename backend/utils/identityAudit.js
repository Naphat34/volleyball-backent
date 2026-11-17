async function identityAudit(connection,req,action,id,details){
    await connection.query('INSERT INTO audit_logs(user_id,username,role,action,entity_type,entity_id,details) VALUES(?,?,?,?,?,?,?)',
        [req.user?.id||null,req.user?.username||null,req.user?.role||null,action,'user',String(id),JSON.stringify(details)]);
}
module.exports={identityAudit};
