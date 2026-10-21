import { getAccessSession } from '../auth/authStorage.js';
import { canEnterSection, loginIntent, sectionHome, roleHome } from './entryRouting.js';
import { listLocal } from './offlineStore.js';
import { scorerRecords } from './scorerOffline.js';
import { deviceId } from './offlineAuth.js';
import { scorerStorageSnapshot } from './scorerCache.js';

export function accessDecision(session, { section = null, search = '' } = {}) {
    if (session.kind === 'locked') return { kind: 'locked', message: session.reason };
    const intent = loginIntent(search);
    const selected = section || intent.section;
    const offline = session.kind === 'offline', user = session.user;
    if (selected && !canEnterSection(user, selected, offline)) return { kind: 'denied', message: `บัญชี ${user.username || ''} ไม่มีสิทธิ์เข้า ${selected === 'vis' ? 'VIS' : 'ScorerControl'} กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์` };
    if (selected) return { kind: 'ready', path: sectionHome(selected, offline), section: selected, matchPath: intent.section === selected ? intent.destination : null, offline };
    return { kind: 'ready', path: roleHome(user, offline), offline };
}

export async function resolveAccess(options = {}, session = getAccessSession(), load = key => key === 'vis' ? listLocal() : scorerRecords()) {
    const decision = accessDecision(session, options);
    if (decision.kind !== 'ready' || !decision.matchPath) return decision;
    // Referees can read the dashboard, but never enter a scoring console.
    if (session.user.role === 'referee') return { ...decision, notice: 'บัญชีผู้ตัดสินเปิดดูรายการได้ แต่ไม่มีสิทธิ์บันทึกคะแนน' };
    if (session.readOnly) return { ...decision, notice: session.reason || 'เปิดได้เฉพาะรายการและสำรองข้อมูล กรุณาต่ออายุสิทธิ์ก่อนบันทึก' };
    if (!decision.offline) return { ...decision, path: decision.matchPath };
    try {
        const records = await load(decision.section);
        const id = decision.matchPath.split('/').pop();
        const record = records.find(row => String(row.id) === id);
        if (!record) return { ...decision, notice: `ไม่พบแมตช์ ${id} ในเครื่องนี้ กรุณาเลือกแมตช์อื่นหรือดาวน์โหลดขณะออนไลน์` };
        if (record.recoveryReadOnly) return { ...decision, notice: 'ไฟล์สำรองจากเครื่องอื่นเก็บไว้อ่านและสำรองเท่านั้น กรุณาซิงค์จากเครื่องหลักเดิม' };
        if (record.preparingUntil > Date.now()) return { ...decision, notice: 'แมตช์กำลังดาวน์โหลด กรุณารอแล้วเปิดอีกครั้ง' };
        if (record.released) return { ...decision, notice: `แมตช์ ${id} คืนสิทธิ์แล้ว กรุณาเลือกแมตช์อื่น หรือเปิดดูและสำรองจากรายการในเครื่อง` };
        if (record.deviceId && record.deviceId !== deviceId()) return { ...decision, notice: `แมตช์ ${id} เป็นข้อมูลของเครื่องอื่น กรุณาสำรองและตรวจสอบสิทธิ์เครื่องหลักก่อนบันทึก` };
        if (decision.section === 'scorer') {
            for (const [key, value] of Object.entries(scorerStorageSnapshot(record))) {
                if (key.startsWith(`match_${record.id}_`)) localStorage.setItem(key, value);
            }
            localStorage.setItem(`scorer_offline_active_${record.id}`, '1');
        }
        return { ...decision, path: decision.matchPath };
    } catch (error) {
        return { ...decision, notice: `อ่านข้อมูลแมตช์ในเครื่องไม่สำเร็จ: ${error.message} กรุณาลองใหม่ ข้อมูลยังไม่ได้ถูกลบ` };
    }
}

export function navigateAccess(navigate, result) {
    if (result.kind !== 'ready') throw Error(result.message || 'กรุณาเข้าสู่ระบบ');
    navigate(result.path, { replace: true, state: { accessNotice: result.notice || '' } });
}
