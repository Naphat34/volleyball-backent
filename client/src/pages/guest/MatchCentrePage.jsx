import { io } from 'socket.io-client';
import { Feedback, Panel, StatusBadge } from '../../components/ui/SystemUI';
import PublicHeader from '../../components/PublicHeader';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, ArrowLeft, LayoutGrid, Users } from 'lucide-react';
import { api, getSocketServerUrl } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

export default function MatchCentrePage() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const { language, t } = useLanguage();
    const [match, setMatch] = useState(null);
    const [teamPlayers, setTeamPlayers] = useState({ home: [], away: [] });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [liveState, setLiveState] = useState(null);
    const [events, setEvents] = useState([]);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);


    useEffect(() => {
        let cancelled = false;
        let refreshing = false;
        const applyState = state => {
            if (cancelled || !state || typeof state !== 'object') return;
            setLiveState(previous => Number(previous?.updatedAt || 0) > Number(state.updatedAt || 0) ? previous : state);
            setLastUpdated(new Date());
        };
        const refresh = async (initial = false) => {
            if (refreshing) return;
            refreshing = true;
            if (initial) { setLoading(true); setMatch(null); setLiveState(null); setEvents([]); setTeamPlayers({ home: [], away: [] }); }
            try {
                const [res, state, eventRes] = await Promise.all([api.getPublicMatches(), api.getLiveState(matchId), api.getMatchEvents(matchId)]);
                if (cancelled) return;
                const found = res.data.find(item => String(item.id) === String(matchId));
                setMatch(found || null);
                applyState(state.data);
                setEvents((eventRes.data || []).slice().sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 20));
                setLoadError(false);
                if (initial && found) {
                    const [home, away] = await Promise.all([
                        found.home_team_id ? api.getPlayersByTeam(found.home_team_id, found.competition_id) : Promise.resolve({ data: [] }),
                        found.away_team_id ? api.getPlayersByTeam(found.away_team_id, found.competition_id) : Promise.resolve({ data: [] })
                    ]);
                    if (!cancelled) setTeamPlayers({ home: home.data || [], away: away.data || [] });
                }
            } catch (error) {
                console.error('Unable to refresh match centre:', error);
                if (!cancelled) setLoadError(true);
            } finally {
                refreshing = false;
                if (!cancelled) setLoading(false);
            }
        };
        refresh(true);
        const interval = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
        const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', onVisibility);
        const socket = io(getSocketServerUrl(), { withCredentials: true });
        socket.on('connect', () => { setRealtimeConnected(true); socket.emit('join_match', { matchId, role: 'viewer' }); refresh(); });
        socket.on('disconnect', () => setRealtimeConnected(false));
        socket.on('connect_error', () => setRealtimeConnected(false));
        socket.on('live_state_updated', applyState);
        socket.on('match_updated', () => refresh());
        socket.on('match_event', event => {
            if (!cancelled) setEvents(previous => [event, ...previous.filter(item => item.id !== event.id)].slice(0, 20));
        });
        return () => { cancelled = true; window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); socket.disconnect(); };
    }, [matchId, reloadKey]);

    if (loading) {
        return (
            <div className="app-page min-h-screen text-gray-800 font-sans flex justify-center items-center">
                <p className="text-gray-500 font-medium">{t('landing.loading')}</p>
            </div>
        );
    }

    if (!match && loadError) return <div className="app-page min-h-screen"><PublicHeader /><main id="main-content" className="mx-auto max-w-2xl px-4 py-12"><Feedback error title={language === 'THA' ? 'โหลดข้อมูลการแข่งขันไม่สำเร็จ' : 'Unable to load this match'} onRetry={() => setReloadKey(key => key + 1)} /></main></div>;

    if (!match) {
        return (
            <div className="app-page min-h-screen text-gray-800 font-sans flex flex-col justify-center items-center">
                <p className="text-gray-500 font-medium mb-4">{language === 'THA' ? 'ไม่พบข้อมูลการแข่งขัน' : 'Match not found'}</p>
                <button onClick={() => navigate('/matches')} className="px-4 py-2 bg-[#14366A] text-white rounded-xl cursor-pointer">
                    {language === 'THA' ? 'กลับไปหน้าตารางการแข่งขัน' : 'Back to Match Schedule'}
                </button>
            </div>
        );
    }

    const TeamLogo = ({ name, logoUrl, size = "md" }) => {
        const sizeClasses = size === "lg" ? "w-16 h-16 text-lg" : size === "sm" ? "w-6 h-6 text-[8px]" : "w-10 h-10 text-xs";

        if (logoUrl) {
            return (
                <div className={`${sizeClasses} rounded-full bg-white border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden shadow-sm`}>
                    <img src={logoUrl} alt={name || "Team"} className="w-full h-full object-cover" />
                </div>
            );
        }
        const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "??";
        return (
            <div className={`${sizeClasses} rounded-full bg-white border border-gray-200 shrink-0 flex items-center justify-center font-bold text-gray-500 shadow-sm`}>
                {initials}
            </div>
        );
    };

    const normalizeStatus = (status) => String(status || '').toLowerCase();
    const isCompleted = ['completed', 'finished', 'match_finished'].includes(normalizeStatus(match.status));
    const isLive = ['live', 'set_playing', 'in_progress'].includes(normalizeStatus(match.status));
    const toNumber = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };
    const normalizeSetScores = (scores) => {
        const rawScores = Array.isArray(scores) ? scores : [];
        return rawScores.map((score, index) => {
            if (!score) return null;
            if (typeof score === 'string') {
                const [teamA, teamB] = score.split('-').map((value) => toNumber(value, null));
                return {
                    set_number: index + 1,
                    team_a: teamA,
                    team_b: teamB
                };
            }

            return {
                set_number: toNumber(score.set_number ?? score.set ?? score.no, index + 1),
                team_a: toNumber(score.team_a ?? score.home ?? score.home_score ?? score.score_home, null),
                team_b: toNumber(score.team_b ?? score.away ?? score.away_score ?? score.score_away, null)
            };
        }).filter((score) => score && score.team_a !== null && score.team_b !== null);
    };

    // Calculate Sets
    const setScores = normalizeSetScores(match.set_scores);
    const maxSets = Math.max(toNumber(match.max_sets, 3), setScores.length, 3);
    const setColumns = Array.from({ length: maxSets }, (_, i) => i + 1);

    const totalA = setScores.reduce((sum, s) => sum + (s.team_a || 0), 0);
    const totalB = setScores.reduce((sum, s) => sum + (s.team_b || 0), 0);
    const teamASets = toNumber(isCompleted ? (match.team_a_score ?? match.home_set_score) : (liveState?.setsWon?.home ?? match.team_a_score ?? match.home_set_score), 0);
    const teamBSets = toNumber(isCompleted ? (match.team_b_score ?? match.away_set_score) : (liveState?.setsWon?.away ?? match.team_b_score ?? match.away_set_score), 0);
    const teamAWonMatch = teamASets > teamBSets;
    const teamBWonMatch = teamBSets > teamASets;
    const getPlayerName = (player = {}) => (
        [player.first_name, player.last_name].filter(Boolean).join(' ') ||
        player.name ||
        player.full_name ||
        '-'
    );
    const getPlayerPosition = (player = {}) => {
        const raw = String(player.position || player.role || '').trim().toUpperCase();
        if (!raw) return '-';
        const positionMap = {
            OH: language === 'THA' ? 'หัวเสา' : 'Outside Hitter',
            OPP: language === 'THA' ? 'บีหลัง' : 'Opposite',
            OP: language === 'THA' ? 'บีหลัง' : 'Opposite',
            MB: language === 'THA' ? 'บอลเร็ว' : 'Middle Blocker',
            M: language === 'THA' ? 'บอลเร็ว' : 'Middle Blocker',
            S: language === 'THA' ? 'เซตเตอร์' : 'Setter',
            L: language === 'THA' ? 'ลิเบอโร่' : 'Libero',
            LIBERO: language === 'THA' ? 'ลิเบอโร่' : 'Libero'
        };
        return positionMap[raw] || raw;
    };
    const renderPlayerRows = (players) => (
        players.length > 0 ? players.map((player) => (
            <tr key={player.id || `${player.number}-${getPlayerName(player)}`} className="border-b border-gray-100 last:border-0">
                <td className="w-16 px-3 py-2 text-center font-bold text-blue-950">{player.number || '-'}</td>
                <td className="px-3 py-2 font-medium text-gray-800">
                    {getPlayerName(player)}
                    {player.is_captain ? <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">C</span> : null}
                </td>
                <td className="w-36 px-3 py-2 text-sm text-gray-500">{getPlayerPosition(player)}</td>
            </tr>
        )) : (
            <tr>
                <td colSpan="3" className="px-3 py-6 text-center text-sm italic text-gray-400">
                    {language === 'THA' ? 'ยังไม่มีข้อมูลนักกีฬา' : 'No roster data available'}
                </td>
            </tr>
        )
    );

    return (
        <div className="app-page min-h-screen text-gray-800 font-sans pb-24 relative">

            {/* --- Navbar --- */}
            <PublicHeader />


            {/* Top Navigation (Secondary) */}
            <div className="bg-white/90 backdrop-blur border-b border-blue-100">
                <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 hover:text-[#14366A] font-medium transition cursor-pointer"
                    >
                        <ArrowLeft size={18} /> {language === 'THA' ? 'ย้อนกลับ' : 'Back'}
                    </button>
                    <span className="font-bold text-[#14366A] text-lg">{t('landing.matchCentre')}</span>
                    <div className="w-20"></div> {/* Spacer for balance */}
                </div>
            </div>

            <main id="main-content" tabIndex={-1} className="max-w-[1100px] mx-auto px-4 mt-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge dot tone={realtimeConnected ? 'success' : 'warning'}>{language === 'THA' ? (realtimeConnected ? 'เชื่อมต่อข้อมูลสด' : 'กำลังเชื่อมต่อใหม่') : (realtimeConnected ? 'Live updates connected' : 'Reconnecting')}</StatusBadge><span className="text-xs text-slate-500">{lastUpdated && (language === 'THA' ? 'อัปเดตล่าสุด ' : 'Last updated ') + lastUpdated.toLocaleTimeString(language === 'THA' ? 'th-TH' : 'en-GB')}</span></div>
                {loadError && <Feedback error title={language === 'THA' ? 'ข้อมูลล่าสุดยังโหลดไม่สำเร็จ' : 'Latest update unavailable'} onRetry={() => setReloadKey(key => key + 1)} />}

                {/* MATCH HEADER CARD */}
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden relative">
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-500 via-blue-600 to-red-500"></div>
                    {/* Meta Header */}
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 bg-slate-50/80 px-6 py-5 border-b border-gray-100 text-xs sm:text-sm font-semibold text-gray-500">
                        <span className="text-[#14366A] font-bold"># {match.match_number ? (language === 'THA' ? `แมตช์ที่ ${match.match_number}` : `Match #${match.match_number}`) : (language === 'THA' ? "แมตช์" : "Match")}</span>
                        <div className="flex items-center gap-1.5"><CalendarDays size={16} /> {match.match_date}</div>
                        <div className="flex items-center gap-1.5"><Clock size={16} /> {match.start_time}</div>
                        <div className="flex items-center gap-1.5"><MapPin size={16} /> {match.stadium_name || (language === 'THA' ? "รอระบุสนาม" : "TBA")}</div>
                    </div>

                    {/* Main Score Area */}
                    <div className="flex flex-col md:flex-row items-center justify-between px-8 py-10 md:py-12 relative gap-8 md:gap-0">

                        {/* Team A */}
                        <div className="flex flex-col items-center flex-1 z-10">
                            <TeamLogo name={match.team_a_name} logoUrl={match.team_a_logo} size="lg" />
                            <div className="mt-4 text-sm md:text-base font-bold text-gray-800 text-center uppercase tracking-wide">
                                {match.team_a_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                            </div>
                        </div>

                        {/* Center Score */}
                        <div className="flex flex-col items-center justify-center shrink-0 z-10 mx-2 md:mx-8">
                            <div className="score-number text-4xl md:text-6xl font-black text-[#1e293b] tracking-wider font-mono whitespace-nowrap">
                                <span className={teamAWonMatch ? "text-red-600" : "text-slate-800"}>{teamASets}</span> <span className="text-gray-300 font-sans mx-2">-</span> <span className={teamBWonMatch ? "text-red-600" : "text-slate-800"}>{teamBSets}</span>
                            </div>
                            {!isCompleted && liveState?.score && <div className="mt-3 text-center"><p className="text-xs font-semibold text-slate-500">{language === 'THA' ? 'คะแนนเซตปัจจุบัน' : 'Current set points'}</p><p className="score-number mt-1 text-3xl font-bold text-blue-700">{liveState.score.home ?? 0} : {liveState.score.away ?? 0}</p></div>}
                            <div className="mt-4">
                                <span className={`text-[10px] md:text-xs font-bold px-3 py-1 md:py-1.5 rounded-full tracking-wider uppercase shadow-sm ${
                                    isCompleted ? 'bg-[#3b9f56] text-white'
                                    : isLive ? 'bg-red-500 text-white animate-pulse'
                                    : 'bg-[#e2e8f0] text-gray-600'
                                }`}>
                                    {isCompleted ? (language === 'THA' ? 'จบการแข่งขัน' : 'COMPLETED')
                                    : isLive ? (language === 'THA' ? 'กำลังแข่ง' : 'LIVE')
                                    : (language === 'THA' ? 'ยังไม่เริ่ม' : 'SCHEDULED')}
                                </span>
                            </div>
                        </div>

                        {/* Team B */}
                        <div className="flex flex-col items-center flex-1 z-10">
                            <TeamLogo name={match.team_b_name} logoUrl={match.team_b_logo} size="lg" />
                            <div className="mt-4 text-sm md:text-base font-bold text-gray-800 text-center uppercase tracking-wide">
                                {match.team_b_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                            </div>
                        </div>

                    </div>
                </div>

                {/* SET SCORES CARD */}
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2 bg-slate-50/80">
                        <LayoutGrid className="text-red-500" size={20} />
                        <h2 className="font-bold text-[#1e293b] text-lg">{language === 'THA' ? 'คะแนนแต่ละเซต' : 'Set Scores'}</h2>
                    </div>

                    <div className="p-2 sm:p-6 overflow-x-auto">
                        <table className="w-full min-w-[600px] text-sm md:text-base">
                            <thead>
                                <tr className="text-gray-400 font-semibold border-b border-gray-100 text-xs tracking-wider">
                                    <th className="text-left pb-4 pl-4 font-medium uppercase">{language === 'THA' ? 'ทีม' : 'Team'}</th>
                                    <th className="text-center pb-4 font-medium uppercase w-16">{language === 'THA' ? 'เซต' : 'Set'}</th>
                                    {setColumns.map(num => (
                                        <th key={num} className="text-center pb-4 font-medium uppercase w-16">{language === 'THA' ? `เซต ${num}` : `Set ${num}`}</th>
                                    ))}
                                    <th className="text-center pb-4 font-medium uppercase w-20">{language === 'THA' ? 'รวม' : 'Total'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Team A Row */}
                                <tr className="border-b border-gray-50 hover:bg-gray-50 transition">
                                    <td className="py-4 pl-4 font-bold text-[#1e293b] flex items-center gap-3">
                                        <TeamLogo name={match.team_a_name} logoUrl={match.team_a_logo} size="sm" />
                                        {match.team_a_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                                    </td>
                                    <td className={`py-4 text-center font-black text-xl ${teamAWonMatch ? 'text-red-600' : 'text-gray-800'}`}>{teamASets}</td>
                                    {setColumns.map(num => {
                                        const set = setScores.find(s => s.set_number === num);
                                        const isWinner = set && set.team_a > set.team_b;
                                        return (
                                            <td key={num} className={`py-4 text-center font-bold ${isWinner ? 'text-red-600 bg-red-50 rounded-lg' : 'text-gray-600'}`}>
                                                {set?.team_a ?? '-'}
                                            </td>
                                        );
                                    })}
                                    <td className={`py-4 text-center font-bold ${totalA > totalB ? 'text-red-600' : 'text-gray-800'}`}>{totalA}</td>
                                </tr>

                                {/* Team B Row */}
                                <tr className="hover:bg-gray-50 transition">
                                    <td className="py-4 pl-4 font-bold text-[#1e293b] flex items-center gap-3">
                                        <TeamLogo name={match.team_b_name} logoUrl={match.team_b_logo} size="sm" />
                                        {match.team_b_name || (language === 'THA' ? "รอระบุทีม" : "TBA")}
                                    </td>
                                    <td className={`py-4 text-center font-black text-xl ${teamBWonMatch ? 'text-red-600' : 'text-gray-800'}`}>{teamBSets}</td>
                                    {setColumns.map(num => {
                                        const set = setScores.find(s => s.set_number === num);
                                        const isWinner = set && set.team_b > set.team_a;
                                        return (
                                            <td key={num} className={`py-4 text-center font-bold ${isWinner ? 'text-red-600 bg-red-50 rounded-lg' : 'text-gray-600'}`}>
                                                {set?.team_b ?? '-'}
                                            </td>
                                        );
                                    })}
                                    <td className={`py-4 text-center font-bold ${totalB > totalA ? 'text-red-600' : 'text-gray-800'}`}>{totalB}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* PLAYER ROSTERS */}
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2 bg-slate-50/80">
                        <Users className="text-blue-600" size={20} />
                        <h2 className="font-bold text-[#1e293b] text-lg">
                            {language === 'THA' ? 'รายชื่อนักกีฬาและตำแหน่ง' : 'Players & Positions'}
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:divide-x lg:divide-gray-100">
                        <div className="p-5">
                            <div className="mb-3 flex items-center gap-3">
                                <TeamLogo name={match.team_a_name} logoUrl={match.team_a_logo} size="sm" />
                                <h3 className="font-bold text-blue-950">{match.team_a_name || (language === 'THA' ? 'ทีม A' : 'Team A')}</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-100">
                                <table className="w-full min-w-[360px] text-left text-sm">
                                    <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                                        <tr>
                                            <th className="px-3 py-2 text-center">{language === 'THA' ? 'เบอร์' : 'No.'}</th>
                                            <th className="px-3 py-2">{language === 'THA' ? 'นักกีฬา' : 'Player'}</th>
                                            <th className="px-3 py-2">{language === 'THA' ? 'ตำแหน่ง' : 'Position'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>{renderPlayerRows(teamPlayers.home)}</tbody>
                                </table>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="mb-3 flex items-center gap-3">
                                <TeamLogo name={match.team_b_name} logoUrl={match.team_b_logo} size="sm" />
                                <h3 className="font-bold text-blue-950">{match.team_b_name || (language === 'THA' ? 'ทีม B' : 'Team B')}</h3>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-100">
                                <table className="w-full min-w-[360px] text-left text-sm">
                                    <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                                        <tr>
                                            <th className="px-3 py-2 text-center">{language === 'THA' ? 'เบอร์' : 'No.'}</th>
                                            <th className="px-3 py-2">{language === 'THA' ? 'นักกีฬา' : 'Player'}</th>
                                            <th className="px-3 py-2">{language === 'THA' ? 'ตำแหน่ง' : 'Position'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>{renderPlayerRows(teamPlayers.away)}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <Panel title={language === 'THA' ? 'เหตุการณ์ล่าสุด' : 'Recent events'} description={language === 'THA' ? 'ประวัติการแข่งขันจากผู้บันทึกคะแนน' : 'Match events recorded by the scorer'}>
                    <ol className="divide-y divide-slate-100 px-5">{events.length ? events.map((event, index) => <li key={event.id || index} className="flex items-start justify-between gap-4 py-4 text-sm"><div><StatusBadge tone="info">{language === 'THA' ? 'เซต ' : 'Set '}{event.set_number || event.set || '-'}</StatusBadge><p className="mt-2 font-medium text-slate-700">{event.description || event.event_type || event.type || '-'}</p></div><span className="score-number shrink-0 font-semibold text-slate-600">{event.score || (event.score_home != null ? `${event.score_home} : ${event.score_away}` : '')}</span></li>) : <li className="py-8 text-center text-sm text-slate-500">{language === 'THA' ? 'ยังไม่มีเหตุการณ์บันทึก' : 'No events recorded yet.'}</li>}</ol>
                </Panel>
            </main>

            {/* --- Footer --- */}
            <footer className="bg-gray-900 text-gray-400 py-6 text-center text-sm w-full absolute bottom-0 z-40">
                <p>&copy; {new Date().getFullYear()} {language === 'THA' ? 'ระบบจัดการแข่งขันวอลเลย์บอล. สงวนลิขสิทธิ์ทั้งหมด.' : 'Volleyball Tournament System. All rights reserved.'}</p>
            </footer>

        </div>
    );
}

