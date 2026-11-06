export const visStatuses = {
    idle: ['ยังไม่บันทึก', 'Not recorded'], ready: ['จัดไลน์อัปแล้ว', 'Lineup ready'],
    recording: ['กำลังบันทึก', 'Recording'], review: ['รอตรวจสอบสถิติ', 'Review statistics'],
    confirmed: ['ยืนยันสถิติแล้ว', 'Confirmed'], cancelled: ['ยกเลิก', 'Cancelled'],
};
export const visStatusLabel = (match, th = true) => visStatuses[match.vis_summary?.status]?.[th ? 0 : 1] || (th ? 'ยังไม่มีข้อมูล' : 'No data');

// Resolve one display status so independent VIS and official states cannot contradict each other.
export function dashboardMatchStatus(match) {
    const vis = match.vis_summary;
    if (match.status === 'cancelled' || vis?.status === 'cancelled') return 'cancelled';
    const setsToWin = Math.floor((Number(match.max_sets) || 5) / 2) + 1;
    const hasWinner = sets => Math.max(Number(sets?.home) || 0, Number(sets?.away) || 0) >= setsToWin;
    const officialSets = match.official_summary?.setsWon || { home: match.home_set_score, away: match.away_set_score };
    if (['completed', 'finished', 'match_finished'].includes(match.status)
        || ['review', 'confirmed'].includes(vis?.status)
        || hasWinner(vis?.setsWon) || (!match.is_custom_vis && hasWinner(officialSets))) return 'completed';
    if (match.status === 'live' || vis?.status === 'recording'
        || Number(vis?.score?.home) > 0 || Number(vis?.score?.away) > 0
        || Number(vis?.setsWon?.home) > 0 || Number(vis?.setsWon?.away) > 0
        || (!match.is_custom_vis && (Number(officialSets.home) > 0 || Number(officialSets.away) > 0))) return 'live';
    return 'scheduled';
}

export function dashboardMatchStatusLabel(match, th = true) {
    const status = dashboardMatchStatus(match);
    if (status === 'completed') return th ? 'จบแล้ว' : 'Finished';
    if (status === 'cancelled') return th ? 'ยกเลิก' : 'Cancelled';
    if (status === 'live') return match.vis_summary?.status === 'recording'
        ? (th ? 'กำลังบันทึก' : 'Recording') : (th ? 'กำลังแข่งขัน' : 'Live');
    return th ? 'ยังไม่เริ่ม' : 'Not started';
}
