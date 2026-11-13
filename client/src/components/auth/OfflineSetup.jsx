import { GuardedForm, GuardedButton } from '../ui/GuardedAction';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useRef, useState } from 'react';
import { getAccessSession, getStoredUser } from '../../auth/authStorage';
import { offlineProfile, prepareOffline } from '../../offline/offlineAuth';

export default function OfflineSetup({ getPermit, onPrepared, disabled = false, beginAttempt, endAttempt }) {
    const ui = useUiTranslation();
    const [pin, setPin] = useState(''), [confirm, setConfirm] = useState(''), [replace, setReplace] = useState(false);
    const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const lock = useRef(false), profile = offlineProfile(), user = getStoredUser();
    const different = profile && (profile.userId ? String(profile.userId) !== String(user?.id) : profile.user !== user?.username);
    return <GuardedForm className="my-3 space-y-3 rounded-lg border border-slate-400 p-3" aria-busy={busy} onSubmit={async event => {
        event.preventDefault(); if (lock.current || disabled) return;
        if (pin !== confirm) { setMessage('PIN ทั้งสองช่องไม่ตรงกัน'); return; }
        if (beginAttempt && !beginAttempt()) return;
        lock.current = true; setBusy(true); setMessage('');
        try {
            const before = getAccessSession({ onlineOnly: true });
            if (before.kind !== 'online' || String(before.user.id) !== String(user?.id)) throw Error('กรุณาเข้าสู่ระบบออนไลน์ด้วยบัญชีปัจจุบันก่อนเตรียมสิทธิ์');
            const response = await getPermit();
            const current = getAccessSession({ onlineOnly: true });
            if (current.kind !== 'online' || String(current.user.id) !== String(user.id) || String(response.data.user?.id) !== String(user.id)) throw Error('บัญชีเปลี่ยนระหว่างเตรียมสิทธิ์ กรุณาตรวจสอบและลองใหม่');
            await prepareOffline(response.data, pin, { replaceAccount: replace });
            setPin(''); setConfirm(''); setReplace(false);
            setMessage('เตรียมสิทธิ์และ PIN ร่วมสำหรับ VIMS / ScorerControl แล้ว โดยไม่ลบแมตช์ในเครื่อง');
            onPrepared?.();
        } catch (error) { setMessage(error.response?.data?.error || error.message); }
        finally { lock.current = false; setBusy(false); endAttempt?.(); }
    }}>
        <p>{ui("บัญชี Offline ปัจจุบัน:")}{' '}{(profile?.user) || (ui('ยังไม่เตรียม'))}{' '}{ui("· เตรียมสำหรับ:")}{' '}{(user?.username) || (ui('กรุณาเข้าสู่ระบบออนไลน์'))}</p>
        <label className="block">{ui("ตั้ง PIN ตัวเลข 6–12 หลัก")}<input className="ml-2 rounded border bg-white p-2 text-slate-950" type="password" inputMode="numeric" pattern="[0-9]{6,12}" required autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value)} disabled={busy || disabled} /></label>
        <label className="block">{ui("ยืนยัน PIN")}<input className="ml-2 rounded border bg-white p-2 text-slate-950" type="password" inputMode="numeric" pattern="[0-9]{6,12}" required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy || disabled} /></label>
        {different && <label className="block"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} disabled={busy || disabled} required />{' '}{ui("ยืนยันเปลี่ยนบัญชี Offline ของเบราว์เซอร์นี้ หลังสำรองข้อมูลแล้ว (ระบบจะตรวจและปฏิเสธหากมีงานรอซิงค์)")}</label>}
        <p>{ui("หนึ่งบัญชี Offline ต่อโปรไฟล์เบราว์เซอร์ · เปลี่ยน PIN บัญชีเดิมไม่ลบข้อมูล · การเตรียมครั้งนี้ยังไม่เปลี่ยนไปทำงาน Offline")}</p>
        <GuardedButton className="rounded bg-sky-800 px-3 py-2 text-white" disabled={busy || disabled}>{busy ? ui('กำลังตรวจสิทธิ์และข้อมูลในเครื่อง…') : ui('เตรียม / ต่ออายุสิทธิ์ Offline')}</GuardedButton>
        {message && <p role="status">{ui(message)}</p>}
    </GuardedForm>;
}
