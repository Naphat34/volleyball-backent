import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { buildVisReport, playerPoints } from '../../utils/vis/visReportData';
import { dashboardMatchStatusLabel, visStatusLabel } from '../../utils/vis/dashboardStatus';
import { dashboardSetResult } from '../../utils/vis/dashboardResult';

export default function AdminVisDetail({ match, onClose, onPDF }) {
    const { language } = useLanguage(), th = language === 'THA';
    const t = (a, b) => th ? a : b;
    const [tab, setTab] = useState('summary'), [data, setData] = useState(null), [state, setState] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
    const dialog = useRef(null), close = useRef(null);
    useEffect(() => {
        let active = true;
        const previous = document.activeElement, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden'; close.current?.focus();
        Promise.allSettled([api.getMatchScoresheetData(match.id), api.getVisState(match.id)]).then(results => {
            if (!active) return;
            if (results[0].status === 'fulfilled') setData(results[0].value.data);
            if (results[1].status === 'fulfilled') setState(results[1].value.data);
            if (results.some(r => r.status === 'rejected')) setError(th ? 'รายละเอียดบางส่วนโหลดไม่สำเร็จ แสดงข้อมูลล่าสุดจากภาพรวม' : 'Some details could not be loaded. Overview data is still available.');
            setLoading(false);
        });
        return () => { active = false; document.body.style.overflow = overflow; previous?.focus?.(); };
    }, [match.id, th]);
    const report = data ? buildVisReport(data) : null;
    const events = state?.events || [];
    const format = value => value ? new Date(value).toLocaleString(th ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok' }) : '-';
    const keys = e => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
        if (e.key !== 'Tab') return;
        const nodes = [...dialog.current.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(n => n.getClientRects().length);
        if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
        if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
    };
    return <div className="vims-overlay" onKeyDown={keys}><section className="vims-detail" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="vims-detail-title">
        <header><div><small>{t('ดูข้อมูลเท่านั้น', 'Read only')} · #{match.match_number || match.id}</small><h2 id="vims-detail-title">{match.home_team} vs {match.away_team}</h2><p>{match.competition_name}</p></div><button ref={close} onClick={onClose} aria-label={t('ปิด', 'Close')}><X size={20} /></button></header>
        <nav className="vims-tabs" aria-label={t('รายละเอียดแมตช์', 'Match details')}>{[['summary', t('ภาพรวม', 'Overview')], ['lineup', t('รายชื่อ / ไลน์อัป', 'Roster / lineup')], ['stats', t('สถิติ', 'Statistics')], ['history', t('ประวัติแรลลี่', 'Event history')], ['audit', t('ประวัติการแก้ไข', 'Audit history')]].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</nav>
        <div className="vims-detail-body">{loading && <p role="status">{t('กำลังโหลดรายละเอียด…', 'Loading details…')}</p>}{error && <p className="vims-warning" role="alert">{error}</p>}
            {tab === 'summary' && <><dl className="vims-facts">{[[t('ผลเซต', 'Sets'), dashboardSetResult(match)], [t('สถานะแข่งขัน', 'Match status'), dashboardMatchStatusLabel(match, th)], [t('สถานะสถิติ', 'VIS status'), visStatusLabel(match, th)], [t('สนาม', 'Venue'), match.location], [t('วัน / เวลา', 'Date / time'), `${match.match_date || '-'} ${match.start_time || ''}`], [t('เจ้าของแมตช์สร้างเอง', 'Custom match owner'), match.owner || t('ไม่มีข้อมูลผู้รับผิดชอบ', 'Not recorded')], [t('ซิงค์ล่าสุด', 'Last sync'), format(match.last_synced_at)], [t('แก้ไขล่าสุด', 'Updated'), format(match.updated_at)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl><h3>{t('คะแนนรายเซต', 'Set scores')}</h3>{report?.sets.length ? <div className="vims-set-list">{report.sets.map(set => <span key={set.number}>{t('เซต', 'Set')} {set.number}: <b>{set.home} - {set.away}</b></span>)}</div> : <p>{t('ไม่มีคะแนนรายเซตบนเซิร์ฟเวอร์', 'No set scores available on the server.')}</p>}<p className="vims-note">{t('สรุปนี้แยกคะแนนทางการออกจากงานสถิติ VIS และไม่แก้ไขข้อมูลการแข่งขัน', 'Official scores and VIS statistics are kept separate. This view does not modify match data.')}</p></>}
            {tab === 'lineup' && (report ? report.teams.map(team => <section key={team.key}><h3>{team.name}</h3><p>{t('ไลน์อัปปัจจุบันตามตำแหน่ง I–VI', 'Current lineup, positions I–VI')}: {(state?.state?.lineups?.[team.key] || []).map((id, i) => { const p = team.players.find(player => Number(player.id) === Number(id)); return `P${i + 1}: #${p?.number ?? '?'}`; }).join(' · ') || '-'}</p><div className="vims-scroll"><table><thead><tr><th>#</th><th>{t('ชื่อ', 'Name')}</th><th>{t('ตำแหน่ง', 'Position')}</th></tr></thead><tbody>{team.players.map(player => <tr key={player.id}><td>{player.number}</td><td>{player.name || [player.first_name, player.last_name].filter(Boolean).join(' ')}</td><td>{player.position || '-'}</td></tr>)}</tbody></table></div></section>) : !loading && <p>{t('ไม่มีข้อมูลรายชื่อ', 'Roster unavailable.')}</p>)}
            {tab === 'stats' && (report ? <>{!report.hasStats && <p className="vims-warning">{t('ยังไม่มีรายการสถิติที่บันทึก ตัวเลข 0 ในตารางไม่ใช่ผลยืนยัน', 'No statistics have been recorded. Zero values below are not confirmed results.')}</p>}{report.teams.map(team => <section key={team.key}><h3>{team.name}</h3><div className="vims-scroll"><table><thead><tr>{['#', t('ชื่อ', 'Name'), t('ตบ', 'Attack'), t('บล็อก', 'Block'), t('เอซ', 'Ace'), t('รวมแต้ม', 'Points')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{team.players.map(p => <tr key={p.id}><td>{p.number}</td><td>{p.name || [p.first_name, p.last_name].filter(Boolean).join(' ')}</td><td>{p.stats.A['#']}</td><td>{p.stats.B['#']}</td><td>{p.stats.S['#']}</td><td><b>{playerPoints(p.stats)}</b></td></tr>)}</tbody><tfoot><tr><th colSpan={2}>{t('รวมทีม', 'Team total')}</th><td>{team.stats.A['#']}</td><td>{team.stats.B['#']}</td><td>{team.stats.S['#']}</td><td>{playerPoints(team.stats)}</td></tr></tfoot></table></div></section>)}</> : !loading && <p>{t('ไม่มีข้อมูลสถิติ', 'Statistics unavailable.')}</p>)}
            {tab === 'history' && <><p>{events.length} {t('รายการบนเซิร์ฟเวอร์', 'server events')}</p><div className="vims-scroll"><table><thead><tr>{['#', t('เซต', 'Set'), t('ทีม', 'Team'), t('ผู้เล่น', 'Player'), t('ทักษะ', 'Skill'), t('ผล', 'Grade')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{events.map((event, i) => <tr key={event.id || i}><td>{i + 1}</td><td>{event.set_number || event.set_id}</td><td>{String(event.team_id) === String(match.home_team_id) ? match.home_team : String(event.team_id) === String(match.away_team_id) ? match.away_team : '-'}</td><td>{event.player_id || '-'}</td><td>{event.event_code || event.skill || event.action_type}</td><td>{event.grade || '-'}</td></tr>)}</tbody></table></div>{!events.length && !loading && <p>{t('ไม่มีรายการที่อ่านได้จากเซิร์ฟเวอร์', 'No server events available.')}</p>}</>}
            {tab === 'audit' && <>{!match.audit?.length ? <p>{t('แมตช์นี้ยังไม่มีบันทึกผู้แก้ไขในระบบ ไม่สามารถระบุผู้บันทึกย้อนหลังได้', 'No audit entries are recorded for this match. Historical operators cannot be inferred.')}</p> : <div className="vims-scroll"><table><thead><tr><th>{t('เวลา', 'Time')}</th><th>{t('รายการ', 'Action')}</th><th>{t('บัญชีผู้ใช้ ID', 'User ID')}</th><th>Revision</th></tr></thead><tbody>{match.audit.map((a, i) => <tr key={i}><td>{format(a.at)}</td><td>{a.action}</td><td>{a.actor_id ?? '-'}</td><td>{a.revision ?? '-'}</td></tr>)}</tbody></table></div>}</>}
        </div><footer><p>{t('ข้อมูล Offline ที่ยังไม่ซิงค์จะไม่ปรากฏที่นี่', 'Unsynced device data is not visible here.')}</p><button disabled={!data || loading} onClick={() => onPDF(match, data)}>P-2 PDF</button></footer>
    </section></div>;
}
