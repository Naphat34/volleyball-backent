import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import VisThemeToggle from './VisThemeToggle';
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
import { previewVisMatchResultPDF } from '../../utils/reports/pdfGenerator';
import { exportVisMatch } from '../../utils/vis/visMatchFiles';
import './VisDashboard.css';
import VisOfflinePanel from './VisOfflinePanel';
import VisMatchTable from './VisMatchTable';
import { groupVisMatches, visMatchSortValue, visCompetitionName, visCompetitionKey } from '../../utils/vis/dashboardLayout';
import { dashboardMatchStatus, visStatuses } from '../../utils/vis/dashboardStatus';

const statuses = { scheduled: ['ยังไม่เริ่ม', 'Scheduled'], live: ['กำลังแข่งขัน / บันทึก', 'Live / Recording'], completed: ['จบแล้ว', 'Finished'], cancelled: ['ยกเลิก', 'Cancelled'] };
export default function VisDashboard({ th, user, matches, matchId, loading, error, competitions, competitionLabel,
    competition, setCompetition, status, setStatus, search, setSearch, reload, logout, loggingOut, lastUpdated, serverMatchesLoaded = false }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const { language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [create, setCreate] = useState(null), [fileMode, setFileMode] = useState(null), [team, setTeam] = useState('');
    const [sort, setSort] = useState({ field: 'number', descending: false }), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10);
    const [dialog, setDialog] = useState(null), [lineup, setLineup] = useState(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const [colors, setColors] = useState({ home: '#6366f1', away: '#f43f5e' });
    const [offlineOpen, setOfflineOpen] = useState(false);
    const [visStatus, setVisStatus] = useState('');
    const query = search.trim().toLocaleLowerCase();
    const customTitles = [...new Set(matches.filter(m => m.is_custom_vis).map(m => m.competition_name))];
    const navbarCompetition = competition.startsWith('custom:') ? competition.slice(7)
        : competition ? visCompetitionName(matches.find(match => competition.startsWith('name:') ? visCompetitionKey(match.competition_name) === competition : String(match.competition_id) === competition)?.competition_name)
        : th ? 'ทุกรายการแข่งขัน' : 'All competitions';
    const teamNames = [...new Set(matches.flatMap(m => [m.home_team, m.away_team]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    const filtered = matches.filter(m => (!competition || (competition.startsWith('custom:') ? m.is_custom_vis && m.competition_name === competition.slice(7) : competition.startsWith('name:') ? Boolean(m.competition_id) && visCompetitionKey(m.competition_name) === competition : String(m.competition_id) === competition))
        && (!status || dashboardMatchStatus(m) === status) && (!visStatus || m.vis_summary?.status === visStatus) && (!team || [m.home_team, m.away_team].includes(team))
        && (!query || [m.home_team, m.away_team, m.competition_name, m.match_number, m.location].some(value => String(value || '').toLocaleLowerCase().includes(query))))
        .sort((a, b) => {
            const value = m => visMatchSortValue(m, sort.field, competitionLabel);
            return String(value(a)).localeCompare(String(value(b)), th ? 'th' : 'en', { numeric: true }) * (sort.descending ? -1 : 1);
        });
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pages);
    const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const groups = groupVisMatches(rows, filtered);
    const sortState = field => sort.field === field ? sort.descending ? 'descending' : 'ascending' : 'none';
    const reset = () => { setSearch(''); setCompetition(''); setStatus(''); setVisStatus(''); setTeam(''); setPage(1); };
    const run = async action => { setBusy(true); setNotice(''); try { await action(); } catch (error) { setNotice(error.response?.data?.error || error.message || 'ดำเนินการไม่สำเร็จ'); } finally { setBusy(false); } };
    const openDialog = (match, mode) => run(async () => {
        const [state, roster] = await Promise.all([api.getVisState(match.id), api.getMatchRosterData(match.id)]);
        setColors({ home: roster.data.match.home_team_color || '#6366f1', away: roster.data.match.away_team_color || '#f43f5e' });
        const teams = ['home', 'away'].map(key => ({ key, name: match[`${key}_team`], staff: roster.data[key].staff || [], players: roster.data[key].players.map(p => ({ ...p, id: Number(p.id), name: p.name || `${p.first_name} ${p.last_name}` })),
            lineup: state.data.state.lineups[key].map(id => roster.data[key].players.find(p => Number(p.id) === Number(id))).filter(Boolean) }));
        setDialog({ mode, match: { ...match, ...roster.data.match }, teams, events: state.data.events, state: state.data.state });
    });
    const pdf = match => run(async () => { const response = await api.getMatchScoresheetData(match.id); await previewVisMatchResultPDF(response.data, { language }); });
    const sortHeader = (field, label) => <button aria-label={`${label} · ${sort.field === field && sort.descending ? 'เรียงจากมากไปน้อย' : 'เรียงจากน้อยไปมาก'}`} onClick={() => { setSort(previous => ({ field, descending: previous.field === field ? !previous.descending : false })); setPage(1); }}>{ui(label)}<span className={sort.field === field ? 'vd-sort-active' : ''}>{sort.field === field ? sort.descending ? ' ▼' : ' ▲' : ' ↕'}</span></button>;
    const date = value => { if (!value) return '—'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString(th ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    return <div className="vis-dash">
        {create && <VisCreateMatch sources={matches} matchId={create.id} onClose={() => { setCreate(null); reload(); }} onSaved={(id, start) => { setCreate(null); reload(); if (start) navigate(`/adminvis/match/${id}`); }} />}
        {fileMode && <VisOpenMatchFile mode={fileMode} onClose={() => setFileMode(null)} onOpened={id => { setFileMode(null); reload(); navigate(`/adminvis/match/${id}`); }} />}
        {dialog && <VisMatchDialog {...dialog} readOnly={dialog.match.status === 'completed'} onClose={() => { setDialog(null); reload(); }} colors={colors} onColors={setColors} onPDF={() => pdf(dialog.match)}
            canEditLineup={dialog.state.currentSet === 1 && !dialog.state.history.length} onLineup={() => { setLineup(dialog); setDialog(null); }} />}
        {lineup && <VisLineupPanel colors={colors} setNumber={lineup.state.currentSet} teams={lineup.teams} requiresToss={lineup.state.requiresToss} initialServingTeam={lineup.state.servingTeam} initialHomeLeft={lineup.state.isHomeLeft}
            send={async command => { try { await api.saveVisCommand(lineup.match.id, { command, operationId: crypto.randomUUID(), revision: lineup.state.revision }); return true; } catch (error) { setNotice(error.response?.data?.error || 'บันทึกไลน์อัปไม่สำเร็จ'); setLineup(null); return false; } }} onClose={() => { setLineup(null); reload(); }} onCancel={() => setLineup(null)} />}
        <header className="vd-account-bar"><Link to="/adminvis" className="vd-brand">{ui("VOLLEY")}{' '}<span>{ui("/ VIMS")}</span>{navbarCompetition && <> / {navbarCompetition}</>}</Link><div className="vd-account"><VisThemeToggle />
            <div className="vd-languages" aria-label={ui("ภาษา")}>{[['THA', 'ไทย'], ['ENG', 'EN']].map(([value, label]) => <button key={value} aria-pressed={language === value} className={language === value ? 'is-active' : ''} onClick={() => setLanguage(value)}>{ui(label)}</button>)}</div>
            <span>{(displayNames.personFirstName(user) || user?.username) || (ui('Statistician'))} <b className="vd-badge">{ui("VIMS")}</b></span>
            <details className="vd-sync"><summary className={error ? 'vd-error' : ''}>● {loading ? ui('กำลังโหลด') : error ? ui('โหลดไม่สำเร็จ') : ui('ข้อมูลล่าสุด')}</summary><div><p>{ui("โหลดข้อมูลเมื่อ")}{' '}{date(lastUpdated)}</p><p>{ui("แมตช์ที่แสดง")}{' '}{matches.length}{' '}{ui("รายการ")}</p><p>{ui("เผยแพร่")}{' '}{matches.filter(m => m.published).length}{' '}{ui("รายการ")}</p><p>{ui("แมตช์ในเครื่องต้องกดซิงค์เพื่อบันทึกขึ้นเซิร์ฟเวอร์")}</p><button onClick={reload} disabled={loading}>{ui("โหลดข้อมูลอีกครั้ง")}</button></div></details>
            {user?.role === 'admin' && <Link to="/admin">{ui("Admin")}</Link>}<button disabled={loggingOut} onClick={logout} aria-label={ui("ออกจากระบบ")}>↪</button>
        </div></header>
        <main className="vd-main"><AccessStatus /><div className="vd-heading"><h1>{th ? ui('การแข่งขัน') : ui('Matches')}</h1><div className="vd-actions">
            <div className="vd-split"><button disabled={loading || busy} onClick={() => reload(true)}>⇩ {th ? ui('ดึงแมตช์จากเซิร์ฟเวอร์') : ui('Fetch matches')}</button><details><summary aria-label={ui("ตัวเลือกการดึงแมตช์")}>▾</summary><div><button disabled={loading || busy} onClick={() => { reset(); reload(true); }}>{ui("ดึงทั้งหมดและล้างตัวกรอง")}</button></div></details></div>
            <button disabled={busy} onClick={() => setFileMode('json')}>{th ? ui('นำเข้า JSON') : ui('Import JSON')}</button>
            <button type="button" className={`vd-offline-toggle ${offlineOpen ? 'is-active' : ''}`} title={ui("VIMS Offline · ข้อมูลเครื่องและการซิงค์")} aria-label={ui("VIMS Offline · ข้อมูลเครื่องและการซิงค์")} aria-expanded={offlineOpen} aria-controls="vis-offline-information" onClick={() => setOfflineOpen(value => !value)}><CloudOff size={21} aria-hidden="true" /></button>
            <button className="vd-primary" onClick={() => setCreate({})}>+ {th ? ui('สร้างแมตช์ใหม่') : ui('New match')}</button>
        </div></div>
        <div id="vis-offline-information" className="vd-offline-content" hidden={!offlineOpen} onKeyDown={event => { if (event.key === 'Escape') { setOfflineOpen(false); document.querySelector('.vd-offline-toggle')?.focus(); } }}>
            <VisOfflinePanel matches={matches} reload={reload} />
        </div>
        {notice && <div role="status" className="vd-notice"><span>{ui(notice)}</span><button onClick={() => setNotice('')} aria-label={ui("ปิดข้อความ")}>✕</button></div>}

        {!serverMatchesLoaded && <p className="vd-refresh-note">{th ? ui('แมตช์จาก Admin จะแสดงหลังจากกด “ดึงแมตช์จากเซิร์ฟเวอร์” · แมตช์สร้างเองและแมตช์ในเครื่องแสดงตามปกติ') : ui('Click Fetch matches to show Admin matches. Custom and local matches remain visible.')}</p>}
        <section className="vd-table-panel" aria-label={ui("รายการแมตช์")}><div className="vd-filters">
            <input aria-label={ui("ค้นหาแมตช์")} value={search} placeholder={th ? ui('ค้นหา…') : ui('Search…')} onChange={event => { setSearch(event.target.value); setPage(1); }} />
            <select aria-label={ui("การแข่งขัน")} value={competition} onChange={event => { setCompetition(event.target.value); setPage(1); }}><option value="">{th ? ui('ทุกรายการแข่งขัน') : ui('All competitions')}</option>{competitions.map(([id, label]) => <option key={id} value={id}>{ui(label)}</option>)}{customTitles.map(title => <option key={title} value={`custom:${title}`}>{ui(title)}{' '}{ui("· VIMS")}</option>)}</select>
            <select aria-label={ui("สถานะแข่งขัน")} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{th ? ui('ทุกสถานะแข่งขัน') : ui('All match statuses')}</option>{Object.entries(statuses).map(([value, labels]) => <option key={value} value={value}>{labels[th ? 0 : 1]}</option>)}</select>
            <select aria-label={ui("สถานะการบันทึก VIMS")} value={visStatus} onChange={event => { setVisStatus(event.target.value); setPage(1); }}><option value="">{th ? ui('ทุกสถานะ VIMS') : ui('All VIMS statuses')}</option>{Object.entries(visStatuses).map(([value, labels]) => <option key={value} value={value}>{labels[th ? 0 : 1]}</option>)}</select>
            <select aria-label={ui("ทีม")} value={team} onChange={event => { setTeam(event.target.value); setPage(1); }}><option value="">{th ? ui('ทุกทีม') : ui('All teams')}</option>{teamNames.map(name => <option key={name}>{name}</option>)}</select>
            {(search || competition || status || visStatus || team) && <button className="vd-muted" onClick={reset}>{ui("ล้างตัวกรอง")}</button>}
        </div>
        <div className="vd-results-summary" role="status"><strong>{filtered.length}</strong> {th ? ui('แมตช์') : ui('matches')}</div>
        {loading || !rows.length || matchId ? <div className="vd-empty" role="status">{loading ? th ? ui('กำลังโหลดแมตช์') : ui('Loading matches...') : (error) || (th ? ui('ไม่พบแมตช์') : ui('No matches found'))}</div> : groups.map(group => <VisMatchTable key={group.key} group={group} th={th} sortHeader={sortHeader} sortState={sortState} statuses={statuses} date={date} busy={busy}
            onSettings={m => m.is_custom_vis ? setCreate({ id: m.id }) : openDialog(m, 'settings')}
            onStats={m => openDialog(m, 'stats')} onPDF={pdf} onExport={m => run(() => exportVisMatch(m))} />)}
        <footer className="vd-pagination"><span>{th ? ui('แสดง') : ui('Showing')} {filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)} {th ? ui('จาก') : ui('of')} {filtered.length}</span><div>{pages > 1 && <><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button><span>{currentPage} / {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>›</button></>}<select aria-label={ui("จำนวนต่อหน้า")} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} / {th ? ui('หน้า') : ui('page')}</option>)}</select></div></footer>
        </section></main>
    </div>;
}
