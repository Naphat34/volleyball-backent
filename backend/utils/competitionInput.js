const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (value, max = 255) => {
    if (value == null) return null;
    if (typeof value !== 'string' || value.trim().length > max) fail(`ข้อความยาวได้ไม่เกิน ${max} ตัวอักษร / Maximum ${max} characters`);
    return value.trim() || null;
};
function competitionInput(body, current = {}) {
    const fields = {};
    for (const key of ['title_th', 'title_en', 'short_title_th', 'short_title_en', 'details_th', 'details_en']) {
        fields[key] = body[key] === undefined ? current[key] ?? null : text(body[key], key.startsWith('details') ? 10000 : key.startsWith('short') ? 60 : 255);
    }
    const bilingual = body.title_th !== undefined || body.title_en !== undefined;
    if (bilingual && (!fields.title_th || !fields.title_en)) fail('กรุณากรอกชื่อรายการทั้งภาษาไทยและอังกฤษ / Enter both Thai and English competition names');
    if (!bilingual && body.title !== undefined) fields[/[ก-๙]/.test(body.title) ? 'title_th' : 'title_en'] = text(body.title);
    fields.title = !bilingual && body.title !== undefined ? text(body.title) : fields.title_th || fields.title_en || text(current.title);
    if (!fields.title) fail('กรุณากรอกชื่อรายการแข่งขัน / Enter a competition name');
    const start = body.start_date ?? current.start_date;
    const end = body.end_date ?? current.end_date;
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (bilingual && (!start || !end || !Number.isSafeInteger(Number(body.stadium_id ?? current.stadium_id)) || Number(body.stadium_id ?? current.stadium_id) < 1)) fail('กรุณาระบุวันที่และสนามแข่งขัน / Enter dates and venue');
    if ((start && !validDate(start)) || (end && !validDate(end))) fail('วันที่ไม่ถูกต้อง / Invalid date');
    if (start && end && start > end) fail('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น / End date must not precede start date');
    const raw = body.categories ?? String(body.age_group_ids || body.age_group_id || '').split(',').filter(Boolean).flatMap(age_group_id => String(body.gender || '').split(',').filter(Boolean).map(gender => ({ age_group_id, gender })));
    if (!Array.isArray(raw) || !raw.length || raw.length > 100) fail('กรุณาเลือกประเภทแข่งขัน 1–100 ประเภท / Select 1–100 competition categories');
    const keys = new Set();
    fields.categories = raw.map(row => {
        if (!row || typeof row !== 'object') fail('ประเภทแข่งขันไม่ถูกต้อง / Invalid category');
        const age = Number(row.age_group_id);
        if (!Number.isSafeInteger(age) || age < 1 || !['Male', 'Female', 'Mixed'].includes(row.gender)) fail('รุ่นอายุหรือประเภททีมไม่ถูกต้อง / Invalid age group or gender');
        const key = `${age}:${row.gender}`;
        if (keys.has(key)) fail('ประเภทแข่งขันซ้ำ / Duplicate competition category');
        keys.add(key);
        const max_sets = Number(row.max_sets ?? body.max_sets ?? 3);
        const max_players = Number(row.max_players ?? body.max_players ?? 14);
        if (![3, 5].includes(max_sets) || !Number.isInteger(max_players) || max_players < 6 || max_players > 30) fail('กติกาหรือจำนวนนักกีฬาไม่ถูกต้อง / Invalid rules or roster limit');
        return { age_group_id: age, gender: row.gender, max_sets, max_players };
    });
    return fields;
}
module.exports = { competitionInput };
