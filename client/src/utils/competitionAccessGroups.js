import { competitionName } from './i18n/competitionNames.js';
export function competitionGroupOptions(rows, language){
    const groups=new Map();
    for(const row of rows){
        const key=row.access_group_key||`competition-${row.id}`;
        if(!groups.has(key))groups.set(key,{key,title:language ? competitionName(row,language).replace(/\s*\((Male|Female|Mixed|Mix|Men|Women|ชาย|หญิง)\)\s*$/i,'').trim() || row.access_group_title : row.access_group_title||row.title_th||row.title,competition_ids:[]});
        groups.get(key).competition_ids.push(Number(row.id));
    }
    return [...groups.values()].map(group=>({...group,competition_ids:[...new Set(group.competition_ids)].sort((a,b)=>a-b)}));
}
export const selectedCompetitionGroups=(groups,ids)=>{
    const selected=(Array.isArray(ids)?ids:ids?[ids]:[]).map(Number);
    return groups.filter(group=>group.competition_ids.some(id=>selected.includes(id))).map(group=>group.key);
};
export const expandSelectedGroups=(groups,keys)=>[...new Set(groups.filter(group=>keys.includes(group.key)).flatMap(group=>group.competition_ids))];
