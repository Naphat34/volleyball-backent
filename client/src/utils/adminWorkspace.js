export const adminWorkspaces = {
    organizer: { label: 'Organizer', title: 'ภาพรวมการแข่งขันของคุณ', home: '/access-center', accent: 'system', description: 'จัดการและติดตามการแข่งขันเฉพาะรายการที่ได้รับสิทธิ์' },
    super_admin: { label: 'Super Admin', title: 'ดูแลภาพรวมทั้งระบบ', home: '/admin', accent: 'system', description: 'จัดการรายการแข่งขัน ข้อมูลกลาง และสิทธิ์ของผู้ใช้งาน' },
    super_admin_scorer: { label: 'Scorer Admin', title: 'ศูนย์ดูแลคะแนนการแข่งขัน', home: '/scorer-admin', accent: 'score', description: 'ติดตามแมตช์ ตรวจรับคะแนน และดูแลผู้บันทึกในรายการที่ได้รับสิทธิ์' },
    super_admin_vims: { label: 'VIMS Admin', title: 'ศูนย์ดูแลสถิติการแข่งขัน', home: '/vims-admin', accent: 'vims', description: 'ติดตามสถิติ ตรวจรับข้อมูล และดูแลผู้บันทึก VIMS ในรายการที่ได้รับสิทธิ์' },
};
export const accessViews = ['overview', 'matches', 'reviews', 'users'];
export function competitionInScope(scope,id){const ids=Array.isArray(scope)?scope:scope?[scope]:[];return !ids.length||ids.some(value=>String(value)===String(id));}
export function workspaceFor(role) { return Object.hasOwn(adminWorkspaces, role) ? adminWorkspaces[role] : null; }
export function latestReviews(rows) {
    const latest = new Map();
    for (const row of rows) {
        const key = `${row.custom_match_id ? 'custom' : 'match'}:${row.custom_match_id || row.match_id}:${row.domain}`;
        if (!latest.has(key) || Number(row.revision) > Number(latest.get(key).revision)) latest.set(key, row);
    }
    return [...latest.values()];
}
export function workspaceSummary(reviews, matches, users, competitionId = '') {
    const inScope = row => competitionInScope(competitionId,row.competition_id);
    const latest = latestReviews(reviews.filter(inScope));
    return { matches: matches.filter(inScope).length, submitted: latest.filter(r => r.status === 'submitted').length,
        confirmed: latest.filter(r => r.status === 'confirmed').length,
        returned: latest.filter(r => ['returned','reopened'].includes(r.status)).length,
        users: users.filter(u => (Array.isArray(competitionId)?!competitionId.length:!competitionId) || u.competition_ids?.some(id => competitionInScope(competitionId,id))).length };
}
