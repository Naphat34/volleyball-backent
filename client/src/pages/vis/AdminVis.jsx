import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { clearAuthSession, getAuthSessionVersion, getStoredUser } from '../../auth/authStorage';
import Swal from 'sweetalert2';
import { useLanguage } from '../../context/LanguageContext';
import { getPublicGenderLabel } from '../../utils/scorer/publicCompetitionGrouping';
import LiveMatchScorer from './LiveMatchScorer';
import VisDashboard from '../../components/vis/VisDashboard';
import { dashboardRefresh } from '../../utils/navigation/dashboardRefresh';
import { getVisMatchGate } from '../../offline/visMatchGate';

const normalizeStatus = status => {
    const value = String(status || 'scheduled').toLowerCase();
    return ['finished', 'match_finished'].includes(value) ? 'completed' : value;
};

export default function AdminVis() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const { language } = useLanguage();
    const th = language === 'THA';
    const user = getStoredUser();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const updatesRef = useRef(null), manualRequested = useRef(false);
    const gate = getVisMatchGate(`${user?.id}:${getAuthSessionVersion()}`);
    const [competition, setCompetition] = useState('');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async (silent = false) => {
            const fromServer = manualRequested.current;
            manualRequested.current = false;
            if (!silent || fromServer) setLoading(true);
            try {
                const response = await api.getVisMatches({ fromServer, includeServerMatches: gate.serverMatchesLoaded, matchId });
                if (!Array.isArray(response.data)) throw new Error('Invalid match list');
                if (!cancelled) {
                    if (fromServer) gate.serverMatchesLoaded = true;
                    setMatches(response.data.map(match => ({ ...match, status: normalizeStatus(match.status) })));
                    setLastUpdated(new Date());
                    setError('');
                    if (fromServer) void Swal.fire({ icon: 'success', title: th ? 'ดึงแมตช์สำเร็จ' : 'Matches loaded',
                        text: th ? `ดึงแมตช์จาก Admin จำนวน ${response.serverMatchCount} แมตช์` : `Loaded ${response.serverMatchCount} Admin matches`,
                        confirmButtonText: th ? 'ตกลง' : 'OK', background: '#131f32', color: '#e3ebf7', confirmButtonColor: '#0284c7' });
                }
            } catch (loadError) {
                if (!cancelled) {
                    const message = loadError.response?.data?.error || loadError.message || (th ? 'โหลดรายการแมตช์ไม่สำเร็จ' : 'Unable to load matches');
                    setError(message);
                    if (fromServer) void Swal.fire({ icon: 'error', title: th ? 'ดึงแมตช์ไม่สำเร็จ' : 'Unable to load matches', text: message,
                        confirmButtonText: th ? 'ตกลง' : 'OK', background: '#131f32', color: '#e3ebf7', confirmButtonColor: '#0284c7' });
                }
            } finally {
                if (!cancelled && (!silent || fromServer)) setLoading(false);
            }
        };
        const updates = dashboardRefresh(load, { enabled: !matchId });
        updatesRef.current = updates;
        void updates.refresh(false);
        return () => { cancelled = true; updates.stop(); manualRequested.current = false; if (updatesRef.current === updates) updatesRef.current = null; };
    }, [matchId, gate, th]);

    const reload = (fromServer = false) => {
        if (!updatesRef.current) return;
        if (fromServer === true) { manualRequested.current = true; setLoading(true); }
        void updatesRef.current.refresh(false);
    };
    const logout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try { await api.logout(); }
        catch { /* Clear the local session even when the server is unavailable. */ }
        finally { clearAuthSession(); navigate('/login', { replace: true }); }
    };
    const competitionLabel = match => [match.competition_name, match.age_group_name || match.category,
        getPublicGenderLabel(match.gender, language)].filter(Boolean).join(' · ');
    const visibleMatches = !matchId && !gate.serverMatchesLoaded ? matches.filter(match => match.is_custom_vis || match.is_offline_vis) : matches;
    const competitions = [...new Map(visibleMatches.filter(match => match.competition_id).map(match => [String(match.competition_id), competitionLabel(match)])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1], th ? 'th' : 'en'));
    const activeMatch = matchId ? matches.find(match => String(match.id) === matchId) : null;

    if (matchId && !loading && !error && activeMatch && activeMatch.status !== 'cancelled' && activeMatch.home_team_id && activeMatch.away_team_id) {
        return <LiveMatchScorer key={activeMatch.id} match={activeMatch} isReadOnly={activeMatch.status === 'completed'}
            onClose={() => navigate('/adminvis')} />;
    }

    return <VisDashboard
        th={th} user={user} matches={visibleMatches} matchId={matchId} loading={loading} error={error}
        competitions={competitions} competitionLabel={competitionLabel}
        competition={competition} setCompetition={setCompetition} status={status} setStatus={setStatus}
        search={search} setSearch={setSearch} reload={reload} logout={logout} loggingOut={loggingOut}
        lastUpdated={lastUpdated} serverMatchesLoaded={gate.serverMatchesLoaded}
    />;
}
