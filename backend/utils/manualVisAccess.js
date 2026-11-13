const isStatisticsUser = user => ['admin', 'statistician'].includes(user?.role);
const isShared = match => Boolean(match?.manual_owner_id && Number(match.manual_vis_shared) === 1
    && match.manual_lifecycle !== 'draft' && !['cancelled', 'canceled'].includes(match.status));
const canReadStatistics = (user, match) => isStatisticsUser(user) && isShared(match);
function assertStatisticsWriter(user, match) {
    if (user?.role !== 'statistician' || !canReadStatistics(user, match)) throw Object.assign(new Error('แมตช์นี้ยังไม่เปิดให้บันทึกสถิติ'), { status: 403 });
    if (String(match.manual_vis_assignee_id) !== String(user.id)) {
        throw Object.assign(new Error('กรุณารับงานสถิติก่อน หรือรอผู้รับผิดชอบเดิมคืนงาน'), { status: 409 });
    }
}
module.exports = { isStatisticsUser, isShared, canReadStatistics, assertStatisticsWriter };
