import { useRef, useState } from 'react';
import { offlineMode, offlineProfile, offlineProfileMatchesUser, unlockOffline } from '../../offline/offlineAuth';
import { getAccessSession, getStoredUser, switchAccessMode } from '../../auth/authStorage';

export default function OfflineUnlock({ onUnlocked, onPrepare, section = null, disabled = false, beginAttempt, endAttempt, compact = false, inline = false, preserveMode = false }) {
    const [pin, setPin] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const profile = offlineProfile(), expired = profile?.expiresAt <= Date.now();
    const currentUser = getStoredUser();
    if (!profile) return <p className="my-4 text-sm">เข้าสู่ระบบออนไลน์แล้วเตรียม PIN และดาวน์โหลดแมตช์ก่อนใช้งานออฟไลน์</p>;
    if (preserveMode && !currentUser) return <p role="status">กรุณาเข้าสู่ระบบด้วยบัญชีปัจจุบันก่อนปลดล็อก Offline จากหน้านี้</p>;
    if (preserveMode && currentUser && !offlineProfileMatchesUser(profile, currentUser)) return <div role="status" className="my-3 space-y-3">
        <p>บัญชีปัจจุบัน: <strong>{currentUser.username || currentUser.id}</strong></p>
        <p>เจ้าของ PIN Offline ที่เก็บไว้: <strong>{profile.user || 'บัญชีเดิม'}</strong></p>
        <p>โปรไฟล์ Offline ยังไม่ได้เตรียมสำหรับบัญชีปัจจุบัน จึงไม่เปิดให้กรอก PIN ของบัญชีเดิมจากหน้านี้</p>
        {onPrepare && <button type="button" disabled={disabled || busy} onClick={onPrepare} className="rounded bg-sky-800 px-3 py-2 text-white">เตรียมสิทธิ์สำหรับบัญชีปัจจุบัน</button>}
        <p>หากต้องการใช้งานบัญชีเดิม ให้เข้าสู่ระบบบัญชีนั้นก่อนเพื่อซิงค์หรือสำรองงาน ก่อนเปลี่ยนโปรไฟล์ Offline</p>
    </div>;
    const content = <>
        <p className="my-2">บัญชี {profile.user} · สิทธิ์ถึง {new Date(profile.expiresAt).toLocaleString('th-TH')}</p>
        {expired && <p role="alert" className="my-2 text-amber-600">สิทธิ์หมดอายุ ปลดล็อกเพื่อสำรองข้อมูลได้ และต้องต่ออายุออนไลน์ก่อนบันทึกหรือซิงค์</p>}
        <form className="offline-unlock-form" onSubmit={async event => {
            event.preventDefault();
            if (inFlight.current || disabled || (beginAttempt && !beginAttempt())) return;
            inFlight.current = true; setBusy(true); setError('');
            try {
                const wasOffline = offlineMode();
                const user = await unlockOffline(pin, { section, readOnly: expired, expectedUserId: preserveMode ? currentUser.id : null });
                if (preserveMode && !expired && !wasOffline && getAccessSession({ onlineOnly: true }).kind === 'online') switchAccessMode(false);
                setPin(''); await onUnlocked(user);
            }
            catch (error) { setError(error.message); }
            finally { inFlight.current = false; setBusy(false); endAttempt?.(); }
        }}>
            <label>PIN ของบัญชีนี้<input autoFocus={inline} type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6,12}" minLength={6} maxLength={12} disabled={busy || disabled} value={pin} onChange={event => setPin(event.target.value)} className="my-2 block w-full rounded border bg-slate-100 p-2 text-slate-900" /></label>
            <button disabled={busy || disabled} className="rounded bg-sky-800 px-3 py-2 text-white">{busy ? 'กำลังตรวจสอบ PIN…' : expired ? 'ปลดล็อกเพื่อสำรองข้อมูล' : 'ปลดล็อกด้วย PIN'}</button>
            {error && <p role="alert" className="mt-2 text-red-500">{error}</p>}
        </form>
    </>;
    if (inline) return content;
    return <details className="mt-5 rounded-lg border border-slate-300 p-3 text-sm"><summary className="cursor-pointer font-semibold">{compact ? 'ปลดล็อกด้วย PIN Offline' : 'Offline PIN · VIS / ScorerControl'}</summary>{content}</details>;
}
