const allowedTables=new Set(['competitions','teams','players']);
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Resolve external UUIDs before existing controllers; their ACLs and numeric logic
// still run exactly as they do for legacy integer URLs. No body/JWT IDs are changed.
function resolvePublicId(table,key,{query=false,database}={}){
    if(!allowedTables.has(table))throw Error('Unsupported public identifier table');
    return async(req,res,next)=>{
        const value=query?req.query[key]:req.params[key];
        if(query&&(value===undefined||value===''))return next();
        if(typeof value!=='string')return res.status(400).json({error:'Invalid identifier'});
        if(/^\d+$/.test(value))return next();
        if(!uuidPattern.test(value))return res.status(400).json({error:'Invalid identifier'});
        try{
            const db=database||require('../config/db');
            const result=await db.query(`SELECT id FROM ${table} WHERE public_id = ?`,[value]);
            if(!result.rows.length)return res.status(404).json({error:'Record not found'});
            if(query)Object.defineProperty(req,'query',{value:{...req.query,[key]:String(result.rows[0].id)},configurable:true,writable:true,enumerable:true});
            else req.params[key]=String(result.rows[0].id);
            return next();
        }catch(error){
            console.error('Public identifier lookup failed:',error.code||error.name);
            return res.status(500).json({error:'Unable to load record'});
        }
    };
}
module.exports={resolvePublicId,uuidPattern};
