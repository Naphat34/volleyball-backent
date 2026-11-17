const {pathReferences}=require('../../middleware/publicUrl');
const schema=require('../../config/publicIdRoutes.json');

// Test fixtures retain integer keys for readable setup; HTTP requests use the
// same UUID contract as real callers. Invalid identifiers remain invalid.
async function publicTestUrl(db,to){
    const url=new URL(to,'http://fixture');
    const prefix=url.pathname.startsWith('/api/')?'/api':'';
    let path=url.pathname.slice(prefix.length);
    const refs=pathReferences(path);
    for(const [key,value]of url.searchParams)if(schema.query[key]&&value)refs.push({entity:schema.query[key],value,key});
    for(const ref of refs.sort((a,b)=>(b.start||0)-(a.start||0))){
        let value;
        try{value=decodeURIComponent(ref.value);}catch{continue;}
        if(!/^\d+$/.test(value)&&!/^custom-[0-9a-f-]{36}$/i.test(value))continue;
        const entity=ref.entity==='matchRecords'?'matches':ref.entity;
        const row=(await db.query(`SELECT public_id FROM ${entity} WHERE id=?`,[value])).rows[0];
        let replacement=row?.public_id||(/^custom-/.test(value)?value.slice(7):'ffffffff-ffff-4fff-8fff-ffffffffffff');
        if(ref.value.includes('%'))replacement='%'+replacement.charCodeAt(0).toString(16)+replacement.slice(1);
        if(ref.key)url.searchParams.set(ref.key,replacement);
        else path=path.slice(0,ref.start)+replacement+path.slice(ref.end);
    }
    url.pathname=prefix+path;
    return /^https?:/.test(to)?url.href:url.pathname+url.search;
}
module.exports={publicTestUrl};
