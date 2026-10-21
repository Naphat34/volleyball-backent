export const visSkillNames = { S: 'เสิร์ฟ', R: 'รับเสิร์ฟ', A: 'ตบ', B: 'บล็อก', D: 'ขุดบอล', E: 'เซต' };

export function describeVisGrade(skill, grade) {
    const perfect = { S: 'เสิร์ฟเอซ', A: 'ตบได้แต้ม', B: 'บล็อกได้แต้ม', R: 'รับเสิร์ฟสมบูรณ์', D: 'ขุดบอลสมบูรณ์', E: 'เซตสมบูรณ์' };
    const labels = { '+': 'ผลบวก / เล่นต่อได้ดี', '!': 'เล่นต่อได้', '-': 'ผลลบ / เล่นต่อยาก', '=': 'ผิดพลาด / เสียแรลลี', '/': 'ตบติดบล็อก' };
    const winsPoint = grade === '#' && ['S', 'A', 'B'].includes(skill);
    return {
        label: grade === '#' ? perfect[skill] || 'สมบูรณ์' : labels[grade] || grade,
        impact: ['=', '/'].includes(grade) ? 'สถิติผิดพลาด · ไม่เปลี่ยนคะแนนทางการ' : winsPoint ? 'สถิติได้แต้ม · ไม่เปลี่ยนคะแนนทางการ' : 'สถิติเล่นต่อ · ไม่เปลี่ยนคะแนนทางการ',
        scoring: ['=', '/'].includes(grade) || winsPoint,
    };
}

export function eventDetails(event) {
    if (!event?.details) return {};
    if (typeof event.details !== 'string') return event.details;
    try { return JSON.parse(event.details); } catch { return {}; }
}

export function getVisEventCode(event, players = []) {
    const details = eventDetails(event);
    if (details.event_code) return details.event_code;
    if (event?.event_code) return event.event_code;
    const number = details.jersey_number ?? players.find(player => Number(player.id) === Number(event?.player_id))?.number;
    const parsed = number == null || String(number).trim() === '' ? NaN : Number(number);
    return visSkillNames[event?.skill] && ['#', '+', '!', '-', '='].includes(event?.grade) && Number.isSafeInteger(parsed) && parsed >= 0
        ? `${event.skill}${parsed}${event.grade}` : null;
}

export function describeVisEvent(event, players = []) {
    if (!event) return 'เตรียมเซตถัดไป';
    if (event.skill === 'OP') return 'คู่แข่งเสีย · ได้แต้ม';
    if (event.skill === 'T') return 'ทีมผิดพลาด · เสียแต้ม';
    const details = eventDetails(event);
    const player = players.find(item => Number(item.id) === Number(event.player_id));
    const actor = event.player_id ? `#${details.jersey_number ?? player?.number ?? '?'}` : '';
    if (visSkillNames[event.skill]) return `${visSkillNames[event.skill]}${event.grade ? ` (${event.grade})` : ''}${actor ? ` · ${actor}` : ''}`;
    const labels = { LINEUP_CONFIRM: 'ยืนยันไลน์อัป', MATCH_START: 'เริ่มแมตช์', SET_START: 'เริ่มเซต', TIMEOUT: 'ขอเวลานอก', SUBSTITUTION: 'เปลี่ยนตัว', SUB: 'เปลี่ยนตัว', LIBERO_REPLACEMENT: 'เปลี่ยนลิเบอโร', LIBERO: 'เปลี่ยนลิเบอโร', SANCTION: details.card === 'red' ? 'ใบแดง' : details.card === 'yellow' ? 'ใบเหลือง' : 'ลงโทษ', COIN_TOSS_WINNER: 'ชนะการเสี่ยง', COURT_SIDE_LEFT: 'เลือกฝั่งซ้าย', FIRST_SERVE: 'เสิร์ฟก่อน' };
    return `${labels[event.skill] || event.skill} ${actor}`.trim();
}
