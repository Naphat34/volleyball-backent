function scorerCheckoutStatus(match, lease, userId, deviceId, now = Date.now()) {
    if (!match) return { canCheckout: false, state: 'missing', reason: 'ไม่พบแมตช์' };
    if (['completed', 'finished', 'match_finished', 'cancelled', 'canceled'].includes(String(match.status).toLowerCase())) return { canCheckout: false, state: 'closed', reason: 'แมตช์จบหรือยกเลิกแล้ว' };
    if (!match.home_team_id || !match.away_team_id) return { canCheckout: false, state: 'teams', reason: 'ต้องกำหนดทีมทั้งสองทีมก่อนดาวน์โหลด' };
    let setup;
    try { setup = typeof match.vis_state === 'string' ? JSON.parse(match.vis_state) : match.vis_state; } catch { setup = {}; }
    const vis = setup?.offlineVis?.payload?.offlineLease;
    if (vis?.expiresAt > now) return { canCheckout: false, state: 'vis', expiresAt: vis.expiresAt, reason: 'แมตช์ถูกจองสำหรับ VIS Offline กรุณาซิงค์และคืนสิทธิ์ก่อน' };
    const active = lease && !lease.released && Number(lease.expires_at) > now;
    if (active && (String(lease.owner_id) !== String(userId) || lease.device_id !== deviceId)) return { canCheckout: false, state: 'scorer', expiresAt: Number(lease.expires_at), reason: 'แมตช์ถูกจองสำหรับ Scorer Offline ด้วยบัญชีหรืออุปกรณ์อื่น กรุณาซิงค์และคืนสิทธิ์จากเครื่องเดิมก่อน' };
    return { canCheckout: true, state: active ? 'own' : 'available', reason: active ? 'จองด้วยบัญชีและอุปกรณ์นี้แล้ว สามารถดาวน์โหลดซ้ำเพื่อกู้ข้อมูลได้' : 'พร้อมดาวน์โหลดและจองสิทธิ์' };
}
module.exports = { scorerCheckoutStatus };
