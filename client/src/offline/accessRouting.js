import { getAccessSession } from '../authStorage.js';
import { canEnterWorkspace, workspaceIntent, loginSearch, workspaceHome, workspacesFor } from './workspaceRouting.js';
import { listLocal } from './offlineStore.js';
import { scorerRecords } from './scorerOffline.js';
import { deviceId } from './offlineAuth.js';

export function accessDecision(session, { workspace = null, search = '' } = {}) {
    if (session.kind === 'locked') return { kind: 'locked', message: session.reason };
    const intent = workspaceIntent(loginSearch(search, workspace));
    const selected = workspace || intent.workspace;
    const offline = session.kind === 'offline', user = session.user;
    if (selected && !canEnterWorkspace(user, selected, offline)) return { kind: 'denied', message: `บัญชี ${user.username || ''} ไม่มีสิทธิ์เข้า ${selected === 'vis' ? 'VIS' : 'ScorerControl'} กรุณาเลือกพื้นที่ทำงานที่มีสิทธิ์หรือใช้บัญชีอื่น` };
    const choices = workspacesFor(user);
    const target = selected || (choices.length === 1 ? choices[0] : null);
    if (target) return { kind: 'ready', path: workspaceHome(target, offline), workspace: target, matchPath: intent.destination, offline };
    if (choices.length) return { kind: 'ready', path: '/workspaces', offline };
    return { kind: 'ready', path: user.role === 'admin' ? '/admin' : user.role === 'referee' ? '/adminscorer' : user.team_id ? '/team-dashboard' : '/create-team', offline };
}

export async function resolveAccess(options = {}, session = getAccessSession(), load = key => key === 'vis' ? listLocal() : scorerRecords()) {
    const decision = accessDecision(session, options);
    if (decision.kind !== 'ready' || !decision.matchPath) return decision;
    // Referees can read the dashboard, but never enter a scoring console.
    if (session.user.role === 'referee') return { ...decision, notice: 'บัญชีผู้ตัดสินเปิดดูรายการได้ แต่ไม่มีสิทธิ์บันทึกคะแนน' };
    if (!decision.offline) return { ...decision, path: decision.matchPath };
    try {
        const records = await load(decision.workspace);
        const id = decision.matchPath.split('/').pop();
        const record = records.find(row => String(row.id) === id);
        if (!record) return { ...decision, notice: `ไม่พบแมตช์ ${id} ในเครื่องนี้ กรุณาเลือกแมตช์อื่นหรือดาวน์โหลดขณะออนไลน์` };
        if (record.released) return { ...decision, notice: `แมตช์ ${id} คืนสิทธิ์แล้ว กรุณาเลือกแมตช์อื่น หรือเปิดดูและสำรองจากรายการในเครื่อง` };
        if (record.deviceId && record.deviceId !== deviceId()) return { ...decision, notice: `แมตช์ ${id} เป็นข้อมูลของเครื่องอื่น กรุณาสำรองและตรวจสอบสิทธิ์เครื่องหลักก่อนบันทึก` };
        if (decision.workspace === 'scorer') {
            for (const [key, value] of Object.entries(record.localStorage || {})) {
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
