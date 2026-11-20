import { GuardedButton } from '../ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import React, { useState, useEffect, useEffectEvent, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, RefreshCw, ArrowRightLeft, Wifi, WifiOff, MonitorPlay, PauseCircle, Smartphone, Monitor } from 'lucide-react';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import { api } from '../../api';
import { getAuthToken, getStoredUser } from '../../auth/authStorage';
import CourtView from '../scorer/CourtView.jsx';
import useScorerTranslation from '../scorer/useScorerTranslation';
import { getContrastClass } from '../../utils/common/colorUtils';
import { SCORER_TIMEOUT_MS } from '../../utils/scorer/scorerHelpers';
import '../scorer/ScorerTimeout.css';

const getSocketServerUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return `${window.location.protocol}//${window.location.hostname}:3000`;
    return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

function RefereeTimeout({ startedAt, title, teamName, teamColor }) {
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        const timer = setInterval(() => {
            const timestamp = Date.now();
            setNow(timestamp);
            if (timestamp >= startedAt + SCORER_TIMEOUT_MS) clearInterval(timer);
        }, 100);
        return () => clearInterval(timer);
    }, [startedAt]);

    const remaining = Math.min(SCORER_TIMEOUT_MS, startedAt + SCORER_TIMEOUT_MS - now);
    if (remaining <= 0) return null;
    const seconds = Math.ceil(remaining / 1000);

    return (
        <div className="referee-timeout-overlay">
            <section role="dialog" aria-label={title} className="scorer-timeout-popup">
                <h2 className="scorer-timeout-title">{title}</h2>
                {teamName && <div className="scorer-timeout-team mt-2">
                    <span className="scorer-timeout-team-color" style={{ backgroundColor: teamColor }} aria-hidden="true" />
                    <span>{teamName}</span>
                </div>}
                <div role="timer" className={`scorer-timeout-clock ${seconds <= 5 ? 'scorer-timeout-urgent' : ''}`}>
                    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
                        <circle className="scorer-timeout-track" cx="100" cy="100" r="92" />
                        <circle className="scorer-timeout-remaining" cx="100" cy="100" r="92" pathLength="100"
                            strokeDasharray="100" strokeDashoffset={100 * (1 - remaining / SCORER_TIMEOUT_MS)}
                            transform="rotate(-90 100 100)" />
                    </svg>
                    <span>00:{String(seconds).padStart(2, '0')}</span>
                </div>
            </section>
        </div>
    );
}

const getRequestDetails = (request) => {
    const details = request?.details || {};
    if (typeof details !== 'string') return details;

    try {
        return JSON.parse(details || '{}');
    } catch {
        return {};
    }
};

const buildRequestAlert = (request, t, names) => {
    const requestType = String(request?.request_type || '').toUpperCase();
    const teamName = names.linkedTeamName(request) || t('N/A');
    const details = getRequestDetails(request);

    if (requestType === 'TIMEOUT') {
        return {
            title: t('Timeout Request'),
            text: t('Team {0} requested a time out.', [teamName]),
            icon: 'warning'
        };
    }

    if (requestType === 'SUBSTITUTION') {
        const pairs = Array.isArray(details.pairs) ? details.pairs : [];
        const pairsText = pairs.length > 0
            ? pairs.map((pair) => {
                const outNum = pair.outPlayer?.number || '?';
                const inNum = pair.inPlayer?.number || '?';
                return t('OUT #{0} -> IN #{1}', [outNum, inNum]);
            }).join('\n')
            : t('Substitution details are pending.');

        return {
            title: t('Substitution Request'),
            text: t('Team {0} requested a substitution.\n{1}', [teamName, pairsText]),
            icon: 'info'
        };
    }

    if (requestType === 'CHALLENGE') {
        const reason = details.reason || 'Waiting for challenge reason...';
        const lastActionText = details.lastAction === null || details.lastAction === undefined
            ? 'Action selection pending'
            : details.lastAction
                ? 'Last rally action'
                : 'Previous action';

        return {
            title: t('Video Challenge Request'),
            text: t('Team {0} requested a video challenge.\nReason: {1}\nAction: {2}', [teamName, t(reason), t(lastActionText)]),
            icon: 'question'
        };
    }

    return null;
};

const StatsTable = ({ challenges, timeouts, substitutions, leftTeam, rightTeam, isLandscape = false }) => {
    const ui = useUiTranslation();
    return (<div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full ${isLandscape ? 'w-full' : 'w-full'}`}>
        {/* VC (Challenges) */}
        <div className="grid grid-cols-3 border-b border-slate-100 flex-1 py-2 sm:py-3.5">
            <div className="flex items-center justify-center font-black text-blue-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{challenges[leftTeam.code]}</div>
            <div className="flex flex-col items-center justify-center gap-1 bg-slate-50/50 text-slate-400 font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wider border-x border-slate-100">
                <MonitorPlay size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" /> 
                <span className="hidden sm:inline text-center leading-none">{ui("Challenges")}</span>
            </div>
            <div className="flex items-center justify-center font-black text-blue-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{challenges[rightTeam.code]}</div>
        </div>

        {/* TO (Timeouts) */}
        <div className="grid grid-cols-3 border-b border-slate-100 flex-1 py-2 sm:py-3.5">
            <div className="flex items-center justify-center font-black text-amber-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{timeouts[leftTeam.code]}</div>
            <div className="flex flex-col items-center justify-center gap-1 bg-slate-50/50 text-slate-400 font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wider border-x border-slate-100">
                <PauseCircle size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" /> 
                <span className="hidden sm:inline text-center leading-none">{ui("Timeouts")}</span>
            </div>
            <div className="flex items-center justify-center font-black text-amber-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{timeouts[rightTeam.code]}</div>
        </div>

        {/* SUB (Substitutions) */}
        <div className="grid grid-cols-3 flex-1 py-2 sm:py-3.5">
            <div className="flex items-center justify-center font-black text-emerald-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{substitutions[leftTeam.code]}</div>
            <div className="flex flex-col items-center justify-center gap-1 bg-slate-50/50 text-slate-400 font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wider border-x border-slate-100">
                <ArrowRightLeft size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" /> 
                <span className="hidden sm:inline text-center leading-none">{ui("Subs")}</span>
            </div>
            <div className="flex items-center justify-center font-black text-emerald-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{substitutions[rightTeam.code]}</div>
        </div>
    </div>
);
};

export default function ScoreViewReferee() {
    const st = useScorerTranslation();
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const { matchId } = useParams();
    const [localFlip, setLocalFlip] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(() => Date.now());

    // --- LOCAL STORAGE HELPER ---
    const loadState = (key, defaultValue) => {
        try {
            const saved = localStorage.getItem(`match_${matchId}_${key}`);
            return saved !== null ? JSON.parse(saved) : defaultValue;
        } catch {
            return defaultValue;
        }
    };

    // --- STATE MANAGEMENT ---
    const [matchData, setMatchData] = useState(() => loadState('matchData', { teamHome: "HOME", teamAway: "AWAY", currentSet: 1 }));
    const [requestConnection, setRequestConnection] = useState('checking');
    const [activeTimeout, setActiveTimeout] = useState(null);
    const [isVertical, setIsVertical] = useState(() => loadState('isVertical', true));
    const [score, setScore] = useState(() => loadState('score', { home: 0, away: 0 }));
    const [setsWon, setSetsWon] = useState(() => loadState('setsWon', { home: 0, away: 0 }));
    const [timeouts, setTimeouts] = useState(() => loadState('timeouts', { home: 0, away: 0 }));
    const [challenges, setChallenges] = useState(() => loadState('challenges', { home: 2, away: 2 }));
    const [substitutions, setSubstitutions] = useState(() => loadState('substitutions', { home: 0, away: 0 }));
    const [servingTeam, setServingTeam] = useState(() => loadState('servingTeam', null));
    const [isHomeLeft, setIsHomeLeft] = useState(() => loadState('isHomeLeft', true));
    const [matchDuration, setMatchDuration] = useState(() => loadState('matchDuration', 0));
    const [workflowStep, setWorkflowStep] = useState(() => loadState('workflowStep', ''));
    
    // Lineup & Liberos for CourtView
    const [homeLineup, setHomeLineup] = useState(() => loadState('homeLineup', Array(6).fill(null)));
    const [awayLineup, setAwayLineup] = useState(() => loadState('awayLineup', Array(6).fill(null)));
    const [homeRoster, setHomeRoster] = useState([]);
    const [awayRoster, setAwayRoster] = useState([]);
    const [homeLiberos, setHomeLiberos] = useState(() => loadState('homeLiberos', { l1: null, l2: null }));
    const [awayLiberos, setAwayLiberos] = useState(() => loadState('awayLiberos', { l1: null, l2: null }));
    const [homeLiberoSwaps, setHomeLiberoSwaps] = useState(() => loadState('homeLiberoSwaps', {}));
    const [awayLiberoSwaps, setAwayLiberoSwaps] = useState(() => loadState('awayLiberoSwaps', {}));
    const [homeSubTracker, setHomeSubTracker] = useState(() => loadState('homeSubTracker', { count: 0, positions: {}, usedPlayers: [] }));
    const [awaySubTracker, setAwaySubTracker] = useState(() => loadState('awaySubTracker', { count: 0, positions: {}, usedPlayers: [] }));
    const [teamColors, setTeamColors] = useState(() => loadState('teamColors', { home: '#4f46e5', away: '#e11d48' }));
    const [isConnected, setIsConnected] = useState(true);

    const refreshData = useCallback(async () => {
        try {
            const res = await api.getLiveState(matchId);
            const state = res.data;
            const startedAt = Number(state.timeoutStartTime);
            setActiveTimeout(state.showTimeoutTimer && Number.isFinite(startedAt) && startedAt > 0
                ? { startedAt, team: state.timeoutTeam === 'home' || state.timeoutTeam === 'away' ? state.timeoutTeam : null }
                : null);

            // Set all states from the fetched data, with fallbacks
            if (state.matchData) {
                const m = state.matchData;
                setMatchData(m);
                
                // Fetch rosters if not already loaded
                if (m.teamHomeId && homeRoster.length === 0) {
                    api.getPlayersByTeam(m.teamHomeId).then(r => setHomeRoster(r.data || []));
                }
                if (m.teamAwayId && awayRoster.length === 0) {
                    api.getPlayersByTeam(m.teamAwayId).then(r => setAwayRoster(r.data || []));
                }
            }

            setScore(state.score || { home: 0, away: 0 });
            setSetsWon(state.setsWon || { home: 0, away: 0 });
            setTimeouts(state.timeouts || { home: 0, away: 0 });
            setChallenges(state.challenges || { home: 2, away: 2 });
            setSubstitutions(state.substitutions || { home: 0, away: 0 });
            setServingTeam(state.servingTeam || null);
            setIsHomeLeft(state.isHomeLeft !== undefined ? state.isHomeLeft : true);
            setMatchDuration(state.matchDuration || 0);
            setWorkflowStep(state.workflowStep || '');
            setHomeLineup(state.homeLineup || Array(6).fill(null));
            setAwayLineup(state.awayLineup || Array(6).fill(null));
            setHomeLiberos(state.homeLiberos || { l1: null, l2: null });
            setAwayLiberos(state.awayLiberos || { l1: null, l2: null });
            setHomeLiberoSwaps(state.homeLiberoSwaps || {});
            setAwayLiberoSwaps(state.awayLiberoSwaps || {});
            
            // ✅ ดึงข้อมูลการเปลี่ยนตัว (Sub Tracker)
            if (state.subTracker) {
                setHomeSubTracker(state.subTracker.home || { count: 0, positions: {}, usedPlayers: [] });
                setAwaySubTracker(state.subTracker.away || { count: 0, positions: {}, usedPlayers: [] });
            }

            setTeamColors(state.teamColors || { home: '#4f46e5', away: '#e11d48' });
            setLastUpdated(Date.now());
        } catch (error) {
            console.error("Failed to refresh data from server:", error);
        }
    }, [matchId, homeRoster, awayRoster]);

    // --- EFFECT: LIVE POLLING ---
    useEffect(() => {
        const timeout = setTimeout(() => {
            refreshData();
        }, 0);
        const interval = setInterval(refreshData, 1000); // Poll every 1 second
        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [matchId, refreshData]);

    // --- EFFECT: REAL-TIME REQUEST NOTIFICATIONS FOR REFEREE ---
    const refreshFromSocket = useEffectEvent(() => { void refreshData(); });

    useEffect(() => {
        const socket = io(getSocketServerUrl(), { auth: { token: getAuthToken() }, withCredentials: true });
        const requests = new Map();
        const outcomes = new Map();
        const queue = [];
        let activeAlert = null;
        let disposed = false;
        let wantsAlerts = getStoredUser()?.role === 'referee';
        let joinAttempt = 0;
        const requestTypes = new Set(['TIMEOUT', 'SUBSTITUTION', 'CHALLENGE']);

        function join() {
            const attempt = ++joinAttempt;
            const role = wantsAlerts ? 'referee_alerts' : 'referee';
            setRequestConnection(wantsAlerts ? 'checking' : 'public');
            socket.timeout(4000).emit('join_match', { matchId, role }, (error, result) => {
                if (disposed || attempt !== joinAttempt || !socket.connected) return;
                if (wantsAlerts) {
                    setRequestConnection(error ? 'unavailable' : result?.joined && result.refereeAlerts ? 'ready' : 'public');
                }
            });
        }

        socket.on('connect', join);
        const resetRequestConnection = () => {
            joinAttempt++;
            setRequestConnection(wantsAlerts ? 'unavailable' : 'public');
        };
        socket.on('disconnect', resetRequestConnection);
        socket.on('connect_error', resetRequestConnection);
        socket.on('join_error', () => {
            if (!wantsAlerts) return;
            wantsAlerts = false;
            join();
        });
        if (socket.connected) join();

        function showNextAlert() {
            if (disposed || activeAlert || !queue.length) return;
            const item = queue.shift();
            const request = requests.get(item.id);
            const outcome = outcomes.get(item.id);
            activeAlert = item;

            if (outcome) {
                const title = outcome.cancelled ? 'คำขอถูกยกเลิก'
                    : outcome.status === 'APPROVED' ? 'คำขอได้รับการอนุมัติ (Approved)' : 'คำขอถูกปฏิเสธ (Rejected)';
                const summary = request && buildRequestAlert(request, ui, displayNames);
                void Swal.fire({ uiTextLocalized: true, toast: true, position: 'top-end',
                    title: ui(title), text: summary?.title, icon: outcome.status === 'APPROVED' ? 'success' : 'info',
                    showConfirmButton: false, timer: 3000 }).then(finishAlert);
                return;
            }

            const alert = buildRequestAlert(request, ui, displayNames);
            const timed = request.request_type !== 'CHALLENGE';
            const sound = new Audio('/sounds/notification.mp3');
            void sound.play().catch(() => {});
            void Swal.fire({ uiTextLocalized: true, ...alert, showConfirmButton: true, confirmButtonText: ui('OK'),
                footer: ui('Waiting for scorer'), allowOutsideClick: false, timer: timed ? 15000 : undefined,
                timerProgressBar: timed }).then(finishAlert);
        }

        function finishAlert() {
            activeAlert = null;
            showNextAlert();
        }

        socket.on('new_staff_request', request => {
            if (!requestTypes.has(request?.request_type) || request.id == null) return;
            const id = String(request.id);
            if (requests.has(id)) return;
            requests.set(id, request);
            queue.push({ id, result: false });
            showNextAlert();
        });

        socket.on('request_updated', request => {
            const id = String(request?.id);
            if (!requests.has(id) || outcomes.has(id)) return;
            requests.set(id, request);
            if (activeAlert?.id === id && !activeAlert.result && Swal.isVisible()) {
                const { text: updatedText } = buildRequestAlert(request, ui, displayNames);
                Swal.update({ text: updatedText });
            }
        });

        socket.on('request_processed', result => {
            const id = String(result?.id);
            if (outcomes.has(id)) return;
            outcomes.set(id, result);
            if (!requests.has(id) || queue.some(item => item.id === id)) return;
            queue.unshift({ id, result: true });
            if (activeAlert?.id === id && !activeAlert.result) Swal.close();
            showNextAlert();
        });

        socket.on('match_updated', () => refreshFromSocket());

        return () => {
            disposed = true;
            if (activeAlert) Swal.close();
            socket.off('disconnect', resetRequestConnection);
            socket.off('connect_error', resetRequestConnection);
            socket.disconnect();
        };
    }, [matchId, ui, displayNames]);

    // --- EFFECT: CONNECTION CHECK ---
    useEffect(() => {
        const check = () => {
            setIsConnected(Date.now() - lastUpdated < 3000);
        };
        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    }, [lastUpdated]);

    // --- UI HELPERS ---
    const effectiveIsHomeLeft = localFlip ? !isHomeLeft : isHomeLeft;
    const isSetupPhase = ['COIN_TOSS', 'SIGNATURES', 'ROSTER_CHECK', 'SERVER_SELECT', 'LINEUP_SELECT', 'LINEUP'].includes(workflowStep) || !workflowStep;

    const getLeftTeam = () => effectiveIsHomeLeft
        ? { name: displayNames.matchTeamName(matchData, 'home'), score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home, bg: teamColors.home, roster: homeRoster, lineup: homeLineup, liberos: homeLiberos, liberoSwaps: homeLiberoSwaps }
        : { name: displayNames.matchTeamName(matchData, 'away'), score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away, bg: teamColors.away, roster: awayRoster, lineup: awayLineup, liberos: awayLiberos, liberoSwaps: awayLiberoSwaps };

    const getRightTeam = () => effectiveIsHomeLeft
        ? { name: displayNames.matchTeamName(matchData, 'away'), score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away, bg: teamColors.away, roster: awayRoster, lineup: awayLineup, liberos: awayLiberos, liberoSwaps: awayLiberoSwaps }
        : { name: displayNames.matchTeamName(matchData, 'home'), score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home, bg: teamColors.home, roster: homeRoster, lineup: homeLineup, liberos: homeLiberos, liberoSwaps: homeLiberoSwaps };

    const leftTeam = getLeftTeam();
    const rightTeam = getRightTeam();

    // Format Duration
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-screen w-screen bg-slate-50 text-slate-800 flex flex-col overflow-hidden font-sans select-none">
            {requestConnection === 'ready' && activeTimeout && (
                <RefereeTimeout key={activeTimeout.startedAt} startedAt={activeTimeout.startedAt}
                    title={st('Timeout')}
                    teamName={activeTimeout.team ? displayNames.matchTeamName(matchData, activeTimeout.team) : ''}
                    teamColor={teamColors[activeTimeout.team]} />
            )}
            {/* 2. Main Content Area: Responsive Layout for Court + Stats */}
            <div className={`flex-1 flex overflow-hidden relative ${isVertical ? 'flex-col' : 'flex-row'}`}>
                
                {/* Left Column: Header + Court View Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* 1. Header: Modern & Adaptive */}
                    <header className="bg-white border-b border-slate-200 shadow-sm z-20 px-4 md:px-8 py-2 md:py-4 shrink-0">
                        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-2 md:gap-6">
                            {/* Left Team */}
                            <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end overflow-hidden">
                                <div className="bg-slate-100 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-xl md:text-4xl font-black border border-slate-200 min-w-[50px] md:min-w-[80px] text-center text-slate-700 shadow-inner">
                                    {leftTeam.sets}
                                </div>
                                <h1 className="text-lg md:text-3xl font-black truncate text-slate-800 uppercase tracking-tight">
                                    {displayNames.teamName(leftTeam)}
                                </h1>
                            </div>

                            {/* Center Info */}
                            <div className="flex flex-col items-center px-4 md:px-10 border-x border-slate-100">
                                <div className="text-[9px] md:text-[11px] text-slate-400 uppercase font-black tracking-[0.2em] mb-0.5 md:mb-1">{ui("Duration")}</div>
                                <div className="text-lg md:text-3xl font-mono font-black text-blue-600 flex items-center gap-1.5 md:gap-3">
                                    <Clock size={20} className="text-blue-400" />
                                    {formatTime(matchDuration)}
                                </div>
                            </div>

                            {/* Right Team */}
                            <div className="flex items-center gap-2 md:gap-4 flex-1 justify-start overflow-hidden">
                                <h1 className="text-lg md:text-3xl font-black truncate text-slate-800 uppercase tracking-tight text-right">
                                    {displayNames.teamName(rightTeam)}
                                </h1>
                                <div className="bg-slate-100 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-xl md:text-4xl font-black border border-slate-200 min-w-[50px] md:min-w-[80px] text-center text-slate-700 shadow-inner">
                                    {rightTeam.sets}
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Court View Area (Always centered, takes more space) */}
                    <div className="flex-1 relative bg-slate-100/50 flex items-center justify-center overflow-hidden p-2 md:p-6">
                    <div className="w-full h-full max-w-7xl flex items-center justify-center">
                        <CourtView
                            jerseyTokens
                            homePositions={effectiveIsHomeLeft ? homeLineup : awayLineup}
                            awayPositions={effectiveIsHomeLeft ? awayLineup : homeLineup}
                            servingSide={servingTeam ? ((servingTeam === leftTeam.code) ? 'left' : 'right') : null}
                            leftTeam={leftTeam}
                            rightTeam={rightTeam}
                            homeSubTracker={homeSubTracker}
                            awaySubTracker={awaySubTracker}
                            isHomeLeft={isHomeLeft}
                            disableLibero={true}
                            isReadOnly={true}
                            hideTokens={isSetupPhase}
                            tokenNumberClass="text-3xl sm:text-4xl md:text-5xl xl:text-6xl"
                            tokenBoxClass="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 xl:w-32 xl:h-32"
                            className="max-w-none"
                        />
                    </div>
                </div>
            </div>

                {/* Sidebar / Bottom Bar: Adaptive based on orientation */}
                <div className={`bg-white border-slate-200 flex flex-col shrink-0 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-10 transition-all duration-500 ${
                    isVertical 
                        ? 'border-t h-[42vh] md:h-[34vh]' 
                        : 'border-l w-[320px] md:w-[400px] xl:w-[480px]'
                }`}>
                    
                    {/* Set Indicator */}
                    <div className="bg-slate-900 py-2 md:py-3 text-center shrink-0">
                        <span className="text-lg md:text-7xl font-black text-white uppercase tracking-[0.3em]">{ui("SET-")}{matchData.currentSet}</span>
                    </div>

                    {/* Stats & Scores Area */}
                    <div className="flex-1 p-3 md:p-4 flex flex-col gap-2 md:gap-4 overflow-hidden bg-slate-50">
                        
                        {/* --- Scores Row --- */}
                        <div className={`flex flex-row items-stretch gap-2 md:gap-4 ${isVertical ? 'h-full' : 'h-auto'}`}>
                            
                            {/* Left Score Card */}
                            <div data-theme-fixed className="flex-1 rounded-2xl md:rounded-3xl border-2 border-white flex flex-col items-center justify-center shadow-md p-2 md:p-4 relative overflow-hidden transition-all" style={{ backgroundColor: leftTeam.color }}>
                                <div className={`text-6xl md:text-8xl xl:text-9xl font-black ${getContrastClass(leftTeam.color)} drop-shadow-lg tabular-nums`}>
                                    {leftTeam.score}
                                </div>
                            </div>

                            {/* Center Stats (Vertical Only: between scores) */}
                            {isVertical && (
                                <div className="flex flex-[2.5] max-w-[650px]">
                                    <StatsTable challenges={challenges} timeouts={timeouts} substitutions={substitutions} leftTeam={leftTeam} rightTeam={rightTeam} />
                                </div>
                            )}

                            {/* Right Score Card */}
                            <div data-theme-fixed className="flex-1 rounded-2xl md:rounded-3xl border-2 border-white flex flex-col items-center justify-center shadow-md p-2 md:p-4 relative overflow-hidden transition-all" style={{ backgroundColor: rightTeam.color }}>
                                <div className={`text-6xl md:text-8xl xl:text-9xl font-black ${getContrastClass(rightTeam.color)} drop-shadow-lg tabular-nums`}>
                                    {rightTeam.score}
                                </div>
                            </div>
                        </div>

                        {/* Center Stats (Horizontal Only: below scores) */}
                        {!isVertical && (
                            <div className="flex w-full overflow-hidden">
                                <StatsTable challenges={challenges} timeouts={timeouts} substitutions={substitutions} leftTeam={leftTeam} rightTeam={rightTeam} isLandscape={true} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            

            {/* 5. Footer */}
            <div className="bg-slate-200 px-3 py-3 flex flex-wrap justify-between items-center gap-3 text-sm text-slate-600 shrink-0 border-t border-slate-300 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                    {isConnected ? (
                        <div className="flex items-center gap-2 text-green-600">
                            <Wifi size={16} /> <span className="font-bold">{ui("Connected")}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-red-500">
                            <WifiOff size={16} /> <span className="font-bold">{ui("Disconnected")}</span>
                        </div>
                    )}
                    <span className="text-slate-500 ml-2 hidden sm:inline">{ui("Last update:")}{' '}{new Date(lastUpdated).toLocaleTimeString()}</span>
                    <span role="status" className={`rounded-full px-2 py-1 text-xs font-semibold ${requestConnection === 'ready' ? 'bg-emerald-100 text-emerald-900' : 'bg-white text-slate-700'}`}>
                        {ui({
                            ready: 'พร้อมรับคำขอทีม',
                            public: 'ดูคะแนนสดเท่านั้น',
                            checking: 'กำลังตรวจสิทธิ์รับคำขอ',
                            unavailable: 'ยังยืนยันสิทธิ์รับคำขอไม่ได้',
                        }[requestConnection])}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <GuardedButton
                        onClick={() => {
                            const newVertical = !isVertical;
                            setIsVertical(newVertical);
                            try {
                                localStorage.setItem(`match_${matchId}_isVertical`, JSON.stringify(newVertical));
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-300 shadow-sm"
                    >
                        {isVertical ? <Smartphone size={16} /> : <Monitor size={16} />}
                        {isVertical ? ui("Vertical Layout") : ui("Landscape Layout")}
                    </GuardedButton>
                    <GuardedButton
                        onClick={() => setLocalFlip(!localFlip)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-300 shadow-sm"
                    >
                        <ArrowRightLeft size={16} />{ui("Swap Sides")}</GuardedButton>
                    <GuardedButton
                        onClick={refreshData}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-300 shadow-sm"
                    >
                        <RefreshCw size={16} />{ui("Refresh")}</GuardedButton>
                </div>
            </div>
        </div>
    );
}
