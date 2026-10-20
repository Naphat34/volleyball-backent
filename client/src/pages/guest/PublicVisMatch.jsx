import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

export default function PublicVisMatch() {
    const { token } = useParams();
    const [data, setData] = useState(null), [error, setError] = useState('');
    useEffect(() => {
        let active = true, running = false;
        const refresh = async () => {
            if (running) return; running = true;
            try { const response = await api.getPublicVis(token); if (active) { setData(response.data); setError(''); } }
            catch (error) { if (active) { setData(null); setError(error.response?.data?.error || 'ไม่สามารถโหลด Livescore ได้'); } }
            finally { running = false; }
        };
        void refresh(); const interval = setInterval(refresh, 3000);
        return () => { active = false; clearInterval(interval); };
    }, [token]);
    if (!data) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"><p role="status">{error || 'กำลังโหลด Livescore VIS…'}</p></main>;
    return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-5xl space-y-6">
        <p className="text-xs text-slate-400">ข้อมูลล่าสุดบนเซิร์ฟเวอร์: {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ไม่ระบุเวลา'} · รายการ Offline ที่ยังไม่ซิงค์ไม่แสดงที่หน้านี้</p>
        <header><p className="text-xs tracking-widest text-sky-300">VOLLEY / VIS · แมตช์สร้างเอง</p><h1 className="mt-2 text-2xl font-bold">{data.title}</h1><p className="mt-2 text-sm text-slate-400">{data.date} · {data.location || 'ไม่ระบุสนาม'}</p></header>
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center"><p className="mb-4 text-sm text-sky-200">{data.phase === 'MATCH_FINISHED' ? data.lifecycle === 'confirmed' ? 'ยืนยันผลแล้ว' : 'จบการแข่งขัน · รอตรวจสอบผล' : `เซตที่ ${data.currentSet}`}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><h2 className="text-lg font-semibold">{data.servingTeam === 'home' ? '● ' : ''}{data.home}</h2><strong className="text-4xl">{data.score.home} : {data.score.away}</strong><h2 className="text-lg font-semibold">{data.away}{data.servingTeam === 'away' ? ' ●' : ''}</h2></div>
            <p className="mt-4 text-slate-300">เซต {data.setsWon.home} – {data.setsWon.away}</p><div className="mt-3 flex flex-wrap justify-center gap-2">{data.completedSets.map(set => <span key={set.set} className="rounded bg-slate-800 px-3 py-1 text-xs">เซต {set.set}: {set.home}–{set.away}</span>)}</div>
        </section>
        <section className="overflow-x-auto rounded-xl border border-slate-700 p-4"><h2 className="mb-3 font-semibold">สถิตินักกีฬา</h2><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr>{['ทีม', 'เบอร์', 'นักกีฬา', 'ตบ', 'บล็อก', 'เสิร์ฟเอซ', 'รวม'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{[...data.players].sort((a, b) => b.attack + b.block + b.serve - a.attack - a.block - a.serve).map(p => <tr key={`${p.team}-${p.number}`} className="border-t border-slate-800"><td className="p-2">{p.team === 'home' ? data.home : data.away}</td><td className="p-2">{p.number}</td><td className="p-2">{p.name}</td><td className="p-2">{p.attack}</td><td className="p-2">{p.block}</td><td className="p-2">{p.serve}</td><td className="p-2 text-sky-300">{p.attack + p.block + p.serve}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-slate-500">อัปเดตอัตโนมัติทุก 3 วินาที · สถิติจากรายการที่บันทึกใน VIS</p></section>
    </div></main>;
}
