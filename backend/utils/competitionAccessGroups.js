const normalize=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const cleanTitle=value=>String(value??'').replace(/\s*\(\s*(male|female|men|women|ชาย|หญิง)\s*\)\s*$/i,'').replace(/\s+(male|female|men|women|ชาย|หญิง)\s*$/i,'').trim();
const date=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10);
function competitionAccessGroups(rows){
    const candidates=new Map(),result=[];
    for(const row of rows){
        const gender=normalize(row.gender),sex=['male','men','ชาย'].includes(gender)?'male':['female','women','หญิง'].includes(gender)?'female':null;
        const title=cleanTitle(row.title_th||row.title||row.title_en);
        const key=JSON.stringify([normalize(title),normalize(cleanTitle(row.title_en)),normalize(row.sport),row.age_group_id??null,
            date(row.start_date),date(row.end_date),normalize(row.location),row.stadium_id??null]);
        if(!title||!sex){result.push([row]);continue;}
        if(!candidates.has(key))candidates.set(key,[]);
        candidates.get(key).push({row,sex});
    }
    for(const members of candidates.values()){
        // A duplicated same-sex row is ambiguous; never widen its permissions automatically.
        if(members.length<=2&&new Set(members.map(item=>item.sex)).size===members.length)result.push(members.map(item=>item.row));
        else for(const item of members)result.push([item.row]);
    }
    return result.map(members=>{
        const ids=members.map(row=>Number(row.id)).sort((a,b)=>a-b),first=members[0];
        return {key:`competition-${ids.join('-')}`,title:cleanTitle(first.title_th||first.title||first.title_en),competition_ids:ids};
    });
}
const competitionColumns='id,title,title_th,title_en,sport,gender,age_group_id,start_date,end_date,location,stadium_id';
async function expandCompetitionAccess(db,ids){
    if(!ids.length)return [];
    const groups=competitionAccessGroups((await db.query(`SELECT ${competitionColumns} FROM competitions ORDER BY id`)).rows);
    const result=new Set(ids.map(Number));
    for(const group of groups)if(group.competition_ids.some(id=>result.has(id)))for(const id of group.competition_ids)result.add(id);
    return [...result].sort((a,b)=>a-b);
}
module.exports={competitionAccessGroups,expandCompetitionAccess,competitionColumns};
