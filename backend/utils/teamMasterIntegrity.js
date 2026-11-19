const {denied}=require('./accessScope');
const {normalizeNames}=require('./bilingualNames');
const clean=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10);
const safeFields=['id','first_name','last_name','first_name_th','last_name_th','first_name_en','last_name_en','birth_date','gender','number','position','role','is_active'];
const safe=row=>row?Object.fromEntries(safeFields.filter(key=>row[key]!==undefined).map(key=>[key,key==='birth_date'?day(row[key]):row[key]])):null;
async function checkDuplicatePerson(c,table,teamId,body,current=null){
    if(!['players','team_staff'].includes(table))throw Error('Invalid master table');
    const names=table==='players'?normalizeNames(body,current||{}):{...current,...body};
    const first=names.first_name??current?.first_name,last=names.last_name??current?.last_name;
    if(!clean(first)||!clean(last))throw denied('First and last name are required',400);
    const birth=body.birth_date===undefined?day(current?.birth_date):day(body.birth_date);
    if(table==='players'&&birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(Date.parse(birth))||new Date(birth).toISOString().slice(0,10)!==birth||birth>new Date().toISOString().slice(0,10)))throw denied('Invalid birth date',400);
    const rows=(await c.query(`SELECT id,first_name,last_name${table==='players'?',birth_date':''} FROM ${table} WHERE team_id=? AND id<>?`,[teamId,current?.id||0])).rows;
    const candidates=rows.filter(row=>clean(row.first_name)===clean(first)&&clean(row.last_name)===clean(last)&&!(table==='players'&&birth&&day(row.birth_date)&&birth!==day(row.birth_date)));
    if(!candidates.length)return;
    const exact=table==='players'&&birth&&candidates.some(row=>day(row.birth_date)===birth);
    if(exact||body.allow_similar!==true||String(body.duplicate_reason||'').trim().length<5){
        const error=denied(exact?'This athlete already exists in your team':'Possible duplicate person; select the existing record or explain why this is a different person',409);
        error.candidates=candidates;error.duplicate=exact?'exact':'similar';throw error;
    }
}
async function history(c,req,teamId,kind,before,after,action='master.update'){
    await c.query('INSERT INTO team_data_history(team_id,actor_id,action,person_kind,person_id,before_data,after_data,reason) VALUES(?,?,?,?,?,?,?,?)',
        [teamId,req.user.id,action,kind,after?.id||before?.id,JSON.stringify(safe(before)),JSON.stringify(safe(after)),String(req.body?.duplicate_reason||req.body?.reason||'').trim()||null]);
}
module.exports={checkDuplicatePerson,history,safe,day};
