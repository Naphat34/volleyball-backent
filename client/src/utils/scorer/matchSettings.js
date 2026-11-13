export function matchCategoryLabel(draft, ageGroups = [], fallback = '') {
    const categoryId = draft.age_group_id ?? draft.category;
    if (categoryId === '' || categoryId == null) return fallback;
    return ageGroups.find(group => String(group.id) === String(categoryId))?.name || fallback;
}

export function validateMatchSettings(draft, th = true) {
    const errors = [];
    const add = (tab, thai, english) => errors.push({ tab, message: th ? thai : english });
    if (!draft.title.trim()) add('overview', 'กรุณาระบุชื่อรายการแข่งขัน', 'Enter a competition name.');
    if (draft.home.name.trim() === draft.away.name.trim()) add('roster', 'ชื่อทีมทั้งสองต้องต่างกัน', 'Team names must be distinct.');
    for (const side of ['home', 'away']) {
        const team = draft[side];
        if (!team.name.trim()) add('roster', 'กรุณาระบุชื่อทีม', 'Enter a team name.');
        const numbers = team.players.map(p => Number(p.number));
        if (new Set(numbers).size !== numbers.length) add('roster', `${team.name}: หมายเลขเสื้อซ้ำ`, `${team.name}: duplicate shirt numbers.`);
        if (team.players.some(p => !p.first_name.trim() || !Number.isInteger(Number(p.number)) || Number(p.number) < 1 || Number(p.number) > 999)) add('roster', `${team.name}: ตรวจชื่อและหมายเลขเสื้อ (1–999)`, `${team.name}: check player names and shirt numbers (1–999).`);
        if (team.players.filter(p => p.role.includes('C')).length > 1 || ['L1','L2'].some(role => team.players.filter(p => p.role.startsWith(role)).length > 1)) add('roster', `${team.name}: กัปตันหรือ Libero ซ้ำ`, `${team.name}: duplicate captain or libero role.`);
        if (team.staff.some(p => !p.first_name.trim() || !p.role.trim())) add('staff', `${team.name}: ระบุชื่อและตำแหน่งเจ้าหน้าที่ให้ครบ`, `${team.name}: enter staff names and positions.`);
    }
    for (const fields of [['referee_1_id','referee_2_id'], [1,2,3,4].map(n => `line_judge_${n}_id`)]) {
        const ids = fields.map(key => String(draft[key])).filter(Boolean);
        if (new Set(ids).size !== ids.length) add('officials', 'เลือกผู้ตัดสินซ้ำตำแหน่ง', 'The same official is assigned more than once.');
    }
    return errors;
}
