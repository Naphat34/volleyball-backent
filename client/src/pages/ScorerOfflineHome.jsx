import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { scorerRecords, backupScorer } from '../offline/scorerOffline';
import AccessStatus from '../components/AccessStatus';
import { resolveAccess, navigateAccess } from '../offline/accessRouting';

export default function ScorerOfflineHome() {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        scorerRecords().then(rows => { if (active) setRecords(rows); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [version]);
    return <main className="min-h-screen bg-slate-950 p-6 text-white">
        <h1 className="mb-5 text-2xl font-bold">ScorerControl · แมตช์ในเครื่อง</h1><AccessStatus />
        <nav className="mb-5 flex flex-wrap gap-4 text-sky-300 underline"><Link to="/workspaces">สลับพื้นที่ทำงาน</Link><Link to="/scorer/login?reauth=1">เข้าสู่ระบบออนไลน์ / ต่ออายุ PIN</Link><button onClick={() => setVersion(value => value + 1)} disabled={loading}>อ่านข้อมูลในเครื่องอีกครั้ง</button></nav>
        {loading && <p role="status">กำลังอ่านแมตช์ในเครื่อง…</p>}
        {error && <p role="alert" className="rounded border border-red-500 p-3">อ่านข้อมูลในเครื่องไม่สำเร็จ: {error} · กรุณาลองใหม่ ข้อมูลยังไม่ได้ถูกลบ</p>}
        {!loading && !error && !records.length && <p>ปลดล็อกสำเร็จ แต่ยังไม่มีแมตช์ที่ดาวน์โหลดไว้ ให้เข้าสู่ระบบออนไลน์ เปิด ScorerControl ของแมตช์ แล้วเลือกดาวน์โหลดและจองแมตช์ Offline</p>}
        {!loading && !error && records.map(record => <article key={record.id} className="my-4 space-y-3 rounded-xl border border-slate-600 p-4">
            <h2>แมตช์ #{record.id} · {record.queue.length} คำสั่งรอซิงค์</h2><p>{record.released ? 'คืนสิทธิ์แล้ว · ไม่เปิดบันทึก Offline ต่อ' : 'บันทึกในเครื่อง'} · ซิงค์ล่าสุด {record.syncedAt || 'ยังไม่ซิงค์'}</p>
            <button className="mr-4 text-sky-300 underline" onClick={async () => { try { await backupScorer(record.id); } catch (error) { setError(error.message); } }}>สำรอง JSON</button>
            {!record.released && <button className="text-sky-300 underline" onClick={async () => {
                try { navigateAccess(navigate, await resolveAccess({ workspace: 'scorer', search: `?returnTo=/scorer/${record.id}` })); }
                catch (error) { setError(error.message); }
            }}>เปิดแมตช์</button>}
        </article>)}
    </main>;
}
