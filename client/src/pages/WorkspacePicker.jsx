import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAccessSession } from '../authStorage';
import AccessStatus from '../components/AccessStatus';
import { workspacesFor, workspaceHome } from '../offline/workspaceRouting';
import { listLocal } from '../offline/offlineStore';
import { scorerRecords } from '../offline/scorerOffline';

export default function WorkspacePicker() {
    const session = getAccessSession(), user = session.user, navigate = useNavigate();
    const offline = session.kind === 'offline';
    const allowed = workspacesFor(user), [counts, setCounts] = useState({});
    const role = user?.role;
    useEffect(() => {
        const choices = workspacesFor({ role });
        if (choices.length === 1) { navigate(workspaceHome(choices[0], offline), { replace: true }); return; }
        let active = true;
        Promise.all(choices.map(async key => {
            try {
                const records = await (key === 'vis' ? listLocal() : scorerRecords());
                return [key, `${records.length} แมตช์ในเครื่อง · ${records.reduce((sum, record) => sum + (record.queue?.length || 0), 0)} รายการรอซิงค์`];
            } catch (error) { return [key, `อ่านข้อมูลในเครื่องไม่ได้: ${error.message}`]; }
        })).then(entries => { if (active) setCounts(Object.fromEntries(entries)); });
        return () => { active = false; };
    }, [role, navigate, offline]);
    return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-3xl py-12">
        <h1 className="mb-4 text-3xl font-bold">เลือกพื้นที่ทำงาน</h1><AccessStatus />
        <div className="grid gap-4 sm:grid-cols-2">{allowed.map(key => <Link key={key} className="rounded-xl border border-slate-600 bg-slate-900 p-6 hover:border-sky-400" to={workspaceHome(key, offline)}>
            <h2 className="text-2xl font-bold text-sky-300">{key === 'vis' ? 'VIS' : 'ScorerControl'}</h2>
            <p className="my-3">{key === 'vis' ? 'คีย์ทักษะและวิเคราะห์สถิติการแข่งขัน' : 'ควบคุมคะแนนและการแข่งขัน'}</p><p>{counts[key] || 'กำลังตรวจสอบข้อมูลในเครื่อง…'}</p>
        </Link>)}</div>
        <p className="mt-6">PIN ใช้ปลดล็อกข้อมูลในเครื่อง การซิงค์ต้องเข้าสู่ระบบออนไลน์ด้วยบัญชีเจ้าของข้อมูล</p>
        <Link className="mt-4 inline-block text-sky-300 underline" to="/login?reauth=1">เข้าสู่ระบบออนไลน์ / เปลี่ยนบัญชี</Link>
    </div></main>;
}
