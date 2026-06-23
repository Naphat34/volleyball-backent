import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

export default function ScoreViewSpectator() {
    const { matchId } = useParams();

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
    const [score, setScore] = useState(() => loadState('score', { home: 0, away: 0 }));
    const [setsWon, setSetsWon] = useState(() => loadState('setsWon', { home: 0, away: 0 }));
    const [timeouts, setTimeouts] = useState(() => loadState('timeouts', { home: 0, away: 0 }));
    const [substitutions, setSubstitutions] = useState(() => loadState('substitutions', { home: 0, away: 0 }));
    const [servingTeam, setServingTeam] = useState(() => loadState('servingTeam', null));
    const [isHomeLeft, setIsHomeLeft] = useState(() => loadState('isHomeLeft', true));
    const [teamColors, setTeamColors] = useState(() => loadState('teamColors', { home: '#4f46e5', away: '#e11d48' }));

    const refreshData = useCallback(async () => {
        try {
            const res = await api.getLiveState(matchId);
            const state = res.data;

            setMatchData(state.matchData || { teamHome: "HOME", teamAway: "AWAY", currentSet: 1 });
            setScore(state.score || { home: 0, away: 0 });
            setSetsWon(state.setsWon || { home: 0, away: 0 });
            setTimeouts(state.timeouts || { home: 0, away: 0 });
            setSubstitutions(state.substitutions || { home: 0, away: 0 });
            setServingTeam(state.servingTeam || null);
            setIsHomeLeft(state.isHomeLeft !== undefined ? state.isHomeLeft : true);
            setTeamColors(state.teamColors || { home: '#4f46e5', away: '#e11d48' });
        } catch (error) {
            console.error("Failed to refresh data from server:", error);
        }
    }, [matchId]);

    // --- EFFECT: LIVE POLLING ---
    useEffect(() => {
        const timeout = setTimeout(() => {
            refreshData();
        }, 0);
        const interval = setInterval(refreshData, 1000); // 1 second fast polling for live view
        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [matchId, refreshData]);

    const getLeftTeam = () => isHomeLeft
        ? { name: matchData.teamHome, score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home }
        : { name: matchData.teamAway, score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away };

    const getRightTeam = () => isHomeLeft
        ? { name: matchData.teamAway, score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away }
        : { name: matchData.teamHome, score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home };

    const leftTeam = getLeftTeam();
    const rightTeam = getRightTeam();

    const isLeftServing = servingTeam === leftTeam.code;
    const isRightServing = servingTeam === rightTeam.code;

    // A helper to generate the timeout dots based on how many they've taken (max 2 per set usually)
    const renderTimeouts = (taken) => {
        const maxTimeouts = 2;
        const dots = [];
        for(let i=0; i<maxTimeouts; i++) {
            dots.push(
                <div key={i} className={`w-6 h-6 rounded-full border-4 border-white ${
                    i < taken ? 'bg-red-500' : 'bg-transparent'
                }`} />
            );
        }
        return dots;
    }

    return (
        <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden font-sans relative selection:bg-transparent cursor-default">
            
            {/* Background design */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black pointer-events-none" />
            
            {/* Ambient lighting from team colors */}
            <div className="absolute top-0 left-0 w-1/2 h-full opacity-20 filter blur-[150px] transition-colors duration-1000" style={{backgroundColor: leftTeam.color}}></div>
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 filter blur-[150px] transition-colors duration-1000" style={{backgroundColor: rightTeam.color}}></div>

            {/* Main Scoreboard Layout */}
            <div className="relative z-10 flex flex-col h-full p-4 sm:p-8 md:p-16 gap-6 sm:gap-8 overflow-y-auto lg:overflow-hidden">
                
                {/* Header (Sets & Tournament info) */}
                <div className="flex justify-center items-center shrink-0">
                    <div className="bg-white/10 backdrop-blur-md px-8 py-2 md:px-12 md:py-3 rounded-full border border-white/20 shadow-2xl flex items-center gap-4 md:gap-6">
                        <span className="text-xl md:text-3xl font-extrabold tracking-widest text-slate-300 uppercase">SET</span>
                        <span className="text-3xl md:text-5xl font-semibold text-white">{matchData.currentSet}</span>
                    </div>
                </div>

                {/* Score Area */}
                <div className="flex-1 flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8 mx-auto w-full max-w-screen-2xl">
                    
                    {/* Left Team */}
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        {/* Serving Indicator */}
                        <div className={`transition-opacity duration-300 absolute top-[-30px] lg:top-[-40px] left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-3 ${isLeftServing ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,1)] animate-pulse" />
                            <span className="text-yellow-400 uppercase tracking-widest font-bold text-xs md:text-sm">Serving</span>
                        </div>

                        {/* Team Name Box */}
                        <div className="w-full bg-gradient-to-r from-black/60 to-black/30 backdrop-blur-xl border-t-8 rounded-b-3xl shadow-2xl flex flex-col overflow-hidden" style={{ borderColor: leftTeam.color }}>
                            <div className="p-4 sm:p-8 pb-2 sm:pb-4 text-center">
                                <h1 className="text-3xl sm:text-5xl md:text-7xl font-semibold uppercase truncate text-white drop-shadow-lg tracking-tight">
                                    {leftTeam.name}
                                </h1>
                            </div>

                            {/* Score */}
                            <div className="flex-1 flex items-center justify-center py-4 sm:py-8">
                                <span className="text-7xl sm:text-[10rem] md:text-[14rem] lg:text-[16rem] xl:text-[20rem] leading-none font-semibold text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)] tracking-tighter" style={{ textShadow: `0 0 60px ${leftTeam.color}aa` }}>
                                    {leftTeam.score}
                                </span>
                            </div>

                            {/* Sets Won & Timeouts */}
                            <div className="flex items-center justify-between p-4 sm:p-8 bg-black/40 border-t border-white/10">
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest">Timeouts</span>
                                    <div className="flex gap-1 sm:gap-2">
                                        {renderTimeouts(timeouts[leftTeam.code])}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-3xl md:text-[3rem] font-semibold text-yellow-400 leading-none">{leftTeam.sets}</span>
                                    <span className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Sets Won</span>
                                </div>
                                <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-xl md:text-3xl font-semibold text-white leading-none">{substitutions[leftTeam.code]}</span>
                                    <span className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Subs</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Divider / VS indicator */}
                    <div className="flex flex-row lg:flex-col justify-center items-center w-full lg:w-32 shrink-0 py-2 lg:py-0">
                        <div className="h-1 lg:h-1/3 w-1/3 lg:w-1.5 bg-gradient-to-r lg:bg-gradient-to-b from-transparent to-white/20 rounded-full" />
                        <div className="mx-4 lg:my-8 text-xl lg:text-4xl font-semibold text-white/30 italic">VS</div>
                        <div className="h-1 lg:h-1/3 w-1/3 lg:w-1.5 bg-gradient-to-l lg:bg-gradient-to-t from-transparent to-white/20 rounded-full" />
                    </div>

                    {/* Right Team */}
                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        {/* Serving Indicator */}
                        <div className={`transition-opacity duration-300 absolute top-[-30px] lg:top-[-40px] left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-3 ${isRightServing ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,1)] animate-pulse" />
                            <span className="text-yellow-400 uppercase tracking-widest font-bold text-xs md:text-sm">Serving</span>
                        </div>

                        {/* Team Name Box */}
                        <div className="w-full bg-gradient-to-l from-black/60 to-black/30 backdrop-blur-xl border-t-8 rounded-b-3xl shadow-2xl flex flex-col overflow-hidden" style={{ borderColor: rightTeam.color }}>
                            <div className="p-4 sm:p-8 pb-2 sm:pb-4 text-center">
                                <h1 className="text-3xl sm:text-5xl md:text-7xl font-semibold uppercase truncate text-white drop-shadow-lg tracking-tight">
                                    {rightTeam.name}
                                </h1>
                            </div>

                            {/* Score */}
                            <div className="flex-1 flex items-center justify-center py-4 sm:py-8">
                                <span className="text-7xl sm:text-[10rem] md:text-[14rem] lg:text-[16rem] xl:text-[20rem] leading-none font-semibold text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)] tracking-tighter" style={{ textShadow: `0 0 60px ${rightTeam.color}aa` }}>
                                    {rightTeam.score}
                                </span>
                            </div>

                            {/* Sets Won & Timeouts */}
                            <div className="flex items-center justify-between p-4 sm:p-8 bg-black/40 border-t border-white/10 flex-row-reverse">
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest">Timeouts</span>
                                    <div className="flex gap-1 sm:gap-2 flex-row-reverse">
                                        {renderTimeouts(timeouts[rightTeam.code])}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-3xl md:text-[3rem] font-semibold text-yellow-400 leading-none">{rightTeam.sets}</span>
                                    <span className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Sets Won</span>
                                </div>
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="text-xl md:text-3xl font-semibold text-white leading-none">{substitutions[rightTeam.code]}</span>
                                    <span className="text-[9px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Subs</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
    );
}
