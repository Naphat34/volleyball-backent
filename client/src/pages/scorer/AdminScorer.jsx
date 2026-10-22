import AccessStatus from '../../components/auth/AccessStatus';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CloudOff, LogOut } from 'lucide-react';
import { api } from '../../api';
import { clearAuthSession, getAccessSession, getAuthSessionVersion, getStoredUser } from '../../auth/authStorage';
import Swal from 'sweetalert2';
import { getScorerMatchGate } from '../../offline/scorerMatchGate';
import { useLanguage } from '../../context/LanguageContext';
import { getPublicGenderLabel } from '../../utils/scorer/publicCompetitionGrouping';
import { generateScoresheetPDF } from '../../utils/reports/pdfGenerator';
import ScorerOfflineModal from '../../components/scorer/ScorerOfflineModal';
import ScorerCreateMatch from '../../components/scorer/ScorerCreateMatch';
import { dashboardRefresh } from '../../utils/navigation/dashboardRefresh';
import MatchDashboardScore from '../../components/vis/MatchDashboardScore';
import { visStatusLabel } from '../../utils/vis/dashboardStatus';
import '../../components/vis/VisDashboard.css';

const statuses = { scheduled: ['ยังไม่เริ่ม', 'Scheduled'], live: ['กำลังแข่งขัน', 'Live'], completed: ['จบการแข่งขัน', 'Completed'], cancelled: ['ยกเลิก', 'Cancelled'] };
const titleOf = competition => String(competition.competition_title || competition.title || competition.competition_name || '').replace(/\s*\(?(Men|Women|Male|Female|ชาย|หญิง)\)?$/i, '').trim();
const normalizeStatus = value => ['finished','match_finished'].includes(String(value).toLowerCase()) ? 'completed' : String(value || 'scheduled').toLowerCase();

export default function AdminScorer() {
    const { language, setLanguage } = useLanguage(), th = language === 'THA';
    const user = getStoredUser(), role = String(user?.role || '').trim().toLowerCase(), isReferee = role === 'referee';
    const navigate = useNavigate(), [params, setParams] = useSearchParams();
    const competition = params.get('compId') || '';
    const gate = getScorerMatchGate(`${user?.id}:${getAuthSessionVersion()}`);
    const manualRequested = useRef(false);
    const [serverMatches, setMatches] = useState([]), [competitions, setCompetitions] = useState([]);
    const [manualMatches, setManualMatches] = useState([]), [manualReload, setManualReload] = useState(0), [manualError, setManualError] = useState('');
    const [createMatch, setCreateMatch] = useState(null);
    const matches = [...serverMatches, ...manualMatches];
    const [loading, setLoading] = useState(gate.serverMatchesLoaded), [error, setError] = useState(''), [reloadKey, setReloadKey] = useState(() => gate.serverMatchesLoaded ? 1 : 0), [lastUpdated, setLastUpdated] = useState(null);
    const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [team, setTeam] = useState('');
    const [sort, setSort] = useState({ field: 'number', descending: false }), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10);
    const [offlineOpen, setOfflineOpen] = useState(false);
    const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const userId = user?.id;
    useEffect(() => {
        if (isReferee || getAccessSession({ onlineOnly: true }).kind !== 'online') return;
        let active = true;
        const updates = dashboardRefresh(async () => {
            try {
                const { data } = await api.getManualScorerMatches();
                if (active) { setManualMatches(data.map(match => ({ ...match, status: normalizeStatus(match.status) }))); setManualError(''); }
            } catch (error) { if (active) setManualError(error.response?.data?.error || error.message); }
        });
        void updates.refresh(false);
        return () => { active = false; updates.stop(); };
    }, [isReferee, userId, manualReload]);
    useEffect(() => {
        // Start server reads and automatic refresh only after an explicit fetch.
        if (reloadKey === 0) return;
        let active = true;
        const fromServer = manualRequested.current;
        manualRequested.current = false;
        const load = async (silent = false) => {
            if (!silent) setLoading(true);
            let partialError = '';
            try {
                const response = await api.getOpenCompetitions();
                const open = (response.data || []).filter(item => String(item.status || 'OPEN').toUpperCase() === 'OPEN');
                let rows;
                if (isReferee) {
                    // Referees keep the existing public competition read path, without scorer write permissions.
                    const results = await Promise.allSettled(open.map(item => api.getMatchesByCompetition(item.id)));
                    rows = results.flatMap((result,index) => result.status === 'fulfilled' ? result.value.data.map(match => ({ ...match, competition_id: open[index].id, competition_name: titleOf(open[index]) })) : []);
                    if (results.some(result => result.status === 'rejected')) partialError = 'โหลดบางรายการไม่สำเร็จ กรุณาดึงข้อมูลอีกครั้ง';
                } else {
                    rows = (await api.getScorerMatches()).data;
                }
                if (!Array.isArray(rows)) throw Error('รูปแบบรายการแมตช์ไม่ถูกต้อง');
                if (active) {
                    const available = new Set(open.map(item => String(item.id)));
                    setCompetitions(open);
                    const loadedMatches = [...new Map(rows.filter(match => available.has(String(match.competition_id))).map(match => [match.id, { ...match, status: normalizeStatus(match.status) }])).values()];
                    setMatches(loadedMatches);
                    gate.serverMatchesLoaded = true;
                    setLastUpdated(new Date());
                    setError(partialError);
                    if (fromServer && !silent) void Swal.fire({ icon: partialError ? 'warning' : 'success', title: th ? 'ดึงแมตช์สำเร็จ' : 'Matches loaded',
                        text: (th ? `ดึงแมตช์จาก Admin จำนวน ${loadedMatches.length} แมตช์` : `Loaded ${loadedMatches.length} Admin matches`) + (partialError ? ` · ${partialError}` : ''),
                        confirmButtonText: th ? 'ตกลง' : 'OK', background: '#131f32', color: '#e3ebf7', confirmButtonColor: '#0284c7' });
                }
            } catch (error) { if (active) {
                const message = error.response?.data?.error || error.message || 'โหลดแมตช์ไม่สำเร็จ';
                setError(message);
                if (fromServer && !silent) void Swal.fire({ icon: 'error', title: th ? 'ดึงแมตช์ไม่สำเร็จ' : 'Unable to load matches', text: message,
                    confirmButtonText: th ? 'ตกลง' : 'OK', background: '#131f32', color: '#e3ebf7', confirmButtonColor: '#0284c7' });
            } }
            finally { if (active && !silent) setLoading(false); }
        };
        const updates = dashboardRefresh(load);
        void updates.refresh(false); return () => { active = false; updates.stop(); };
    }, [reloadKey, isReferee, gate, th]);
    const reload = (fromServer = false) => {
        if (loading || busy || (!fromServer && reloadKey === 0)) return;
        manualRequested.current = fromServer === true;
        setLoading(true);
        setReloadKey(value => value + 1);
    };
    const competitionOptions = [...new Map(competitions.map(item => [titleOf(item), item])).values()];
    const manualTitles = [...new Set(manualMatches.map(match => match.competition_name))];
    const selectedCompetition = competitions.find(item => String(item.id) === competition);
    const teamNames = [...new Set(matches.flatMap(match => [match.home_team,match.away_team]).filter(Boolean))].sort((a,b) => a.localeCompare(b,'th'));
    const label = match => [match.competition_name,match.age_group_name || match.category,getPublicGenderLabel(match.gender,language)].filter(Boolean).join(' · ');
    const query = search.trim().toLocaleLowerCase();
    const filtered = matches.filter(match => (!competition || (competition.startsWith('manual:') ? match.is_manual_scorer && match.competition_name === competition.slice(7) : selectedCompetition ? titleOf(competitions.find(item => String(item.id) === String(match.competition_id)) || {}) === titleOf(selectedCompetition) : String(match.competition_id) === competition))
        && (!status || match.status === status) && (!team || [match.home_team,match.away_team].includes(team))
        && (!query || [match.home_team,match.away_team,match.match_number,label(match),match.location,match.round_name,match.pool_name].some(value => String(value || '').toLocaleLowerCase().includes(query))))
        .sort((a,b) => {
            const value = match => sort.field === 'number' ? match.match_number || match.id : sort.field === 'date' ? match.match_date || match.raw_start_time || '' : sort.field === 'match' ? `${match.home_team} ${match.away_team}` : sort.field === 'competition' ? label(match) : sort.field === 'score' ? `${match.home_set_score || 0}:${match.away_set_score || 0}` : match.status;
            return String(value(a)).localeCompare(String(value(b)),th ? 'th':'en',{numeric:true}) * (sort.descending ? -1:1);
        });
    const pages = Math.max(1,Math.ceil(filtered.length/pageSize)), currentPage = Math.min(page,pages), rows = filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
    const reset = () => { setParams({}); setSearch(''); setStatus(''); setTeam(''); setPage(1); };
    const date = value => { const parsed = value ? new Date(value) : null; const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value); return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString(th ? 'th-TH':'en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'2-digit',...(!dateOnly ? {hour:'2-digit',minute:'2-digit'}:{})}) : '—'; };
    const heading = (field,text) => <button onClick={() => { setSort(old => ({field,descending:old.field === field ? !old.descending:false})); setPage(1); }}>{text}<span className={sort.field === field ? 'vd-sort-active':''}>{sort.field === field ? sort.descending ? ' ▼':' ▲':' ↕'}</span></button>;
    const run = async action => { setBusy(true); setNotice(''); try { await action(); } catch (error) { setNotice(error.response?.data?.error || error.message); } finally { setBusy(false); } };
    const logout = () => run(async () => { try { await api.logout(); } catch { /* Local logout remains available offline. */ } finally { clearAuthSession(); navigate('/login',{replace:true}); } });
    const manualAction = action => run(async () => { await action(); setManualReload(value => value + 1); });
    const manualLabels = { draft: 'ฉบับร่าง', ready: 'พร้อมแข่งขัน', live: 'กำลังแข่งขัน', review: 'รอตรวจสอบผล', confirmed: 'ยืนยันผลแล้ว' };
    const manualActions = match => <div className="vd-row-actions">
        {['draft','ready'].includes(match.manual_lifecycle) && !match.first_serve_team_id && <button disabled={busy} onClick={() => setCreateMatch({ id: match.id })}>จัดการแมตช์</button>}
        {['ready','live'].includes(match.manual_lifecycle) && <Link className="vd-primary" to={`/scorer/${match.id}`}>บันทึกคะแนน</Link>}
        {match.manual_lifecycle !== 'draft' && <Link to={`/match/${match.id}`}>ตรวจสอบข้อมูล</Link>}
        <details className="vd-row-menu"><summary aria-label={`เมนูแมตช์สร้างเอง ${match.id}`}>⋯</summary><div>
            <button disabled={busy} onClick={() => manualAction(() => api.downloadManualScorerBackup(match.id))}>สำรอง JSON</button>
            <button disabled={busy} onClick={() => run(async () => { const response = await api.getMatchScoresheetData(match.id); await generateScoresheetPDF(response.data); })}>รายงาน PDF</button>
            {match.manual_lifecycle !== 'draft' && <button disabled={busy} onClick={() => manualAction(() => api.publishManualScorerMatch(match.id, !match.manual_published))}>{match.manual_published ? 'หยุดเผยแพร่ Livescore' : 'เผยแพร่ Livescore'}</button>}
            {match.manual_published ? <a href={`/match/${match.id}/viewer`} target="_blank" rel="noreferrer">Livescore ↗</a> : null}
            {match.manual_lifecycle === 'review' && <button disabled={busy} onClick={() => manualAction(async () => {
                const result = await Swal.fire({ icon: 'question', title: 'ยืนยันผลแมตช์นี้?', text: 'กรุณาตรวจสอบรายงาน PDF และคะแนนรายเซตก่อนยืนยัน หลังยืนยันจะล็อกการแก้ไขผล โดยผลนี้ยังแยกจากตารางคะแนนทางการ', showCancelButton: true, confirmButtonText: 'ตรวจสอบแล้ว · ยืนยันผล', cancelButtonText: 'ยกเลิก', background: '#131f32', color: '#e3ebf7' });
                if (result.isConfirmed) await api.confirmManualScorerMatch(match.id);
            })}>ตรวจสอบแล้ว · ยืนยันผล</button>}
        </div></details>
    </div>;
    return <div className="vis-dash">
        {createMatch && <ScorerCreateMatch matchId={createMatch.id} sources={matches} onClose={() => setCreateMatch(null)} onSaved={(id, start) => { setCreateMatch(null); setManualReload(value => value + 1); if (start) navigate(`/scorer/${id}`); }} />}
        <header className="vd-account-bar"><Link to="/adminscorer" className="vd-brand">VOLLEY <span>/ {isReferee ? 'REFEREE':'SCORER'}</span></Link><div className="vd-account">
            <div className="vd-languages" aria-label="ภาษา">{[['THA','ไทย'],['ENG','EN']].map(([value,text]) => <button key={value} aria-pressed={language === value} className={language === value ? 'is-active':''} onClick={() => setLanguage(value)}>{text}</button>)}</div>
            <span>{user?.first_name || user?.username || 'Scorer'} <b className="vd-badge">{isReferee ? 'REFEREE':'SCORER'}</b></span>
            <details className="vd-sync"><summary className={error ? 'vd-error':''}>● {loading ? 'กำลังโหลด':error ? 'โหลดไม่ครบ':!lastUpdated ? 'ยังไม่ได้ดึงแมตช์':'ข้อมูลล่าสุด'}</summary><div><p>ดึงข้อมูลเมื่อ {date(lastUpdated)}</p><p>{matches.length} แมตช์ · {competitionOptions.length} รายการแข่งขัน</p><button disabled={loading || busy} onClick={() => reload(true)}>ดึงข้อมูลอีกครั้ง</button></div></details>
            {['admin','statistician'].includes(user?.role) && <Link to="/adminvis">VIS</Link>}{user?.role === 'admin' && <Link to="/admin">Admin</Link>}<button disabled={busy} onClick={logout} aria-label="ออกจากระบบ"><LogOut size={18} /></button>
        </div></header>
        <main className="vd-main"><AccessStatus /><div className="vd-heading"><h1>{th ? 'การแข่งขัน':'Matches'} · {isReferee ? 'Referee':'ScorerControl'}</h1><div className="vd-actions">
            <div className="vd-split"><button disabled={loading || busy} onClick={() => reload(true)}>⇩ {th ? 'ดึงแมตช์จากเซิร์ฟเวอร์':'Fetch matches'}</button><details><summary aria-label="ตัวเลือกดึงข้อมูล">▾</summary><div><button disabled={loading || busy} onClick={() => { reset(); reload(true); }}>ดึงทั้งหมดและล้างตัวกรอง</button></div></details></div>
            {!isReferee && <button type="button" className={`vd-offline-toggle ${offlineOpen ? 'is-active':''}`} aria-label="ScorerControl Offline" title="ScorerControl Offline · ข้อมูลในเครื่อง" aria-haspopup="dialog" aria-expanded={offlineOpen} aria-controls={offlineOpen ? 'scorer-dashboard-offline' : undefined} onClick={() => setOfflineOpen(true)}><CloudOff size={21} aria-hidden="true" /> {th ? 'เตรียมแมตช์ Offline' : 'Prepare offline matches'}</button>}
            {!isReferee && <button className="vd-primary" disabled={busy || !navigator.onLine} onClick={() => setCreateMatch({})}>+ {th ? 'สร้างแมตช์เอง' : 'New match'}</button>}
        </div></div>
        {!isReferee && offlineOpen && <ScorerOfflineModal onClose={() => setOfflineOpen(false)} />}
        {(notice || error || manualError) && <div className="vd-notice" role="status"><span>{notice || error || manualError}</span>{notice && <button onClick={() => setNotice('')} aria-label="ปิดข้อความ">✕</button>}</div>}
        {(reloadKey > 0 || manualMatches.length > 0) && <section className="vd-table-panel" aria-label="รายการแมตช์ Scorer"><div className="vd-filters">
            <input value={search} aria-label="ค้นหาแมตช์" placeholder={th ? 'ค้นหา…':'Search…'} onChange={event => { setSearch(event.target.value); setPage(1); }} />
            <select value={competition} aria-label="รายการแข่งขัน" onChange={event => { setParams(event.target.value ? {view:'matches',compId:event.target.value}:{}); setPage(1); }}><option value="">{th ? 'ทุกรายการแข่งขัน':'All competitions'}</option>{competitionOptions.map(item => <option key={item.id} value={item.id}>{titleOf(item)}</option>)}{selectedCompetition && !competitionOptions.some(item => String(item.id) === competition) && <option value={competition}>{titleOf(selectedCompetition)}</option>}{manualTitles.map(title => <option key={title} value={`manual:${title}`}>{title} · สร้างเอง</option>)}</select>
            <select value={status} aria-label="สถานะแมตช์" onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{th ? 'ทุกสถานะ':'All statuses'}</option>{Object.entries(statuses).map(([value,text]) => <option key={value} value={value}>{text[th?0:1]}</option>)}</select>
            <select value={team} aria-label="ทีม" onChange={event => { setTeam(event.target.value); setPage(1); }}><option value="">{th ? 'ทุกทีม':'All teams'}</option>{teamNames.map(name => <option key={name}>{name}</option>)}</select>
            {(search || competition || status || team) && <button className="vd-muted" onClick={reset}>ล้างตัวกรอง</button>}
        </div><div className="vd-table-scroll"><table className="vd-table"><thead><tr><th>{heading('date',th?'วันที่':'Date')}</th><th>{heading('number',th?'แมตช์':'Match')}</th><th>{heading('competition',th?'รายการ / สนาม':'Competition / venue')}</th><th>{heading('score',th?'ผล':'Result')}</th><th>{heading('status',th?'สถานะ':'Status')}</th><th aria-label="การจัดการ" /></tr></thead><tbody>
            {loading || !rows.length ? <tr><td colSpan={6} className="vd-empty" role="status">{loading ? 'กำลังโหลดแมตช์…':error || 'ไม่พบแมตช์ตามเงื่อนไข'}</td></tr> : rows.map(match => <tr key={match.id}>
                <td className="vd-date">{date(match.match_date || match.raw_start_time)}</td><td className="vd-match"><strong><span>{match.home_team || 'TBA'}</span> <i>vs</i> <span>{match.away_team || 'TBA'}</span></strong><small>#{match.match_number || match.id}</small><small>{[match.round_name,match.pool_name].filter(Boolean).join(' · ') || 'ตารางแข่งขันจาก Admin'}</small></td>
                <td className="vd-competition"><span>{label(match)}</span><small>{match.location || '—'}</small></td><td className="vd-score"><MatchDashboardScore match={match} th={th} source="official" /></td><td><div className="vd-badges">{match.is_manual_scorer ? <><span className={`vd-badge vd-${match.status}`}>{manualLabels[match.manual_lifecycle]}</span><span className="vd-badge">สร้างเอง · {match.manual_published ? 'เผยแพร่' : 'ส่วนตัว'}</span></> : <><span className={`vd-badge vd-${match.status}`}>{th ? 'ทางการ' : 'Official'} · {statuses[match.status]?.[th?0:1] || match.status}</span>{match.vis_summary?.hasActivity && <span className="vd-badge">VIS · {visStatusLabel(match, th)}</span>}<span className="vd-badge">เซิร์ฟเวอร์</span></>}</div></td>
                <td>{match.is_manual_scorer ? manualActions(match) : <div className="vd-row-actions">{!isReferee && !['cancelled','completed'].includes(match.status) && match.home_team_id && match.away_team_id && <Link to={`/scorer/${match.id}`} className="vd-primary">{th?'บันทึกคะแนน':'Score'}</Link>}<Link to={`/match/${match.id}`}>{th?'ข้อมูลแมตช์':'Match details'}</Link><details className="vd-row-menu"><summary aria-label={`เมนูแมตช์ ${match.match_number || match.id}`}>⋯</summary><div><a href={`/match/${match.id}/viewer`} target="_blank" rel="noreferrer">Livescore ↗</a><button disabled={busy} onClick={() => run(async () => { const response = await api.getMatchScoresheetData(match.id); await generateScoresheetPDF(response.data); })}>รายงาน PDF</button><a href={`/match/${match.id}`} target="_blank" rel="noreferrer">เปิดข้อมูลแท็บใหม่ ↗</a></div></details></div>}</td>
            </tr>)}
        </tbody></table></div><footer className="vd-pagination"><span>{th?'แสดง':'Showing'} {filtered.length ? (currentPage-1)*pageSize+1:0}–{Math.min(currentPage*pageSize,filtered.length)} {th?'จาก':'of'} {filtered.length}</span><div>{pages>1 && <><button disabled={currentPage===1} onClick={() => setPage(currentPage-1)}>‹</button><span>{currentPage} / {pages}</span><button disabled={currentPage===pages} onClick={() => setPage(currentPage+1)}>›</button></>}<select aria-label="จำนวนต่อหน้า" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10,25,50].map(size => <option key={size} value={size}>{size} / {th?'หน้า':'page'}</option>)}</select></div></footer></section>}
        </main>
    </div>;
}
