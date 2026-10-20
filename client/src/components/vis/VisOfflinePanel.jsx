import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import OfflineSetup from '../OfflineSetup';
import AccessStatus from '../AccessStatus';
import { switchAccessMode } from '../../authStorage';
import { deviceId, offlineProfile, offlineMode, unlockOffline } from '../../offline/offlineAuth';
import { listLocal, localView, getLocal, updateLocal, checkoutLocal, createLocal } from '../../offline/offlineStore';
import { syncLocalMatch } from '../../offline/syncVis';
import { exportVisMatch } from '../../utils/visMatchFiles';

export function OfflineUnlock({ onUnlocked, workspace = null, disabled = false, beginAttempt, endAttempt, compact = false }) {
    const [pin, setPin] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const profile = offlineProfile();
    if (!profile) return <p className="my-4 rounded border border-slate-300 p-3 text-sm">{compact ? 'ต้องการใช้ Offline? เข้าสู่ระบบแล้วเตรียม PIN และดาวน์โหลดแมตช์ก่อน' : 'ยังไม่ได้เตรียมใช้งาน Offline ในเบราว์เซอร์นี้ กรุณาเข้าสู่ระบบออนไลน์แล้วเตรียม PIN และดาวน์โหลดแมตช์ก่อน'}</p>;
    return <details className="mt-5 rounded-lg border border-slate-300 p-3 text-sm"><summary className="cursor-pointer font-semibold">{compact ? 'ปลดล็อกด้วย PIN Offline' : 'Offline PIN · VIS / ScorerControl'}</summary><p className="my-2">PIN ของบัญชี {profile.user} · สิทธิ์ถึง {new Date(profile.expiresAt).toLocaleString('th-TH')}</p>{compact && <p className="my-2">ใช้ข้อมูลในเครื่องโดยไม่ใช้อินเทอร์เน็ต การซิงค์ต้องเข้าสู่ระบบออนไลน์</p>}{profile.expiresAt <= Date.now() && <p role="alert" className="my-2 text-red-500">สิทธิ์ Offline หมดอายุ กรุณาเข้าสู่ระบบออนไลน์ด้วยบัญชีเดิมเพื่อต่ออายุ ข้อมูลแมตช์ยังอยู่ในเครื่อง</p>}<form onSubmit={async event => {
        event.preventDefault(); if (inFlight.current || disabled || (beginAttempt && !beginAttempt())) return; inFlight.current = true; setBusy(true); setError('');
        try { const user = await unlockOffline(pin, { workspace }); setPin(''); await onUnlocked(user); } catch (error) { setError(error.message); } finally { inFlight.current = false; setBusy(false); endAttempt?.(); }
    }}><label>PIN ของบัญชีนี้<input type="password" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6,12}" minLength={6} maxLength={12} disabled={busy || disabled} value={pin} onChange={event => setPin(event.target.value)} className="my-2 block w-full rounded border bg-slate-100 p-2 text-slate-900" /></label><button disabled={busy || disabled || profile.expiresAt <= Date.now()} className="rounded bg-sky-800 px-3 py-2 text-white">{busy ? 'กำลังตรวจสอบ PIN และสิทธิ์…' : 'ปลดล็อก Offline'}</button>{error && <p role="alert" className="mt-2 text-red-500">{error}</p>}</form></details>;
}

export default function VisOfflinePanel({ matches, reload }) {
    const [records, setRecords] = useState([]), [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false), [conflict, setConflict] = useState(null), [online, setOnline] = useState(navigator.onLine);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        const changed = () => setRefresh(value => value + 1);
        window.addEventListener('vis-local-updated', changed); window.addEventListener('focus', changed);
        return () => { window.removeEventListener('vis-local-updated', changed); window.removeEventListener('focus', changed); };
    }, []);
    const [pwaReady, setPwaReady] = useState(false);
    useEffect(() => {
        let active = true;
        if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => { if (active) setPwaReady(true); });
        return () => { active = false; };
    }, []);
    useEffect(() => {
        let active = true;
        listLocal().then(result => { if (active) setRecords(result); }).catch(error => { if (active) { setRecords([]); setNotice(error.message); } });
        return () => { active = false; };
    }, [refresh]);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update); window.addEventListener('offline', update);
        return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }, []);
    const run = async action => {
        setBusy(true); setNotice('');
        try { await action(); setRefresh(value => value + 1); reload(); }
        catch (error) { setNotice(error.response?.data?.error || error.message); }
        finally { setBusy(false); }
    };
    const sync = (record, release) => run(async () => {
        try { await syncLocalMatch(record.id, release); setConflict(null); setNotice(release ? 'ซิงค์ครบและคืนสิทธิ์แล้ว เปิดแมตช์เซิร์ฟเวอร์เพื่อตรวจสอบ ยืนยันผล หรือเผยแพร่' : 'ซิงค์สำเร็จ · ยังจองสิทธิ์เครื่องหลักไว้'); }
        catch (error) { if (error.response?.status === 409) setConflict(record.id); throw error; }
    });
    return <section className="mb-4 space-y-3 rounded-xl border border-sky-900 bg-slate-900 p-3 text-sm text-slate-200" aria-label="Offline VIS และการซิงค์">
        <AccessStatus /><div className="flex flex-wrap items-center gap-3"><strong>VIS Offline · {online ? 'มีเครือข่าย' : 'ไม่มีเครือข่าย'}</strong><button disabled={busy} className="rounded border border-sky-700 px-3 py-1" onClick={() => { try { switchAccessMode(!offlineMode()); setRefresh(value => value + 1); reload(); } catch (error) { setNotice(error.message); } }}>{offlineMode() ? 'กลับโหมดเซิร์ฟเวอร์' : 'ทำงานในเครื่อง'}</button><span className="text-xs text-slate-400">เครื่องหลัก {deviceId().slice(0, 8)} · {offlineProfile() ? `สิทธิ์ถึง ${new Date(offlineProfile().expiresAt).toLocaleDateString('th-TH')}` : 'ยังไม่เตรียม Offline'}</span></div>
        <p className="text-xs text-amber-200">ข้อมูลที่ยังไม่ซิงค์อยู่ในเบราว์เซอร์นี้ การล้างข้อมูลเว็บไซต์ เปลี่ยนเครื่อง หรือใช้โหมดไม่ระบุตัวตนอาจทำให้ข้อมูลหาย โปรดส่งออก JSON สำรอง</p>
        <p className="text-xs text-slate-400">PWA: {pwaReady ? 'เก็บไฟล์แอปสำหรับ Offline แล้ว' : import.meta.env.PROD ? 'กำลังเตรียมไฟล์แอป กรุณารอขณะออนไลน์' : 'ใช้ได้เมื่อเปิด production build ผ่าน HTTPS หรือ localhost'} · ติดตั้งแอปได้จากเมนูเบราว์เซอร์</p>
        <a href="/vis/login?reauth=1" className="inline-block text-sky-300 underline">เข้าสู่ระบบออนไลน์เพื่อซิงค์</a>
        <details><summary className="cursor-pointer text-sky-300">เตรียมเครื่อง / ต่ออายุสิทธิ์ / ปลดล็อก</summary>
            <OfflineSetup getPermit={api.getOfflinePermit} onPrepared={() => { setRefresh(value => value + 1); reload(); }} />
            <OfflineUnlock workspace="vis" onUnlocked={() => { setRefresh(value => value + 1); reload(); }} />
        </details>
        <label className="block">นำแมตช์สร้างเองบนเซิร์ฟเวอร์มาทำงาน Offline <select disabled={busy || !online} value="" className="ml-2 max-w-full rounded bg-slate-800 p-2" onChange={event => {
            const id = event.target.value; if (!id) return;
            run(async () => { await listLocal(); const response = await api.checkoutOfflineVis(id, deviceId()); await checkoutLocal(id, response.data.payload, response.data.match); setNotice('จองสิทธิ์และเก็บแมตช์ในเครื่องแล้ว'); });
        }}><option value="">เลือกแมตช์…</option>{matches.filter(match => match.is_custom_vis && !match.is_offline_vis && !['confirmed', 'cancelled'].includes(match.vis_lifecycle)).map(match => <option key={match.id} value={match.id}>{match.home_team} – {match.away_team}</option>)}</select></label>
        <p className="text-xs text-slate-400">รองรับแมตช์สร้างเอง ส่วนตารางแข่งจาก Admin ยังคีย์ออนไลน์ · ต้องเตรียมแอป PWA ขณะออนไลน์ก่อนเปิดโดยไม่มีอินเทอร์เน็ต</p>
        {records.map(record => <div key={record.id} className="flex flex-wrap items-center gap-2 border-t border-slate-700 pt-2"><span className="min-w-40 flex-1">{record.payload.config.home.name} – {record.payload.config.away.name}<small className="block text-slate-400">{record.released ? 'คืนสิทธิ์แล้ว · อ่านอย่างเดียว' : `${record.queue.length} คำสั่งรอซิงค์${record.serverCreated ? '' : ' · แมตช์ใหม่ยังไม่ขึ้นเซิร์ฟเวอร์'}`} · ล่าสุด {record.lastSyncedAt ? new Date(record.lastSyncedAt).toLocaleString('th-TH') : 'ยังไม่ซิงค์'}</small></span>
            <button disabled={busy} className="rounded border border-slate-600 px-2 py-1" onClick={() => run(() => exportVisMatch(localView(record).match))}>สำรอง JSON</button>
            {!record.released && <><button disabled={busy || !online} className="rounded bg-sky-800 px-2 py-1" onClick={() => sync(record, false)}>ซิงค์</button><button disabled={busy || !online} className="rounded border border-emerald-700 px-2 py-1" onClick={() => sync(record, true)}>ซิงค์และคืนสิทธิ์</button></>}
            {record.released && <a href={`/adminvis/match/${record.serverId}`} onClick={event => { try { switchAccessMode(false); } catch (error) { event.preventDefault(); setNotice(error.message); } }} className="text-sky-300 underline">เปิดบนเซิร์ฟเวอร์</a>}
            {conflict === record.id && <div role="alert" className="w-full space-y-2 rounded border border-amber-700 p-2 text-amber-200"><p>ข้อมูลขัดแย้ง ระบบไม่ได้เขียนทับ เลือกเก็บเป็นสำเนาหรือสำรองก่อนโหลดข้อมูลเซิร์ฟเวอร์</p><button disabled={busy} className="mr-3 underline" onClick={() => run(async () => { const latest = await getLocal(record.id); await createLocal({ creationId: crypto.randomUUID(), importBackup: { config: latest.payload.config, match: latest.payload.match, actions: latest.payload.actions } }); setNotice('สร้างสำเนาใหม่แล้ว ต้นฉบับในเครื่องยังอยู่'); setConflict(null); })}>สร้างสำเนาเป็นแมตช์ใหม่</button><button disabled={busy || !online} className="underline" onClick={() => run(async () => {
                await exportVisMatch(localView(record).match);
                if (!window.confirm('ดาวน์โหลดสำรองแล้วหรือไม่? การโหลดเซิร์ฟเวอร์จะแทนที่ข้อมูลและคำสั่งรอซิงค์ของแมตช์นี้ในเครื่อง')) return;
                const response = await api.getCustomVis(record.serverId);
                await api.syncOfflineVis(record.serverId, { deviceId: deviceId(), baseRevision: response.data.state.revision, operations: [], release: true });
                await updateLocal(record.id, current => ({ ...current, payload: response.data.offlinePayload, baseRevision: response.data.state.revision, queue: [], released: true, serverCreated: true })); setConflict(null);
            })}>สำรองแล้วใช้ข้อมูลเซิร์ฟเวอร์</button></div>}
        </div>)}
        {notice && <p role="status" className="text-sky-200">{notice}</p>}
    </section>;
}
