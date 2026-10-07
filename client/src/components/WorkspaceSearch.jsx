import { useEffect, useRef, useState } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { Button, Feedback, StatusBadge } from './ui/SystemUI';
import { useLanguage } from '../context/LanguageContext';

export default function WorkspaceSearch({ onSelect }) {
    const { language } = useLanguage();
    const isThai = language === 'THA';
    const dialogRef = useRef(null);
    const searchInputRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    useEffect(() => {
        const onKey = event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(value => !value); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    useEffect(() => {
        if (open) {
            dialogRef.current?.showModal();
            searchInputRef.current?.focus();
        }
        else dialogRef.current?.close();
    }, [open]);
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true); setError(false);
        const sources = [
            { section: 'competitions', label: isThai ? 'รายการแข่งขัน' : 'Competition', request: api.getAllCompetitions },
            { section: 'clubs', label: isThai ? 'ทีม' : 'Team', request: api.getAllTeams },
            { section: 'players', label: isThai ? 'นักกีฬา' : 'Player', request: api.getAllPlayers },
            { section: 'matches', label: isThai ? 'คู่แข่งขัน' : 'Match', request: api.getPublicMatches }
        ];
        Promise.allSettled(sources.map(source => source.request())).then(results => {
            if (cancelled) return;
            setError(results.some(result => result.status === 'rejected'));
            setRecords(results.flatMap((result, index) => result.status === 'fulfilled' && Array.isArray(result.value.data) ? result.value.data.map(row => ({
                key: `${sources[index].section}-${row.id}`,
                section: sources[index].section, category: sources[index].label,
                label: row.title || row.name || row.player_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || `${row.team_a_name || row.home_team_name || '?'} · ${row.team_b_name || row.away_team_name || '?'}`,
                detail: [row.code, row.age_group_name, row.gender, row.competition_name, row.match_number ? `#${row.match_number}` : ''].filter(Boolean).join(' · ')
            })) : []));
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [open, reloadKey, isThai]);
    const results = query.trim() ? records.filter(record => `${record.label} ${record.detail} ${record.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 30) : [];
    return <>
        <Button variant="secondary" className="px-3" onClick={() => setOpen(true)} aria-label={isThai ? 'ค้นหาทั้งระบบ' : 'Search workspace'}><Search size={18} /><span className="hidden xl:inline">{isThai ? 'ค้นหา' : 'Search'}</span><kbd className="hidden text-xs text-slate-400 xl:inline">Ctrl K</kbd></Button>
        <dialog ref={dialogRef} onClose={() => setOpen(false)} aria-labelledby="workspace-search-title" className="ui-search-dialog">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 id="workspace-search-title" className="font-bold">{isThai ? 'ค้นหาทั้งระบบ' : 'Search workspace'}</h2><Button variant="secondary" onClick={() => setOpen(false)} aria-label={isThai ? 'ปิด' : 'Close'}><X size={18} /></Button></div>
            <div className="p-5"><label className="text-sm font-semibold text-slate-600">{isThai ? 'รายการ ทีม นักกีฬา หรือคู่แข่งขัน' : 'Competitions, teams, players or matches'}<input ref={searchInputRef} type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-200 px-4 font-normal" placeholder={isThai ? 'พิมพ์ชื่อหรือหมายเลขคู่แข่งขัน…' : 'Search by name or match number…'} /></label></div>
            <div className="max-h-[55vh] overflow-y-auto px-5 pb-5">
                {error && <Feedback error title={isThai ? 'ข้อมูลบางส่วนโหลดไม่สำเร็จ' : 'Some search sources are unavailable'} onRetry={() => setReloadKey(value => value + 1)} />}
                {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">{isThai ? 'กำลังค้นหาข้อมูล…' : 'Loading search data…'}</p> : !query.trim() ? <p className="py-8 text-center text-sm text-slate-500">{isThai ? 'พิมพ์คำค้นหาเพื่อเริ่มต้น' : 'Type to start searching'}</p> : results.length ? <ul className="divide-y divide-slate-100">{results.map(record => <li key={record.key}><button className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left hover:bg-blue-50" onClick={() => { onSelect(record.section, record.label); setOpen(false); }}><div><StatusBadge tone="info">{record.category}</StatusBadge><p className="mt-1 font-semibold text-slate-900">{record.label}</p><p className="text-xs text-slate-500">{record.detail}</p></div><ArrowRight size={16} className="shrink-0 text-slate-400" /></button></li>)}</ul> : <Feedback title={isThai ? 'ไม่พบข้อมูลตามคำค้นหา' : 'No matching records'} />}
            </div>
        </dialog>
    </>;
}
