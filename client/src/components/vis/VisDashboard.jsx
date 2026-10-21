import AccessStatus from '../auth/AccessStatus';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../api';
import VisCreateMatch from './VisCreateMatch';
import VisOpenMatchFile from './VisOpenMatchFile';
import VisMatchDialog from './VisMatchDialog';
import VisLineupPanel from './VisLineupPanel';
import { generateVisMatchPDF } from '../../utils/reports/pdfGenerator';
import { exportVisMatch } from '../../utils/vis/visMatchFiles';
import './VisDashboard.css';
import VisOfflinePanel from './VisOfflinePanel';

const statuses = { scheduled: ['ยังไม่เริ่ม', 'Scheduled'], live: ['กำลังแข่งขัน', 'Live'], completed: ['จบการแข่งขัน', 'Completed'], cancelled: ['ยกเลิก', 'Cancelled'] };
const lifecycle = { draft: 'ฉบับร่าง', ready: 'พร้อมแข่งขัน', playing: 'กำลังแข่งขัน', review: 'รอตรวจสอบผล', confirmed: 'ยืนยันผลแล้ว', cancelled: 'ยกเลิก' };
export default function VisDashboard({ th, user, matches, matchId, loading, error, competitions, competitionLabel,
    competition, setCompetition, status, setStatus, search, setSearch, reload, logout, loggingOut, lastUpdated }) {
    const { language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [create, setCreate] = useState(null), [fileMode, setFileMode] = useState(null), [team, setTeam] = useState('');
    const [sort, setSort] = useState({ field: 'updated', descending: true }), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10);
    const [dialog, setDialog] = useState(null), [lineup, setLineup] = useState(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const [colors, setColors] = useState({ home: '#6366f1', away: '#f43f5e' });
    const [offlineOpen, setOfflineOpen] = useState(false);
    const query = search.trim().toLocaleLowerCase();
    const customTitles = [...new Set(matches.filter(m => m.is_custom_vis).map(m => m.competition_name))];
    const teamNames = [...new Set(matches.flatMap(m => [m.home_team, m.away_team]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    const filtered = matches.filter(m => (!competition || (competition.startsWith('custom:') ? m.is_custom_vis && m.competition_name === competition.slice(7) : String(m.competition_id) === competition))
        && (!status || m.status === status) && (!team || [m.home_team, m.away_team].includes(team))
        && (!query || [m.home_team, m.away_team, m.competition_name, m.match_number, m.location].some(value => String(value || '').toLocaleLowerCase().includes(query))))
        .sort((a, b) => {
            const value = m => sort.field === 'date' ? m.match_date || '' : sort.field === 'match' ? `${m.home_team} ${m.away_team}` : sort.field === 'competition' ? competitionLabel(m) : sort.field === 'score' ? `${m.home_set_score || 0}:${m.away_set_score || 0}` : sort.field === 'status' ? m.status : m.updated_at || m.created_at || m.match_date || '';
            return String(value(a)).localeCompare(String(value(b)), th ? 'th' : 'en', { numeric: true }) * (sort.descending ? -1 : 1);
        });
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pages);
    const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const reset = () => { setSearch(''); setCompetition(''); setStatus(''); setTeam(''); setPage(1); };
    const run = async action => { setBusy(true); setNotice(''); try { await action(); } catch (error) { setNotice(error.response?.data?.error || error.message || 'ดำเนินการไม่สำเร็จ'); } finally { setBusy(false); } };
    const openDialog = (match, mode) => run(async () => {
        const [state, roster] = await Promise.all([api.getVisState(match.id), api.getMatchRosterData(match.id)]);
        const teams = ['home', 'away'].map(key => ({ key, name: match[`${key}_team`], players: roster.data[key].players.map(p => ({ ...p, id: Number(p.id), name: p.name || `${p.first_name} ${p.last_name}` })),
            lineup: state.data.state.lineups[key].map(id => roster.data[key].players.find(p => Number(p.id) === Number(id))).filter(Boolean) }));
        setDialog({ mode, match: { ...match, ...roster.data.match }, teams, events: state.data.events, state: state.data.state });
    });
    const pdf = match => run(async () => { const response = await api.getMatchScoresheetData(match.id); await generateVisMatchPDF(response.data); });
    const sortHeader = (field, label) => <button aria-label={`${label} · ${sort.field === field && sort.descending ? 'เรียงจากมากไปน้อย' : 'เรียงจากน้อยไปมาก'}`} onClick={() => { setSort(previous => ({ field, descending: previous.field === field ? !previous.descending : false })); setPage(1); }}>{label}<span className={sort.field === field ? 'vd-sort-active' : ''}>{sort.field === field ? sort.descending ? ' ▼' : ' ▲' : ' ↕'}</span></button>;
    const date = value => { if (!value) return '—'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString(th ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    return <div className="vis-dash">
        {create && <VisCreateMatch sources={matches} matchId={create.id} onClose={() => { setCreate(null); reload(); }} onSaved={(id, start) => { setCreate(null); reload(); if (start) navigate(`/adminvis/match/${id}`); }} />}
        {fileMode && <VisOpenMatchFile mode={fileMode} onClose={() => setFileMode(null)} onOpened={id => { setFileMode(null); reload(); navigate(`/adminvis/match/${id}`); }} />}
        {dialog && <VisMatchDialog {...dialog} readOnly={dialog.match.status === 'completed'} onClose={() => { setDialog(null); reload(); }} colors={colors} onColors={setColors} onPDF={() => pdf(dialog.match)}
            canEditLineup={dialog.state.currentSet === 1 && !dialog.state.history.length} onLineup={() => { setLineup(dialog); setDialog(null); }} />}
        {lineup && <VisLineupPanel teams={lineup.teams} requiresToss={lineup.state.requiresToss} initialServingTeam={lineup.state.servingTeam} initialHomeLeft={lineup.state.isHomeLeft}
            send={async command => { try { await api.saveVisCommand(lineup.match.id, { command, operationId: crypto.randomUUID(), revision: lineup.state.revision }); return true; } catch (error) { setNotice(error.response?.data?.error || 'บันทึกไลน์อัปไม่สำเร็จ'); setLineup(null); return false; } }} onClose={() => { setLineup(null); reload(); }} onCancel={() => setLineup(null)} />}
        <header className="vd-account-bar"><Link to="/adminvis" className="vd-brand">VOLLEY <span>/ VIS</span></Link><div className="vd-account">
            <div className="vd-languages" aria-label="ภาษา">{[['THA', 'ไทย'], ['ENG', 'EN']].map(([value, label]) => <button key={value} aria-pressed={language === value} className={language === value ? 'is-active' : ''} onClick={() => setLanguage(value)}>{label}</button>)}<button disabled title="ยังไม่รองรับภาษามองโกเลีย">MN</button></div>
            <span>{user?.first_name || user?.username || 'Statistician'} <b className="vd-badge">VIS</b></span>
            <details className="vd-sync"><summary className={error ? 'vd-error' : ''}>● {loading ? 'กำลังโหลด' : error ? 'โหลดไม่สำเร็จ' : 'ข้อมูลล่าสุด'}</summary><div><p>โหลดข้อมูลเมื่อ {date(lastUpdated)}</p><p>แมตช์ที่แสดง {matches.length} รายการ</p><p>เผยแพร่ {matches.filter(m => m.published).length} รายการ</p><p>แมตช์ในเครื่องต้องกดซิงค์เพื่อบันทึกขึ้นเซิร์ฟเวอร์</p><button onClick={reload} disabled={loading}>โหลดข้อมูลอีกครั้ง</button></div></details>
            {user?.role === 'admin' && <Link to="/admin">Admin</Link>}<button disabled={loggingOut} onClick={logout} aria-label="ออกจากระบบ">↪</button>
        </div></header>
        <main className="vd-main"><AccessStatus /><div className="vd-heading"><h1>{th ? 'การแข่งขัน' : 'Matches'}</h1><div className="vd-actions">
            <div className="vd-split"><button disabled={loading || busy} onClick={() => reload(true)}>⇩ {th ? 'ดึงแมตช์จากเซิร์ฟเวอร์' : 'Fetch matches'}</button><details><summary aria-label="ตัวเลือกการดึงแมตช์">▾</summary><div><button disabled={loading || busy} onClick={() => { reset(); reload(true); }}>ดึงทั้งหมดและล้างตัวกรอง</button></div></details></div>
            <button disabled={busy} onClick={() => setFileMode('web')}>☁ {th ? 'ไฟล์บนเว็บ' : 'Web file'}</button><button disabled={busy} onClick={() => setFileMode('seava')}>{th ? 'เปิดไฟล์ .seava' : 'Open .seava'}</button><button disabled={busy} onClick={() => setFileMode('json')}>{th ? 'นำเข้า JSON' : 'Import JSON'}</button>
            <button type="button" className={`vd-offline-toggle ${offlineOpen ? 'is-active' : ''}`} title="VIS Offline · ข้อมูลเครื่องและการซิงค์" aria-label="VIS Offline · ข้อมูลเครื่องและการซิงค์" aria-expanded={offlineOpen} aria-controls="vis-offline-information" onClick={() => setOfflineOpen(value => !value)}><CloudOff size={21} aria-hidden="true" /></button>
            <button className="vd-primary" onClick={() => setCreate({})}>+ {th ? 'สร้างแมตช์ใหม่' : 'New match'}</button>
        </div></div>
        <div id="vis-offline-information" className="vd-offline-content" hidden={!offlineOpen} onKeyDown={event => { if (event.key === 'Escape') { setOfflineOpen(false); document.querySelector('.vd-offline-toggle')?.focus(); } }}>
            <VisOfflinePanel matches={matches} reload={reload} />
        </div>
        {notice && <div role="status" className="vd-notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="ปิดข้อความ">✕</button></div>}
        <section className="vd-table-panel" aria-label="รายการแมตช์"><div className="vd-filters">
            <input aria-label="ค้นหาแมตช์" value={search} placeholder={th ? 'ค้นหา…' : 'Search…'} onChange={event => { setSearch(event.target.value); setPage(1); }} />
            <select aria-label="การแข่งขัน" value={competition} onChange={event => { setCompetition(event.target.value); setPage(1); }}><option value="">{th ? 'ทุกรายการแข่งขัน' : 'All competitions'}</option>{competitions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}{customTitles.map(title => <option key={title} value={`custom:${title}`}>{title} · VIS</option>)}</select>
            <select aria-label="สถานะ" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{th ? 'ทุกสถานะ' : 'All statuses'}</option>{Object.entries(statuses).map(([value, labels]) => <option key={value} value={value}>{labels[th ? 0 : 1]}</option>)}</select>
            <select aria-label="ทีม" value={team} onChange={event => { setTeam(event.target.value); setPage(1); }}><option value="">{th ? 'ทุกทีม' : 'All teams'}</option>{teamNames.map(name => <option key={name}>{name}</option>)}</select>
            {(search || competition || status || team) && <button className="vd-muted" onClick={reset}>ล้างตัวกรอง</button>}
        </div>
        <div className="vd-table-scroll"><table className="vd-table"><thead><tr><th>{sortHeader('date', th ? 'วันที่' : 'Date')}</th><th>{sortHeader('match', th ? 'แมตช์' : 'Match')}</th><th>{sortHeader('competition', th ? 'รายการ / สนาม' : 'Competition / venue')}</th><th>{sortHeader('score', th ? 'ผล' : 'Result')}</th><th>{sortHeader('status', th ? 'สถานะ' : 'Status')}</th><th>{sortHeader('updated', th ? 'แก้ไขล่าสุด' : 'Updated')}</th><th aria-label="การจัดการ" /></tr></thead><tbody>
            {loading || error || !rows.length || matchId ? <tr><td colSpan={7} className="vd-empty" role="status">{loading ? 'กำลังโหลดแมตช์…' : error || (matchId ? 'ไม่พบแมตช์ที่เปิด กรุณากลับรายการแมตช์' : 'ไม่พบแมตช์ตามเงื่อนไข')}</td></tr> : rows.map(m => <tr key={m.id}>
                <td className="vd-date">{m.match_date ? String(m.match_date).slice(0, 10) : '—'}</td><td className="vd-match"><strong><span>{m.home_team || 'TBA'}</span> <i>vs</i> <span>{m.away_team || 'TBA'}</span></strong><small>{m.match_number || m.id}</small><small>{m.is_custom_vis ? 'สร้างเอง · VIS' : 'ตารางแข่งขันจาก Admin'}</small></td>
                <td className="vd-competition"><span>{competitionLabel(m) || m.competition_name || '—'}</span><small>{m.location || '—'}</small></td><td className="vd-score">{['live', 'completed'].includes(m.status) ? `${m.home_set_score || 0} : ${m.away_set_score || 0}` : '—'}</td>
                <td><div className="vd-badges"><span className={`vd-badge vd-${m.status}`}>{m.is_custom_vis && th ? lifecycle[m.vis_lifecycle] : statuses[m.status]?.[th ? 0 : 1] || m.status}</span><span className="vd-badge">{m.is_custom_vis ? m.published ? 'สาธารณะ' : 'ส่วนตัว' : 'เซิร์ฟเวอร์'}</span></div></td><td className="vd-updated">{date(m.updated_at || m.created_at)}</td>
                <td><div className="vd-row-actions">{m.status !== 'cancelled' && m.home_team_id && m.away_team_id && <Link className="vd-primary" to={`/adminvis/match/${m.id}`}>{th ? 'บันทึกสถิติ' : 'Record'}</Link>}<button disabled={busy} onClick={() => m.is_custom_vis ? setCreate({ id: m.id }) : openDialog(m, 'settings')}>{th ? 'ตั้งค่าแมตช์' : 'Settings'}</button><button disabled={busy} onClick={() => openDialog(m, 'stats')}>{th ? 'สถิติ' : 'Stats'}</button>
                    <details className="vd-row-menu"><summary aria-label={`เมนูแมตช์ ${m.match_number || m.id}`}>⋯</summary><div><button disabled={busy} onClick={() => run(() => exportVisMatch(m))}>ส่งออก JSON</button><button disabled={busy} onClick={() => pdf(m)}>รายงาน PDF</button>{m.is_custom_vis && <button onClick={() => setCreate({ id: m.id })}>จัดการ / เผยแพร่</button>}{m.published && <a href={`/vis-live/${m.public_token}`} target="_blank" rel="noreferrer">เปิด Livescore ↗</a>}</div></details>
                </div></td>
            </tr>)}
        </tbody></table></div>
        <footer className="vd-pagination"><span>{th ? 'แสดง' : 'Showing'} {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} {th ? 'จาก' : 'of'} {filtered.length}</span><div>{pages > 1 && <><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage} / {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>›</button></>}<select aria-label="จำนวนต่อหน้า" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} / {th ? 'หน้า' : 'page'}</option>)}</select></div></footer>
        </section></main>
    </div>;
}
