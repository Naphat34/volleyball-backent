import { Volleyball as SystemVolleyball } from 'lucide-react';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

export default function PublicVisMatch() {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
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
    if (!data) return <main className="flex min-h-screen items-center justify-center bg-app-background p-6 text-app-ink"><p role="status">{(error) || (ui('กำลังโหลด Livescore VIMS…'))}</p></main>;
    return <main className="min-h-screen bg-app-background px-4 py-8 text-app-ink"><div className="mx-auto max-w-5xl space-y-6">
        <p className="text-xs text-app-muted">{ui("ข้อมูลล่าสุดบนเซิร์ฟเวอร์:")}{' '}{data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : ui('ไม่ระบุเวลา')}{' '}{ui("· รายการ Offline ที่ยังไม่ซิงค์ไม่แสดงที่หน้านี้")}</p>
        <header><p className="text-xs tracking-widest text-blue-600 dark:text-sky-300">{ui("VOLLEY / VIMS · แมตช์สร้างเอง")}</p><h1 className="mt-2 text-2xl font-bold">{data.title}</h1><p className="mt-2 text-sm text-app-muted">{data.date} · {(data.location) || (ui('ไม่ระบุสนาม'))}</p></header>
        <section className="rounded-2xl border border-slate-700 bg-app-surface p-5 text-center"><p className="mb-4 text-sm text-blue-700 dark:text-sky-200">{data.phase === 'MATCH_FINISHED' ? data.lifecycle === 'confirmed' ? ui('ยืนยันผลแล้ว') : ui('จบการแข่งขัน · รอตรวจสอบผล') : ui(`เซตที่ {0}`, [data.currentSet])}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><h2 className="text-lg font-semibold">{data.servingTeam === 'home' ? <SystemVolleyball size={16} className="inline-block mr-1" aria-label="Serving" /> : null}{data.home}</h2><strong className="text-4xl">{data.score.home} : {data.score.away}</strong><h2 className="text-lg font-semibold">{data.away}{data.servingTeam === 'away' ? <SystemVolleyball size={16} className="inline-block ml-1" aria-label="Serving" /> : null}</h2></div>
            <p className="mt-4 text-app-muted">{ui("เซต")}{' '}{data.setsWon.home} – {data.setsWon.away}</p><div className="mt-3 flex flex-wrap justify-center gap-2">{data.completedSets.map(set => <span key={set.set} className="rounded bg-app-surface-alt px-3 py-1 text-xs">{ui("เซต")}{' '}{set.set}: {set.home}–{set.away}</span>)}</div>
        </section>
        <section className="overflow-x-auto rounded-xl border border-slate-700 p-4"><h2 className="mb-3 font-semibold">{ui("สถิตินักกีฬา")}</h2><table className="w-full text-left text-sm"><thead className="text-app-muted"><tr>{['ทีม', 'เบอร์', 'นักกีฬา', 'ตบ', 'บล็อก', 'เสิร์ฟเอซ', 'รวม'].map(label => <th key={label} className="p-2">{ui(label)}</th>)}</tr></thead><tbody>{[...data.players].sort((a, b) => b.attack + b.block + b.serve - a.attack - a.block - a.serve).map(p => <tr key={`${p.team}-${p.number}`} className="border-t border-slate-800"><td className="p-2">{p.team === 'home' ? data.home : data.away}</td><td className="p-2">{p.number}</td><td className="p-2">{displayNames.personName(p)}</td><td className="p-2">{p.attack}</td><td className="p-2">{p.block}</td><td className="p-2">{p.serve}</td><td className="p-2 text-blue-600 dark:text-sky-300">{p.attack + p.block + p.serve}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-slate-500">{ui("อัปเดตอัตโนมัติทุก 3 วินาที · สถิติจากรายการที่บันทึกใน VIMS")}</p></section>
    </div></main>;
}
