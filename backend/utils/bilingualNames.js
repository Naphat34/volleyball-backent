const playerNameFields = ['first_name_th', 'last_name_th', 'first_name_en', 'last_name_en'];
const teamNameFields = ['name_th', 'name_en'];
function cleanName(value, max) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.trim().length > max) throw Object.assign(new Error(`ชื่อยาวได้สูงสุด ${max} ตัวอักษร`), {status:400});
    return value.trim() || null;
}
function normalizeNames(patch, current = {}, team = false) {
    const result = {...patch}, fields = team ? teamNameFields : playerNameFields;
    for (const field of fields) if (patch[field] !== undefined) result[field] = cleanName(patch[field], team ? 100 : 50);
    for (const base of team ? ['name'] : ['first_name', 'last_name']) {
        const th = base + '_th', en = base + '_en';
        if (patch[th] !== undefined || patch[en] !== undefined) {
            const legacy = current[base] || patch[base];
            if (typeof legacy === 'string' && legacy.trim()) {
                const field = /[\u0e00-\u0e7f]/.test(legacy) ? th : en;
                if (result[field] === undefined && !current[field]) result[field] = cleanName(legacy, team ? 100 : 50);
            }
            result[base] = (result[th] !== undefined ? result[th] : current[th])
                || (result[en] !== undefined ? result[en] : current[en]) || null;
        } else if (patch[base] !== undefined && patch[base] !== null && String(patch[base]).trim()) {
            // Keep existing clients working, without inventing a translation.
            const value = cleanName(patch[base], team ? 100 : 50);
            result[/[\u0e00-\u0e7f]/.test(value) ? th : en] = value;
        }
    }
    return result;
}
module.exports = { normalizeNames, playerNameFields, teamNameFields };
