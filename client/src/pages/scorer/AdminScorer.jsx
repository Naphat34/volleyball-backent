import ScorerActionDropdown from '../../components/scorer/ScorerActionDropdown';
import { readDashboardCache, writeDashboardCache, mergeRefereeMatches, readDashboardPreferences, writeDashboardPreferences } from '../../offline/scorerDashboardCache';
import ScorerMatchModal from '../../components/scorer/ScorerMatchModal';
import VisThemeToggle from '../../components/vis/VisThemeToggle';
import AccessStatus from '../../components/auth/AccessStatus';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CloudOff, LogOut } from 'lucide-react';
import { api } from '../../api';
import { clearAuthSession, getAccessSession, getAuthSessionVersion, getStoredUser } from '../../auth/authStorage';
import Swal from 'sweetalert2';
import { getScorerMatchGate } from '../../offline/scorerMatchGate';
import { useLanguage } from '../../context/LanguageContext';
import { getPublicGenderLabel } from '../../utils/scorer/publicCompetitionGrouping';
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
    const gate = getScorerMatchGate(`${user?.id}:${role}:${getAuthSessionVersion()}`);
    const manualRequested = useRef(false);
    const [serverMatches, setMatches] = useState([]), [competitions, setCompetitions] = useState([]);
    const [manualMatches, setManualMatches] = useState([]), [manualReload, setManualReload] = useState(0), [manualError, setManualError] = useState('');
    const [createMatch, setCreateMatch] = useState(null);
    const [matchPanel, setMatchPanel] = useState(null);
    const scope = String(user?.id) + ':' + role;
    const [hydratedScope, setHydratedScope] = useState(null), [preferencesScope, setPreferencesScope] = useState(null);
    const [cacheNotice, setCacheNotice] = useState(''), [restored, setRestored] = useState(false);
    const cacheReady = hydratedScope === scope;
    const serverRows = useRef([]);
    const matches = cacheReady ? [...serverMatches, ...manualMatches] : [];
    const [loading, setLoading] = useState(false), [error, setError] = useState(''), [reloadKey, setReloadKey] = useState(0), [lastUpdated, setLastUpdated] = useState(null);
    const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [team, setTeam] = useState('');
    const [sort, setSort] = useState({ field: 'number', descending: false }), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10);
    const [offlineOpen, setOfflineOpen] = useState(false);
    const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const userId = user?.id, sessionVersion = getAuthSessionVersion();
    const sameSession = useCallback(() => {
        const currentUser = getStoredUser();
        return String(currentUser?.id) === String(userId) && String(currentUser?.role || '').trim().toLowerCase() === role && getAuthSessionVersion() === sessionVersion;
    }, [userId, role, sessionVersion]);
    useEffect(() => {
        let active = true;
        setMatches([]); setCompetitions([]); setManualMatches([]); setLoading(false); setError(''); setManualError(''); setCacheNotice(''); setRestored(false);
        const preferences = readDashboardPreferences(userId, role);
        setSearch(preferences.search); setStatus(preferences.status); setTeam(preferences.team);
        setSort(preferences.sort); setPage(preferences.page); setPageSize(preferences.pageSize); setPreferencesScope(scope);
        Promise.allSettled([readDashboardCache(userId, role, 'server'), isReferee ? Promise.resolve(null) : readDashboardCache(userId, role, 'manual')]).then(results => {
            if (!active || !sameSession()) return;
            const server = results[0].status === 'fulfilled' ? results[0].value : null;
            const manual = results[1].status === 'fulfilled' ? results[1].value : null;
            serverRows.current = server?.matches || [];
            setMatches(server?.matches || []); setCompetitions(server?.competitions || []); setManualMatches(manual?.matches || []);
            setLastUpdated(server ? new Date(server.updatedAt) : null);
            setRestored(Boolean(server || manual));
            if (server?.partialCompetitionIds?.length) setCacheNotice('partial');
            if (results.some(result => result.status === 'rejected')) setCacheNotice('storage');
            if (server) gate.serverMatchesLoaded = true;
            setReloadKey(server || gate.serverMatchesLoaded ? 1 : 0);
            setHydratedScope(scope);
        });
        return () => { active = false; };
    }, [userId, role, scope, isReferee, gate, sameSession]);
    useEffect(() => {
        if (preferencesScope !== scope) return;
        writeDashboardPreferences(userId, role, { search, status, team, sort, page, pageSize });
    }, [preferencesScope, scope, userId, role, search, status, team, sort, page, pageSize]);
    useEffect(() => {
        if (!cacheReady || isReferee) return;
        let active = true;
        const updates = dashboardRefresh(async () => {
            if (!navigator.onLine || getAccessSession().kind !== 'online' || !sameSession()) return;
            try {
                const { data } = await api.getManualScorerMatches();
                if (!Array.isArray(data)) throw Error('Invalid manual match list');
                if (!active || !sameSession()) return;
                const loaded = data.map(match => ({ ...match, status: normalizeStatus(match.status) }));
                setManualMatches(loaded); setManualError('');
                try { await writeDashboardCache(userId, role, 'manual', { matches: loaded, competitions: [] }); }
                catch { if (active && sameSession()) setCacheNotice('storage'); }
            } catch (failure) { if (active && sameSession()) setManualError(failure.response?.data?.error || failure.message); }
        });
        void updates.refresh(false);
        return () => { active = false; updates.stop(); };
    }, [cacheReady, isReferee, userId, role, manualReload, sameSession]);
    useEffect(() => {
        // A saved snapshot also authorizes background refresh; a new account still needs an explicit fetch.
        if (!cacheReady || reloadKey === 0) return;
        let active = true;
        const fromServer = manualRequested.current;
        manualRequested.current = false;
        const load = async (silent = false) => {
            if (!navigator.onLine || getAccessSession().kind !== 'online' || !sameSession()) { if (active) setLoading(false); return; }
            if (!silent) setLoading(true);
            try {
                const response = await api.getOpenCompetitions();
                if (!Array.isArray(response.data)) throw Error('Invalid competition list');
                const open = response.data.filter(item => String(item.status || 'OPEN').toUpperCase() === 'OPEN');
                let rows, partialCompetitionIds = [];
                if (isReferee) {
                    const results = await Promise.allSettled(open.map(item => api.getMatchesByCompetition(item.id)));
                    const merged = mergeRefereeMatches(open, results, serverRows.current, titleOf);
                    rows = merged.matches; partialCompetitionIds = merged.partialCompetitionIds;
                } else rows = (await api.getScorerMatches()).data;
                if (!Array.isArray(rows)) throw Error('Invalid match list');
                if (!active || !sameSession()) return;
                const available = new Set(open.map(item => String(item.id)));
                const loaded = [...new Map(rows.filter(match => available.has(String(match.competition_id))).map(match => [match.id, { ...match, status: normalizeStatus(match.status) }])).values()];
                const updatedAt = new Date().toISOString();
                const partialError = partialCompetitionIds.length ? (th ? 'อัปเดตได้บางรายการ เก็บข้อมูลเดิมของรายการที่โหลดไม่สำเร็จไว้แล้ว' : 'Partial update. Previous rows were kept for failed competitions.') : '';
                serverRows.current = loaded; setCompetitions(open); setMatches(loaded);
                gate.serverMatchesLoaded = true; setLastUpdated(new Date(updatedAt)); setRestored(false); setError(partialError);
                setCacheNotice(partialCompetitionIds.length ? 'partial' : '');
                try { await writeDashboardCache(userId, role, 'server', { matches: loaded, competitions: open, updatedAt, partialCompetitionIds }); }
                catch { if (active && sameSession()) setCacheNotice('storage'); }
                if (!active || !sameSession()) return;
                if (fromServer && !silent) void Swal.fire({ icon: partialError ? 'warning' : 'success', title: th ? 'ดึงแมตช์สำเร็จ' : 'Matches loaded',
                    text: (th ? `ดึงแมตช์จาก Server จำนวน ${loaded.length} แมตช์` : `Loaded ${loaded.length} Server matches`) + (partialError ? ` · ${partialError}` : ''),
                    confirmButtonText: th ? 'ตกลง' : 'OK', background: '#131f32', color: '#e3ebf7', confirmButtonColor: '#0284c7' });
            } catch (failure) {
                if (!active || !sameSession()) return;
                const message = failure.response?.data?.error || failure.message || 'Unable to load matches';
                setError(message); setRestored(true);
                if (fromServer && !silent) void Swal.fire({ icon: 'error', title: th ? 'ดึงแมตช์ไม่สำเร็จ' : 'Unable to load matches', text: message,
                    confirmButtonText: th ? 'ตกลง' : 'OK', background: '#131f32', color: '#e3ebf7', confirmButtonColor: '#0284c7' });
            } finally { if (active && sameSession() && !silent) setLoading(false); }
        };
        const updates = dashboardRefresh(load);
        void updates.refresh(false); return () => { active = false; updates.stop(); };
    }, [cacheReady, reloadKey, isReferee, gate, th, userId, role, sameSession]);

    const reload = (fromServer = false) => {
        if (!cacheReady || !navigator.onLine || loading || busy || (!fromServer && reloadKey === 0)) return;
        manualRequested.current = fromServer === true;
        setLoading(true);
        setReloadKey(value => value + 1);
    };
    const competitionOptions = [...new Map(competitions.map(item => [titleOf(item), item])).values()];
    const manualTitles = [...new Set(manualMatches.map(match => match.competition_name))];
    const selectedCompetition = competitions.find(item => String(item.id) === competition);
    const navbarCompetition = competition.startsWith('manual:') ? competition.slice(7)
        : selectedCompetition ? titleOf(selectedCompetition)
        : competition ? titleOf(matches.find(match => String(match.competition_id) === competition) || {})
        : th ? 'ทุกรายการแข่งขัน' : 'All competitions';
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
    const reportButtons = match => <div className="vd-scorer-reports">
        <a href={`/scoresheet/${encodeURIComponent(match.id)}`} target="_blank" rel="noreferrer">Scorer Sheet</a>
        <a href={`/roster-verification/${encodeURIComponent(match.id)}`} target="_blank" rel="noreferrer">Roster</a>
    </div>;
    const manualActions = match => <div className="vd-row-actions">
        {['draft','ready'].includes(match.manual_lifecycle) && !match.first_serve_team_id && <button disabled={busy} onClick={() => setCreateMatch({ id: match.id })}>จัดการแมตช์</button>}
        {['ready','live'].includes(match.manual_lifecycle) && <Link className="vd-primary" to={`/scorer/${match.id}`}>บันทึกคะแนน</Link>}
        {match.manual_lifecycle !== 'draft' && <button type="button" onClick={() => setMatchPanel({ match, mode: match.is_manual_scorer ? 'review' : 'details' })}>ตั้งค่าแมตซ์</button>}
        <ScorerActionDropdown label={`เมนูแมตช์สร้างเอง ${match.id}`}>
            <button disabled={busy} onClick={() => manualAction(() => api.downloadManualScorerBackup(match.id))}>สำรอง JSON</button>
            <a href={`/scoresheet/${encodeURIComponent(match.id)}`} target="_blank" rel="noreferrer">Preview Scorer Sheet</a>
            {match.manual_lifecycle !== 'draft' && <button disabled={busy} onClick={() => manualAction(() => api.publishManualScorerMatch(match.id, !match.manual_published))}>{match.manual_published ? 'หยุดเผยแพร่ Livescore' : 'เผยแพร่ Livescore'}</button>}
            {match.manual_published ? <a href={`/match/${match.id}/viewer`} target="_blank" rel="noreferrer">Livescore ↗</a> : null}
            {match.manual_lifecycle === 'review' && <button disabled={busy} onClick={() => setMatchPanel({match, mode:'review'})}>ตรวจสอบแล้ว · ยืนยันผล</button>}
        </ScorerActionDropdown>
        {reportButtons(match)}
    </div>;
    return <div className="vis-dash">
        {matchPanel && <ScorerMatchModal key={`${matchPanel.match.id}:${matchPanel.mode}`} source={matchPanel.match} canConfirm={!isReferee && matchPanel.match.is_manual_scorer && (role === 'admin' || String(matchPanel.match.manual_owner_id) === String(userId))} onClose={() => setMatchPanel(null)} onConfirmed={() => { setManualReload(value => value + 1); setReloadKey(value => value ? value + 1 : value); }} />}
        {createMatch && <ScorerCreateMatch matchId={createMatch.id} sources={matches} onClose={() => setCreateMatch(null)} onSaved={(id, start) => { setCreateMatch(null); setManualReload(value => value + 1); if (start) navigate(`/scorer/${id}`); }} />}
        <header className="vd-account-bar"><Link to="/adminscorer" className="vd-brand">VOLLEY <span>/ {isReferee ? 'REFEREE':'SCORER'}</span>{navbarCompetition && <> / {navbarCompetition}</>}</Link><div className="vd-account">
            <VisThemeToggle iconOnly />
            <div className="vd-languages" aria-label="ภาษา">{[['THA','ไทย'],['ENG','EN']].map(([value,text]) => <button key={value} aria-pressed={language === value} className={language === value ? 'is-active':''} onClick={() => setLanguage(value)}>{text}</button>)}</div>
            <span>{user?.first_name || user?.username || 'Scorer'} <b className="vd-badge">{isReferee ? 'REFEREE':'SCORER'}</b></span>
            <details className="vd-sync"><summary className={error ? 'vd-error':''}>● {loading ? 'กำลังโหลด':error ? 'โหลดไม่ครบ':!lastUpdated ? 'ยังไม่ได้ดึงแมตช์':'ข้อมูลล่าสุด'}</summary><div><p>ดึงข้อมูลเมื่อ {date(lastUpdated)}</p><p>{matches.length} แมตช์ · {competitionOptions.length} รายการแข่งขัน</p><button disabled={loading || busy} onClick={() => reload(true)}>ดึงข้อมูลอีกครั้ง</button></div></details>
            {['admin','statistician'].includes(user?.role) && <Link to="/adminvis">VIMS</Link>}{user?.role === 'admin' && <Link to="/admin">Admin</Link>}<button disabled={busy} onClick={logout} aria-label="ออกจากระบบ"><LogOut size={18} /></button>
        </div></header>
        <main className="vd-main"><AccessStatus /><div className="vd-heading"><h1>{th ? 'การแข่งขัน':'Matches'} · {isReferee ? 'Referee':'ScorerControl'}</h1><div className="vd-actions">
            <div className="vd-split"><button disabled={loading || busy} onClick={() => reload(true)}>⇩ {th ? 'ดึงแมตช์จากเซิร์ฟเวอร์':'Fetch matches'}</button><details><summary aria-label="ตัวเลือกดึงข้อมูล">▾</summary><div><button disabled={loading || busy} onClick={() => { reset(); reload(true); }}>ดึงทั้งหมดและล้างตัวกรอง</button></div></details></div>
            {!isReferee && <button type="button" className={`vd-offline-toggle ${offlineOpen ? 'is-active':''}`} aria-label="ScorerControl Offline" title="ScorerControl Offline · ข้อมูลในเครื่อง" aria-haspopup="dialog" aria-expanded={offlineOpen} aria-controls={offlineOpen ? 'scorer-dashboard-offline' : undefined} onClick={() => setOfflineOpen(true)}><CloudOff size={21} aria-hidden="true" /> {th ? 'เตรียมแมตช์ Offline' : 'Prepare offline matches'}</button>}
            {!isReferee && <button className="vd-primary" disabled={busy || !navigator.onLine} onClick={() => setCreateMatch({})}>+ {th ? 'สร้างแมตช์เอง' : 'New match'}</button>}
        </div></div>
        {!isReferee && offlineOpen && <ScorerOfflineModal onClose={() => setOfflineOpen(false)} />}
        {!cacheReady && <p className="vd-notice" role="status">{th ? 'กำลังอ่านรายการในเครื่อง…' : 'Reading saved matches…'}</p>}
        {cacheReady && (restored || cacheNotice) && <p className="vd-notice" role="status">{cacheNotice === 'storage' ? (th ? 'เก็บหรืออ่านข้อมูลในเครื่องไม่สำเร็จ กรุณาอนุญาตการจัดเก็บข้อมูลของเว็บไซต์' : 'Local storage is unavailable. Matches remain visible, but may need fetching after reload.') : cacheNotice === 'partial' ? (th ? 'ข้อมูลบางรายการยังเป็นสำเนาเดิม กรุณาลองอัปเดตอีกครั้ง' : 'Some competitions still show previous data. Retry the update.') : (th ? 'แสดงรายการที่เก็บในเครื่อง ระบบจะตรวจอัปเดตเมื่อออนไลน์' : 'Showing saved matches. Updates will be checked when online.')}</p>}
        {(notice || error || manualError) && <div className="vd-notice" role="status"><span>{notice || error || manualError}</span>{notice && <button onClick={() => setNotice('')} aria-label="ปิดข้อความ">✕</button>}</div>}
        {cacheReady && (reloadKey > 0 || manualMatches.length > 0) && <section className="vd-table-panel" aria-label="รายการแมตช์ Scorer"><div className="vd-filters">
            <input value={search} aria-label="ค้นหาแมตช์" placeholder={th ? 'ค้นหา…':'Search…'} onChange={event => { setSearch(event.target.value); setPage(1); }} />
            <select value={competition} aria-label="รายการแข่งขัน" onChange={event => { setParams(event.target.value ? {view:'matches',compId:event.target.value}:{}); setPage(1); }}><option value="">{th ? 'ทุกรายการแข่งขัน':'All competitions'}</option>{competitionOptions.map(item => <option key={item.id} value={item.id}>{titleOf(item)}</option>)}{selectedCompetition && !competitionOptions.some(item => String(item.id) === competition) && <option value={competition}>{titleOf(selectedCompetition)}</option>}{manualTitles.map(title => <option key={title} value={`manual:${title}`}>{title} · สร้างเอง</option>)}</select>
            <select value={status} aria-label="สถานะแมตช์" onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{th ? 'ทุกสถานะ':'All statuses'}</option>{Object.entries(statuses).map(([value,text]) => <option key={value} value={value}>{text[th?0:1]}</option>)}</select>
            <select value={team} aria-label="ทีม" onChange={event => { setTeam(event.target.value); setPage(1); }}><option value="">{th ? 'ทุกทีม':'All teams'}</option>{teamNames.map(name => <option key={name}>{name}</option>)}</select>
            {(search || competition || status || team) && <button className="vd-muted" onClick={reset}>ล้างตัวกรอง</button>}
        </div><div className="vd-table-scroll"><table className="vd-table"><thead><tr><th>{heading('date',th?'วันที่':'Date')}</th><th>{heading('number',th?'แมตช์':'Match')}</th><th>{heading('competition',th?'รายการ / สนาม':'Competition / venue')}</th><th>{heading('score',th?'ผล':'Result')}</th><th>{heading('status',th?'สถานะ':'Status')}</th><th aria-label="การจัดการ" /></tr></thead><tbody>
            {!rows.length ? <tr><td colSpan={6} className="vd-empty" role="status">{loading ? 'กำลังโหลดแมตช์…':error || 'ไม่พบแมตช์ตามเงื่อนไข'}</td></tr> : rows.map(match => <tr key={match.id}>
                <td className="vd-date">{date(match.match_date || match.raw_start_time)}</td><td className="vd-match"><strong><span>{match.home_team || 'TBA'}</span> <i>vs</i> <span>{match.away_team || 'TBA'}</span></strong><small>#{match.match_number || match.id}</small><small>{[match.round_name,match.pool_name].filter(Boolean).join(' · ') || 'ตารางแข่งขันจาก Admin'}</small></td>
                <td className="vd-competition"><span>{label(match)}</span><small>{match.location || '—'}</small></td><td className="vd-score"><MatchDashboardScore match={match} th={th} source="official" /></td><td><div className="vd-badges">{match.is_manual_scorer ? <><span className={`vd-badge vd-${match.status}`}>{manualLabels[match.manual_lifecycle]}</span><span className="vd-badge">สร้างเอง · {match.manual_published ? 'เผยแพร่' : 'ส่วนตัว'}</span></> : <><span className={`vd-badge vd-${match.status}`}>{th ? 'ทางการ' : 'Official'} · {statuses[match.status]?.[th?0:1] || match.status}</span>{match.vis_summary?.hasActivity && <span className="vd-badge">VIS · {visStatusLabel(match, th)}</span>}<span className="vd-badge">เซิร์ฟเวอร์</span></>}</div></td>
                <td>{match.is_manual_scorer ? manualActions(match) : <div className="vd-row-actions">{!isReferee && !['cancelled','completed'].includes(match.status) && match.home_team_id && match.away_team_id && <Link to={`/scorer/${match.id}`} className="vd-primary">{th?'บันทึกคะแนน':'Score'}</Link>}<button type="button" onClick={() => setMatchPanel({ match, mode: match.is_manual_scorer ? 'review' : 'details' })}>{th?'ตั้งค่าแมตซ์':'Match settings'}</button><ScorerActionDropdown label={`เมนูแมตช์ ${match.match_number || match.id}`}><a href={`/match/${match.id}/viewer`} target="_blank" rel="noreferrer">Livescore ↗</a><a href={`/scoresheet/${encodeURIComponent(match.id)}`} target="_blank" rel="noreferrer">Preview Scorer Sheet</a><a href={`/match/${match.id}`} target="_blank" rel="noreferrer">เปิดข้อมูลแท็บใหม่ ↗</a></ScorerActionDropdown>{reportButtons(match)}</div>}</td>
            </tr>)}
        </tbody></table></div><footer className="vd-pagination"><span>{th?'แสดง':'Showing'} {filtered.length ? (currentPage-1)*pageSize+1:0}–{Math.min(currentPage*pageSize,filtered.length)} {th?'จาก':'of'} {filtered.length}</span><div>{pages>1 && <><button disabled={currentPage===1} onClick={() => setPage(currentPage-1)}>‹</button><span>{currentPage} / {pages}</span><button disabled={currentPage===pages} onClick={() => setPage(currentPage+1)}>›</button></>}<select aria-label="จำนวนต่อหน้า" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10,25,50].map(size => <option key={size} value={size}>{size} / {th?'หน้า':'page'}</option>)}</select></div></footer></section>}
        </main>
    </div>;
}
