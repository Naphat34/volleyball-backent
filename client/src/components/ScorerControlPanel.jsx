import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRightLeft, CheckCircle, Users, Disc, Shield, X, Grid, Trophy, MapPin } from 'lucide-react';
import CourtView from '../components/CourtView';

export default function ScorerConsole() {
    const location = useLocation();
    const matchSetupData = location.state?.matchData || {
        title: "Volleyball League 2024",
        matchNumber: "M-001",
        teamHome: "THAILAND",
        teamAway: "JAPAN"
    };

    // --- STATES ---
    const [step, setStep] = useState('COIN_TOSS'); // COIN_TOSS -> LINEUP -> READY
    
    // 1. Coin Toss State
    const [servingTeam, setServingTeam] = useState('home'); 
    const [isHomeLeft, setIsHomeLeft] = useState(true); // true = Home อยู่ซ้าย

    // 2. Roster Data
    const mockPlayers = (teamPrefix) => Array.from({ length: 14 }, (_, i) => ({
        id: `${teamPrefix}-${i + 1}`,
        number: i + 1,
        name: `${teamPrefix} Player ${i + 1}`,
        position: i === 0 ? 'S' : (i < 5 ? 'OH' : 'MB')
    }));

    const homeRoster = useMemo(
        () => mockPlayers(matchSetupData.teamHome.substring(0, 3)),
        [matchSetupData.teamHome]
    );
    const awayRoster = useMemo(
        () => mockPlayers(matchSetupData.teamAway.substring(0, 3)),
        [matchSetupData.teamAway]
    );

    // 3. Lineup State
    const [homeLineup, setHomeLineup] = useState(Array(6).fill(null));
    const [awayLineup, setAwayLineup] = useState(Array(6).fill(null));
    
    // Libero State
    const [homeLiberos, setHomeLiberos] = useState({ l1: null, l2: null });
    const [awayLiberos, setAwayLiberos] = useState({ l1: null, l2: null });

    // 4. Modal State
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [selectionContext, setSelectionContext] = useState({ 
        team: 'home', 
        positionIndex: null, 
        currentRoster: [] 
    });

    // --- LOGIC: Player Selection ---
    const openPlayerSelection = (team, posIndex) => {
        const roster = team === 'home' ? homeRoster : awayRoster;
        setSelectionContext({
            team,
            positionIndex: posIndex,
            currentRoster: roster
        });
        setShowPlayerModal(true);
    };

    const handleSelectPlayer = (player) => {
        const { team, positionIndex } = selectionContext;
        const updateLineup = (setLineup, setLiberos, currentLineup, currentLiberos) => {
            if (positionIndex === 'l1' || positionIndex === 'l2') {
                setLiberos({ ...currentLiberos, [positionIndex]: player });
            } else {
                const newLineup = [...currentLineup];
                newLineup[positionIndex] = player;
                setLineup(newLineup);
            }
        };

        if (team === 'home') updateLineup(setHomeLineup, setHomeLiberos, homeLineup, homeLiberos);
        else updateLineup(setAwayLineup, setAwayLiberos, awayLineup, awayLiberos);
        setShowPlayerModal(false);
    };

    const clearPosition = (team, posIndex) => {
        if (team === 'home') {
            if (posIndex === 'l1' || posIndex === 'l2') setHomeLiberos(prev => ({ ...prev, [posIndex]: null }));
            else { const newL = [...homeLineup]; newL[posIndex] = null; setHomeLineup(newL); }
        } else {
            if (posIndex === 'l1' || posIndex === 'l2') setAwayLiberos(prev => ({ ...prev, [posIndex]: null }));
            else { const newL = [...awayLineup]; newL[posIndex] = null; setAwayLineup(newL); }
        }
    };

    const handleLineupConfirm = () => {
        // Validation check removed for testing ease, uncomment in production
        // if (homeLineup.some(p => p === null) || awayLineup.some(p => p === null)) { ... }
        setStep('READY');
    };

    // --- RENDER HELPERS ---
    const leftTeamName = isHomeLeft ? matchSetupData.teamHome : matchSetupData.teamAway;
    const rightTeamName = isHomeLeft ? matchSetupData.teamAway : matchSetupData.teamHome;
    const courtPositionsLeft = isHomeLeft ? homeLineup : awayLineup;
    const courtPositionsRight = isHomeLeft ? awayLineup : homeLineup;

    // Props for Left Card
    const leftCardProps = isHomeLeft ? {
        teamLabel: 'HOME', teamName: matchSetupData.teamHome, lineup: homeLineup, liberos: homeLiberos,
        onSelectPos: (idx) => openPlayerSelection('home', idx), onClearPos: (idx) => clearPosition('home', idx), color: 'indigo'
    } : {
        teamLabel: 'AWAY', teamName: matchSetupData.teamAway, lineup: awayLineup, liberos: awayLiberos,
        onSelectPos: (idx) => openPlayerSelection('away', idx), onClearPos: (idx) => clearPosition('away', idx), color: 'rose'
    };

    // Props for Right Card
    const rightCardProps = isHomeLeft ? {
        teamLabel: 'AWAY', teamName: matchSetupData.teamAway, lineup: awayLineup, liberos: awayLiberos,
        onSelectPos: (idx) => openPlayerSelection('away', idx), onClearPos: (idx) => clearPosition('away', idx), color: 'rose'
    } : {
        teamLabel: 'HOME', teamName: matchSetupData.teamHome, lineup: homeLineup, liberos: homeLiberos,
        onSelectPos: (idx) => openPlayerSelection('home', idx), onClearPos: (idx) => clearPosition('home', idx), color: 'indigo'
    };

    return (
        <div className="h-screen bg-slate-900 text-white font-sans flex flex-col overflow-hidden">
            
            {/* --- HEADER --- */}
            <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-20 shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-lg">V</div>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{matchSetupData.title}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin size={10}/> Indoor Stadium</div>
                    </div>
                </div>
                
                {/* Scoreboard Preview */}
                <div className="flex items-center gap-6 bg-black/40 px-6 py-1 rounded-lg border border-white/5">
                    <span className="text-indigo-400 font-bold">{matchSetupData.teamHome}</span>
                    <span className="text-xl font-mono font-black tracking-widest text-white">0 - 0</span>
                    <span className="text-rose-400 font-bold">{matchSetupData.teamAway}</span>
                </div>

                <div className="text-right">
                    <div className="text-xs font-bold text-green-400">LIVE</div>
                    <div className="text-[10px] text-slate-500">Scorer Console</div>
                </div>
            </header>

            {/* --- MAIN STAGE --- */}
            <main className="flex-1 relative flex flex-col">
                
                {/* COURT VIEW AREA (Always Visible but dimmed when modal is open) */}
                {step !== 'LINEUP' && (
                    <>
                        <div className="flex-1 bg-slate-900 flex flex-col items-center pt-4 relative">
                            {/* Team Names above court */}
                            <div className="w-full max-w-3xl flex justify-between px-8 mb-1 font-bold text-xl uppercase tracking-widest drop-shadow-lg">
                                <div className={isHomeLeft ? "text-indigo-400" : "text-rose-400"}>{leftTeamName}</div>
                                <div className={!isHomeLeft ? "text-indigo-400" : "text-rose-400"}>{rightTeamName}</div>
                            </div>
                            
                            {/* The Court */}
                            <CourtView homePositions={courtPositionsLeft} awayPositions={courtPositionsRight} />
                            
                            {/* Footer / Status Bar */}
                            {step !== 'READY' && (
                                <div className="absolute bottom-4 text-slate-500 text-xs">
                                    Waiting for match start...
                                </div>
                            )}
                        </div>
                        {/* 4. GAME READY CONTROLS (Bottom Panel) */}
                        {step === 'READY' && (
                            <div className="absolute bottom-0 w-full bg-slate-800 border-t border-slate-700 p-4 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                                <div className="max-w-4xl mx-auto flex items-center justify-center gap-8 h-24 text-slate-500">
                                    <div className="border border-dashed border-slate-600 rounded-lg px-8 py-4 bg-slate-900/50">
                                        Score Controls & Match Log Component
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* === MODAL LAYER === */}

                {/* 1. COIN TOSS MODAL */}
                {step === 'COIN_TOSS' && (
                    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center gap-2">
                                <Disc className="text-yellow-500" />
                                <h2 className="font-bold text-lg">Pre-Match Decision</h2>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                {/* First Serve */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">First Service</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setServingTeam('home')} className={`py-3 px-4 rounded-lg border transition-all font-bold ${servingTeam === 'home' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            {matchSetupData.teamHome}
                                        </button>
                                        <button onClick={() => setServingTeam('away')} className={`py-3 px-4 rounded-lg border transition-all font-bold ${servingTeam === 'away' ? 'bg-rose-600/20 border-rose-500 text-rose-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            {matchSetupData.teamAway}
                                        </button>
                                    </div>
                                </div>

                                {/* Court Side */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Court Assignment</label>
                                    <div className="flex items-center justify-between bg-slate-800 rounded-xl p-2 border border-slate-700">
                                        <div className="flex-1 text-center py-2">
                                            <div className={`font-bold ${isHomeLeft ? 'text-indigo-400' : 'text-rose-400'}`}>{leftTeamName}</div>
                                            <div className="text-[10px] text-slate-500">Left Court</div>
                                        </div>
                                        <button onClick={() => setIsHomeLeft(!isHomeLeft)} className="p-2 bg-slate-700 rounded-full text-slate-300 hover:bg-slate-600 hover:text-white transition shadow-lg">
                                            <ArrowRightLeft size={18} />
                                        </button>
                                        <div className="flex-1 text-center py-2">
                                            <div className={`font-bold ${!isHomeLeft ? 'text-indigo-400' : 'text-rose-400'}`}>{rightTeamName}</div>
                                            <div className="text-[10px] text-slate-500">Right Court</div>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => setStep('LINEUP')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all mt-2">
                                    Confirm & Set Lineups
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. LINEUP SELECTION MODAL */}
                {step === 'LINEUP' && (
                    <div className="flex-1 bg-slate-950 flex flex-col">
                        {/* Modal Header */}
                        <div className="p-4 flex justify-between items-center max-w-6xl mx-auto w-full">
                            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                                <Users className="text-indigo-400"/> Starting Lineups
                            </h2>
                            <button onClick={handleLineupConfirm} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-bold shadow-lg shadow-green-500/20 flex items-center gap-2 transition active:scale-95">
                                <CheckCircle size={18} /> Start Match
                            </button>
                        </div>

                        {/* Lineup Content */}
                        <div className="flex-1 overflow-y-auto px-4 pb-20">
                            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Court Lineup */}
                                <LineupCard {...leftCardProps} sideLabel="LEFT COURT" />
                                {/* Right Court Lineup */}
                                <LineupCard {...rightCardProps} sideLabel="RIGHT COURT" />
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. PLAYER SELECTOR POPUP */}
                {showPlayerModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-600 w-full max-w-sm overflow-hidden">
                            <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-700">
                                <span className="font-bold text-slate-200 flex items-center gap-2"><Grid size={16}/> Select Player</span>
                                <button onClick={() => setShowPlayerModal(false)}><X size={20} className="text-slate-400 hover:text-white"/></button>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-5 gap-3">
                                    {selectionContext.currentRoster.map(player => {
                                        const isHome = selectionContext.team === 'home';
                                        const currentLineup = isHome ? homeLineup : awayLineup;
                                        const currentLiberos = isHome ? homeLiberos : awayLiberos;
                                        const isSelected = currentLineup.some(p => p?.id === player.id) || currentLiberos.l1?.id === player.id || currentLiberos.l2?.id === player.id;
                                        
                                        return (
                                            <button 
                                                key={player.id} onClick={() => !isSelected && handleSelectPlayer(player)} disabled={isSelected}
                                                className={`aspect-square rounded-lg font-black text-lg flex items-center justify-center transition-all ${isSelected ? 'bg-slate-700 text-slate-500 opacity-40' : 'bg-slate-600 hover:bg-indigo-500 text-white shadow-md hover:scale-105'}`}
                                            >
                                                {player.number}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// --- SUB COMPONENT: Lineup Card ---
const LineupCard = ({ teamLabel, teamName, lineup, liberos, onSelectPos, onClearPos, color, sideLabel }) => {
    const themeColor = color === 'indigo' ? 'text-indigo-400 border-indigo-500/30' : 'text-rose-400 border-rose-500/30';
    const btnColor = color === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-rose-600 hover:bg-rose-500';
    const decoColor = color === 'indigo' ? 'bg-indigo-500/10' : 'bg-rose-500/10';

    return (
        <div className={`bg-slate-800/80 rounded-2xl p-5 border ${themeColor} shadow-xl relative overflow-hidden`}>
            {/* Background Decoration */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 ${decoColor} rounded-full blur-2xl pointer-events-none`}></div>

            <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                <div>
                    <div className="text-[10px] font-bold text-slate-500 tracking-wider mb-1">{teamLabel} • {sideLabel}</div>
                    <h3 className={`text-2xl font-black uppercase tracking-tight text-white leading-none`}>{teamName}</h3>
                </div>
                <Trophy size={20} className="text-slate-600" />
            </div>
            
            {/* Starting 6 Grid (Rotated visually to match court logic roughly) */}
            <div className="mb-2 text-xs font-bold text-slate-400 uppercase text-center">Starting Six</div>
            <div className="grid grid-cols-3 gap-3 mb-6 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                {[3, 2, 1, 4, 5, 0].map((posIndex) => { 
                    const player = lineup[posIndex];
                    return (
                        <div key={posIndex} className="flex flex-col items-center">
                            <button 
                                onClick={() => player ? onClearPos(posIndex) : onSelectPos(posIndex)}
                                className={`
                                    w-14 h-14 rounded-full flex items-center justify-center text-xl font-black border-2 transition-all shadow-lg
                                    ${player 
                                        ? `${btnColor} border-transparent text-white` 
                                        : 'bg-slate-800 border-dashed border-slate-600 text-slate-600 hover:border-slate-400 hover:text-slate-400'
                                    }
                                `}
                            >
                                {player ? player.number : <span className="text-2xl font-light">+</span>}
                            </button>
                            <div className="mt-1 flex flex-col items-center">
                                <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-1.5 rounded">P{posIndex + 1}</span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Libero Section */}
            <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 mb-2 text-yellow-500 font-bold text-[10px] uppercase tracking-wider">
                    <Shield size={12}/> Liberos
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {['l1', 'l2'].map((key) => (
                        <div key={key} className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700 pr-3">
                             <div className="bg-slate-700 text-slate-400 text-[10px] font-bold w-6 h-8 rounded flex items-center justify-center uppercase">{key}</div>
                             {liberos[key] ? (
                                <div className="flex-1 flex justify-between items-center">
                                    <span className="font-bold text-white text-lg">#{liberos[key].number}</span>
                                    <button onClick={() => onClearPos(key)} className="text-slate-500 hover:text-rose-400"><X size={14}/></button>
                                </div>
                            ) : (
                                <button onClick={() => onSelectPos(key)} className="flex-1 text-left text-xs text-slate-500 hover:text-indigo-400 font-medium">+ Add</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
