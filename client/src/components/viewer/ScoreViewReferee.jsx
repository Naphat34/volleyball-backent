import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, RefreshCw, ArrowRightLeft, Wifi, WifiOff, MonitorPlay, PauseCircle, Smartphone, Monitor } from 'lucide-react';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import { api } from '../../api';
import CourtView from '../CourtView.jsx';
import { getContrastClass } from '../../utils/colorUtils';

const getSocketServerUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return `${window.location.protocol}//${window.location.hostname}:3000`;
    return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

const StatsTable = ({ challenges, timeouts, substitutions, leftTeam, rightTeam, isLandscape = false }) => (
    <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full ${isLandscape ? 'w-full' : 'w-full'}`}>
        {/* VC (Challenges) */}
        <div className="grid grid-cols-3 border-b border-slate-100 flex-1 py-2 sm:py-3.5">
            <div className="flex items-center justify-center font-black text-blue-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{challenges[leftTeam.code]}</div>
            <div className="flex flex-col items-center justify-center gap-1 bg-slate-50/50 text-slate-400 font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wider border-x border-slate-100">
                <MonitorPlay size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" /> 
                <span className="hidden sm:inline text-center leading-none">Challenges</span>
            </div>
            <div className="flex items-center justify-center font-black text-blue-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{challenges[rightTeam.code]}</div>
        </div>

        {/* TO (Timeouts) */}
        <div className="grid grid-cols-3 border-b border-slate-100 flex-1 py-2 sm:py-3.5">
            <div className="flex items-center justify-center font-black text-amber-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{timeouts[leftTeam.code]}</div>
            <div className="flex flex-col items-center justify-center gap-1 bg-slate-50/50 text-slate-400 font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wider border-x border-slate-100">
                <PauseCircle size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" /> 
                <span className="hidden sm:inline text-center leading-none">Timeouts</span>
            </div>
            <div className="flex items-center justify-center font-black text-amber-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{timeouts[rightTeam.code]}</div>
        </div>

        {/* SUB (Substitutions) */}
        <div className="grid grid-cols-3 flex-1 py-2 sm:py-3.5">
            <div className="flex items-center justify-center font-black text-emerald-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{substitutions[leftTeam.code]}</div>
            <div className="flex flex-col items-center justify-center gap-1 bg-slate-50/50 text-slate-400 font-black text-[10px] sm:text-xs md:text-sm uppercase tracking-wider border-x border-slate-100">
                <ArrowRightLeft size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" /> 
                <span className="hidden sm:inline text-center leading-none">Subs</span>
            </div>
            <div className="flex items-center justify-center font-black text-emerald-600 text-2xl sm:text-3xl md:text-4xl xl:text-5xl">{substitutions[rightTeam.code]}</div>
        </div>
    </div>
);

export default function ScoreViewReferee() {
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
    useEffect(() => {
        const socketUrl = getSocketServerUrl();
        const socket = io(socketUrl);

        socket.on('connect', () => {
            socket.emit('join_match', { matchId, role: 'referee' });
        });

        if (socket.connected) {
            socket.emit('join_match', { matchId, role: 'referee' });
        }

        let activeAlertId = null;

        socket.on('new_staff_request', (request) => {
            if (request.request_type === 'TIMEOUT' || request.request_type === 'SUBSTITUTION') {
                activeAlertId = request.id;
                
                let titleText = '';
                let textContent = '';
                let iconType = 'info';

                if (request.request_type === 'TIMEOUT') {
                    titleText = 'Request Timeout';
                    textContent = `ทีม ${request.team_name || 'N/A'} ขอเวลานอก (Timeout)`;
                    iconType = 'warning';
                } else if (request.request_type === 'SUBSTITUTION') {
                    titleText = 'Request Substitution';
                    const pairsText = request.details?.pairs?.map(p => {
                        const outNum = p.outPlayer?.number || '?';
                        const inNum = p.inPlayer?.number || '?';
                        return `เบอร์ ${outNum} ⇄ เบอร์ ${inNum}`;
                   }).join(', ') || '';
                    textContent = `ทีม ${request.team_name || 'N/A'} ขอเปลี่ยนตัว: ${pairsText}`;
                    iconType = 'info';
                }

                // Play alert sound
                try {
                    const audio = new Audio('/sounds/notification.mp3');
                    audio.play().catch(() => {});
                } catch {
                    // Notification sound is optional.
                }

                Swal.fire({
                    title: titleText,
                    text: textContent,
                    icon: iconType,
                    showConfirmButton: true,
                    confirmButtonText: 'ตกลง (OK)',
                    confirmButtonColor: '#3085d6',
                    allowOutsideClick: false,
                    timer: 15000,
                    timerProgressBar: true
                });
            }
        });

        socket.on('request_processed', (data) => {
            if (activeAlertId && Number(data.id) === Number(activeAlertId)) {
                Swal.close();
                activeAlertId = null;
                
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: data.status === 'APPROVED' ? 'success' : 'error',
                    title: data.status === 'APPROVED' ? 'คำขอได้รับการอนุมัติ (Approved)' : 'คำขอถูกปฏิเสธ (Rejected)',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
        });

        socket.on('match_updated', () => {
            refreshData();
        });

        return () => {
            socket.off('new_staff_request');
            socket.off('request_processed');
            socket.off('match_updated');
            socket.disconnect();
        };
    }, [matchId, refreshData]);

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
        ? { name: matchData.teamHome, score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home, bg: teamColors.home, roster: homeRoster, lineup: homeLineup, liberos: homeLiberos, liberoSwaps: homeLiberoSwaps }
        : { name: matchData.teamAway, score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away, bg: teamColors.away, roster: awayRoster, lineup: awayLineup, liberos: awayLiberos, liberoSwaps: awayLiberoSwaps };

    const getRightTeam = () => effectiveIsHomeLeft
        ? { name: matchData.teamAway, score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away, bg: teamColors.away, roster: awayRoster, lineup: awayLineup, liberos: awayLiberos, liberoSwaps: awayLiberoSwaps }
        : { name: matchData.teamHome, score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home, bg: teamColors.home, roster: homeRoster, lineup: homeLineup, liberos: homeLiberos, liberoSwaps: homeLiberoSwaps };

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
                                    {leftTeam.name}
                                </h1>
                            </div>

                            {/* Center Info */}
                            <div className="flex flex-col items-center px-4 md:px-10 border-x border-slate-100">
                                <div className="text-[9px] md:text-[11px] text-slate-400 uppercase font-black tracking-[0.2em] mb-0.5 md:mb-1">Duration</div>
                                <div className="text-lg md:text-3xl font-mono font-black text-blue-600 flex items-center gap-1.5 md:gap-3">
                                    <Clock size={20} className="text-blue-400" />
                                    {formatTime(matchDuration)}
                                </div>
                            </div>

                            {/* Right Team */}
                            <div className="flex items-center gap-2 md:gap-4 flex-1 justify-start overflow-hidden">
                                <h1 className="text-lg md:text-3xl font-black truncate text-slate-800 uppercase tracking-tight text-right">
                                    {rightTeam.name}
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
                            tokenNumberClass="text-5xl sm:text-6xl md:text-7xl xl:text-8xl"
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
                        <span className="text-lg md:text-7xl font-black text-white uppercase tracking-[0.3em]">SET-{matchData.currentSet}</span>
                    </div>

                    {/* Stats & Scores Area */}
                    <div className="flex-1 p-3 md:p-4 flex flex-col gap-2 md:gap-4 overflow-hidden bg-slate-50">
                        
                        {/* --- Scores Row --- */}
                        <div className={`flex flex-row items-stretch gap-2 md:gap-4 ${isVertical ? 'h-full' : 'h-auto'}`}>
                            
                            {/* Left Score Card */}
                            <div className="flex-1 rounded-2xl md:rounded-3xl border-2 border-white flex flex-col items-center justify-center shadow-md p-2 md:p-4 relative overflow-hidden transition-all" style={{ backgroundColor: leftTeam.color }}>
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
                            <div className="flex-1 rounded-2xl md:rounded-3xl border-2 border-white flex flex-col items-center justify-center shadow-md p-2 md:p-4 relative overflow-hidden transition-all" style={{ backgroundColor: rightTeam.color }}>
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
            <div className="bg-slate-200 px-6 py-3 flex justify-between items-center text-sm text-slate-600 shrink-0 border-t border-slate-300">
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <div className="flex items-center gap-2 text-green-600">
                            <Wifi size={16} /> <span className="font-bold">Connected</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-red-500">
                            <WifiOff size={16} /> <span className="font-bold">Disconnected</span>
                        </div>
                    )}
                    <span className="text-slate-500 ml-2 hidden sm:inline">Last update: {new Date(lastUpdated).toLocaleTimeString()}</span>
                </div>

                <div className="flex items-center gap-4">
                    <button 
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
                        {isVertical ? "Vertical Layout" : "Landscape Layout"}
                    </button>
                    <button 
                        onClick={() => setLocalFlip(!localFlip)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-300 shadow-sm"
                    >
                        <ArrowRightLeft size={16} /> Swap Sides
                    </button>
                    <button 
                        onClick={refreshData}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors border border-slate-300 shadow-sm"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>
        </div>
    );
}
