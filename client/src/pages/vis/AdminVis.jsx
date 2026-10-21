import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { clearAuthSession, getStoredUser } from '../../auth/authStorage';
import { useLanguage } from '../../context/LanguageContext';
import { getPublicGenderLabel } from '../../utils/scorer/publicCompetitionGrouping';
import LiveMatchScorer from './LiveMatchScorer';
import VisDashboard from '../../components/vis/VisDashboard';

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
    const [reloadRequest, setReloadRequest] = useState({ fromServer: false });
    const [competition, setCompetition] = useState('');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await api.getVisMatches(reloadRequest);
                if (!Array.isArray(response.data)) throw new Error('Invalid match list');
                if (!cancelled) {
                    setMatches(response.data.map(match => ({ ...match, status: normalizeStatus(match.status) })));
                    setLastUpdated(new Date());
                }
            } catch (loadError) {
                if (!cancelled) setError(loadError.response?.data?.error || loadError.message || (th ? 'โหลดรายการแมตช์ไม่สำเร็จ' : 'Unable to load matches'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [matchId, reloadRequest, th]);

    const reload = (fromServer = false) => setReloadRequest({ fromServer: fromServer === true });
    const logout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try { await api.logout(); }
        catch { /* Clear the local session even when the server is unavailable. */ }
        finally { clearAuthSession(); navigate('/login', { replace: true }); }
    };
    const competitionLabel = match => [match.competition_name, match.age_group_name || match.category,
        getPublicGenderLabel(match.gender, language)].filter(Boolean).join(' · ');
    const competitions = [...new Map(matches.filter(match => match.competition_id).map(match => [String(match.competition_id), competitionLabel(match)])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1], th ? 'th' : 'en'));
    const activeMatch = matchId ? matches.find(match => String(match.id) === matchId) : null;

    if (matchId && !loading && !error && activeMatch && activeMatch.status !== 'cancelled' && activeMatch.home_team_id && activeMatch.away_team_id) {
        return <LiveMatchScorer key={activeMatch.id} match={activeMatch} isReadOnly={activeMatch.status === 'completed'}
            onClose={() => navigate('/adminvis')} />;
    }

    return <VisDashboard
        th={th} user={user} matches={matches} matchId={matchId} loading={loading} error={error}
        competitions={competitions} competitionLabel={competitionLabel}
        competition={competition} setCompetition={setCompetition} status={status} setStatus={setStatus}
        search={search} setSearch={setSearch} reload={reload} logout={logout} loggingOut={loggingOut}
        lastUpdated={lastUpdated}
    />;
}
