export const visFlag = value => value === true || value === 1 || value === '1' || value === 'true';
export function fullNamePatch(language, value) {
    const name = value.trim();
    const boundary = name.search(/\s/);
    return {
        ['full_name_' + language]: value,
        ['first_name_' + language]: boundary < 0 ? name : name.slice(0, boundary),
        ['last_name_' + language]: boundary < 0 ? '' : name.slice(boundary).trim(),
    };
}
export function settingsPlayer(player) {
    const role = String(player.role || '').toUpperCase();
    const l2 = visFlag(player.is_libero2) || role.startsWith('L2');
    const l1 = !l2 && (visFlag(player.is_libero1) || role.startsWith('L1') || visFlag(player.is_libero) || player.position === 'L');
    const localized={};
    for(const base of ['first_name','last_name']) {localized[base+'_th']=player[base+'_th'] ?? (/[\u0e00-\u0e7f]/.test(player[base]||'')?player[base]:'');localized[base+'_en']=player[base+'_en'] ?? (!/[\u0e00-\u0e7f]/.test(player[base]||'')?player[base]||'':'');}
    return {...player,...localized,first_name:player.first_name || player.name || '',last_name:player.last_name || '',
        position:l1||l2?'L':player.playing_position || (['S','OH','MB','OPP','OP'].includes(player.position)?player.position:''),
        is_captain:visFlag(player.is_captain)||role.includes('C'),is_libero1:l1,is_libero2:l2};
}
export function settingsPlayerDraft(player) {
    const l2=visFlag(player.is_libero2), l1=visFlag(player.is_libero1) || (!l2&&player.position==='L');
    const captain=visFlag(player.is_captain);
    return {...player,number:Number(player.number),first_name:player.first_name.trim(),last_name:player.last_name.trim(),
        role:(l2?'L2':l1?'L1':'')+(captain?(l1||l2?'+C':'C'):'')};
}
export function coachingStaff(staff = [], legacy = '') {
    const name = person => [person.first_name,person.last_name].filter(Boolean).join(' ').trim() || person.name || '';
    const role = person => String(person.role || '').toLowerCase().replace(/[\s._-]/g,'');
    const assistants = staff.filter(person=>/assistantcoach|asstcoach|^ac[12]?$|ผู้ช่วยผู้ฝึกสอน|ผู้ช่วยโค้ช/.test(role(person)));
    const head = staff.find(person=>!assistants.includes(person)&&/headcoach|^coach$|^hc$|หัวหน้าผู้ฝึกสอน|^ผู้ฝึกสอน$|^โค้ช$/.test(role(person)));
    return {head:name(head || {}) || (staff.length === 0 ? legacy : '') || '',assistants:assistants.map(name).filter(Boolean)};
}
