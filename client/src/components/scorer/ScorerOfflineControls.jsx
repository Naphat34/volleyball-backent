import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import client from '../../api';
import OfflineSetup from '../auth/OfflineSetup';
import AccessStatus from '../auth/AccessStatus';
import { scorerOfflineActive, scorerRecord, prepareScorer, syncScorer, backupScorer } from '../../offline/scorerOffline';
import EventQueue from '../../utils/scorer/eventQueue';
import { ensureOfflineShell } from '../../offline/offlineShell';
export default function ScorerOfflineControls({ matchId, flushState }) {
    const [open, setOpen] = useState(false), [record, setRecord] = useState(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    useEffect(() => { const shell = document.querySelector('.scorer-shell'); if (shell) shell.inert = busy; return () => { if (shell) shell.inert = false; }; }, [busy]);
    useEffect(() => {
        let active = true;
        const refresh = () => { scorerRecord(matchId).then(value => { if (active) setRecord(value); }).catch(() => {}); };
        refresh(); window.addEventListener('scorer-offline-updated', refresh);
        return () => { active = false; window.removeEventListener('scorer-offline-updated', refresh); };
    }, [matchId]);
    const run = async action => { setBusy(true); setNotice(''); try { await action(); } catch (error) { setNotice(error.response?.data?.error || error.message); } finally { setBusy(false); } };
    return <div><button className="ui-button ui-button-secondary" onClick={() => setOpen(value => !value)} aria-expanded={open}>☁ Offline {record?.queue.length ? `(${record.queue.length})` : ''}</button>
        {busy && createPortal(<div role="status" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 text-lg text-white">กำลังดำเนินการ กรุณารอ…</div>,document.body)}
        {open && <section role="dialog" aria-label="ScorerControl Offline" className="fixed right-3 top-20 z-[90] max-h-[80vh] w-[min(95vw,650px)] space-y-3 overflow-y-auto rounded-xl border border-slate-400 bg-white p-5 text-sm text-slate-800 shadow-xl">
            <div className="flex justify-between"><strong>ScorerControl Offline · เครื่องหลักหนึ่งเครื่อง</strong><button onClick={() => setOpen(false)} aria-label="ปิด">✕</button></div>
            <p>ต้องใช้ production build ผ่าน HTTPS/localhost และเปิดแอปออนไลน์ให้ PWA พร้อมก่อนตัดเครือข่าย</p>
            <p className="text-amber-700">การล้างข้อมูลเว็บไซต์อาจลบงานที่ยังไม่ซิงค์ กรุณาสำรอง JSON · งานคำขอจากเครื่องเจ้าหน้าที่ทีมต้องใช้ออนไลน์</p>
            <AccessStatus /><OfflineSetup getPermit={() => client.get('/scorer/offline-permit')} />
            <div className="flex flex-wrap gap-2">
                {!scorerOfflineActive(matchId) && <button disabled={busy} className="ui-button ui-button-primary" onClick={() => run(async () => {
                    if (EventQueue.getQueue().some(event => String(event.matchId) === String(matchId))) throw Error('รอคิวออนไลน์ของแมตช์นี้ส่งครบก่อนจอง Offline');
                    await flushState();
                    await ensureOfflineShell();
                    await prepareScorer(client, matchId); window.location.reload();
                })}>ดาวน์โหลดและจองแมตช์ Offline</button>}
                {record && <button disabled={busy} className="ui-button ui-button-secondary" onClick={() => run(() => backupScorer(matchId))}>สำรอง JSON</button>}
                {scorerOfflineActive(matchId) && <><button disabled={busy} className="ui-button ui-button-primary" onClick={() => run(async () => { await flushState(); await syncScorer(client, matchId); setNotice('ซิงค์สำเร็จ ยังคงจองเครื่องหลัก'); })}>ซิงค์</button><button disabled={busy} className="ui-button ui-button-secondary" onClick={() => run(async () => { await flushState(); await syncScorer(client, matchId, true); window.location.reload(); })}>ซิงค์และคืนสิทธิ์</button></>}
                {record?.released && <button disabled={busy} className="ui-button ui-button-primary" onClick={() => run(async () => { await client.post(`/scorer/match/${matchId}/offline-confirm`); window.location.reload(); })}>ตรวจสอบแล้ว · ยืนยันผลทางการ</button>}
            </div>
            <p>{record ? `${record.queue.length} คำสั่งรอซิงค์ · ล่าสุด ${record.syncedAt || 'ยังไม่ซิงค์'}` : 'ยังไม่ได้ดาวน์โหลดแมตช์นี้'}</p>
            <a className="text-blue-700 underline" href={`/login?reauth=1&returnTo=${encodeURIComponent(`/scorer/${matchId}`)}`}>เข้าสู่ระบบออนไลน์ / ปลดล็อกด้วย PIN</a>
            <a className="ml-3 text-blue-700 underline" href="/scorer-offline">รายการแมตช์ในเครื่อง</a>
            {notice && <p role="status" className="text-amber-800">{notice} หากข้อมูลขัดแย้งให้สำรองและตรวจสอบกับผู้ดูแล ระบบไม่เขียนทับอัตโนมัติ</p>}
        </section>}
    </div>;
}
