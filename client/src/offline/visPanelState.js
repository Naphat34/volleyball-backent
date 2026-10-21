export function visPanelState({ profile, profileMismatch = false, userId, grant, offline, readOnly, online, onlineUserId, pwaReady, shellRequired, now = Date.now() }) {
    const expired = Boolean(profile && profile.expiresAt <= now);
    const unlocked = Boolean(profile && !profileMismatch && !expired && !readOnly && grant && String(grant.id) === String(userId) && ['admin', 'statistician'].includes(grant.role));
    const serverAccount = Boolean(userId && onlineUserId && String(onlineUserId) === String(userId));
    const serverReady = online && serverAccount;
    const shellReady = !shellRequired || pwaReady;
    let action, label, hint;
    if (!profile || profileMismatch) {
        action = serverReady ? 'setup' : 'signin'; label = 'เตรียมสิทธิ์ออฟไลน์';
        hint = 'เตรียม PIN ของบัญชีนี้ ก่อนดาวน์โหลดแมตช์ลงอุปกรณ์';
    } else if (!unlocked && readOnly) {
        action = serverReady ? 'setup' : 'signin'; label = 'ต่ออายุสิทธิ์';
        hint = 'เปิดรายการและสำรองข้อมูลได้ ต่ออายุสิทธิ์ก่อนบันทึกหรือซิงค์';
    } else if (!unlocked) {
        action = 'unlock'; label = expired ? 'ปลดล็อกเพื่อสำรองข้อมูล' : 'ปลดล็อกด้วย PIN';
        hint = expired ? 'สิทธิ์หมดอายุ ใช้ PIN เดิมเพื่อเข้าถึงข้อมูลสำรอง' : 'ปลดล็อก PIN เพื่อเข้าถึงแมตช์บนอุปกรณ์นี้';
    } else if (offline) {
        action = serverAccount ? 'mode' : 'signin'; label = serverAccount ? 'กลับโหมดออนไลน์' : 'เข้าสู่ระบบเพื่อกลับออนไลน์';
        hint = 'บันทึกข้อมูลบนอุปกรณ์นี้ ซิงค์เมื่อพร้อมเชื่อมต่อเซิร์ฟเวอร์';
    } else {
        action = 'mode'; label = 'เริ่มทำงานในเครื่อง';
        hint = !shellReady ? 'กำลังเตรียมแอปสำหรับทำงานออฟไลน์ กรุณารอขณะออนไลน์' : serverReady ? 'พร้อมดาวน์โหลดแมตช์หรือเริ่มบันทึกในเครื่อง' : 'พร้อมบันทึกในเครื่อง เข้าสู่ระบบออนไลน์เพื่อดาวน์โหลดแมตช์เพิ่มเติม';
    }
    return {
        action, label, hint, unlocked, serverReady,
        disabled: (action === 'signin' && !online) || (action === 'mode' && (offline ? !serverReady : !shellReady)),
        permit: !profile ? 'ยังไม่เตรียมสิทธิ์' : profileMismatch ? 'บัญชี Offline ไม่ตรงกัน' : expired ? 'สิทธิ์หมดอายุ' : unlocked ? 'พร้อมใช้งาน' : 'ยังไม่ปลดล็อก',
        canDownload: unlocked && serverReady && !offline && shellReady,
        canSync: unlocked && serverReady,
    };
}
