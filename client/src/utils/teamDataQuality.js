const clean=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const roles=['Team Manager','Head Coach','Assistant Coach','Assistant Coach 2','Doctor','Therapist/Trainer'];
export {roles as teamStaffRoles};
export function teamPersonIssues(person,people,kind='players'){
    const issues=[];
    const first=person.first_name||person.first_name_th||person.first_name_en,last=person.last_name||person.last_name_th||person.last_name_en;
    if(!clean(first)||!clean(last)||clean(last)==='-')issues.push('name');
    const same=people.filter(other=>other.id!==person.id&&clean(other.first_name)===clean(first)&&clean(other.last_name)===clean(last));
    if(same.some(other=>kind==='staff'||!other.birth_date||!person.birth_date||String(other.birth_date).slice(0,10)===String(person.birth_date).slice(0,10)))issues.push('duplicate');
    if(kind==='staff'){if(!roles.includes(person.role))issues.push('role');return issues;}
    if(!person.birth_date)issues.push('birth_missing');
    else if(!Number.isFinite(Date.parse(person.birth_date))||String(person.birth_date).slice(0,10)>new Date().toISOString().slice(0,10))issues.push('birth_invalid');
    if(!['Male','Female'].includes(person.gender))issues.push('gender');
    if(!Number.isInteger(Number(person.number))||Number(person.number)<1||Number(person.number)>999)issues.push('number');
    if(Number(person.is_active)!==0&&people.some(other=>other.id!==person.id&&Number(other.is_active)!==0&&Number(other.number)===Number(person.number)))issues.push('number_duplicate');
    return issues;
}
