import React from 'react';
import {
    PenTool, Trophy, Flag, Clock, Users, RotateCcw, AlertTriangle
} from 'lucide-react';
import { getContrastColorHex } from '../../../utils/colorUtils';

const ControlActionsPanel = ({
    workflowStep,
    pendingSetWinner,
    finishSet,
    startNextSet,
    handleFinishMatch,
    runCoinTossFlow,
    leftTeam,
    rightTeam,
    handleInjury,
    setSanctionTeam,
    setShowSanctionModal,
    currentChallengeReview,
    setCurrentChallengeReview,
    isEditingChallengeReason,
    setIsEditingChallengeReason,
    handleFaultAdmission,
    handleChallengeOutcome,
    handleStartMatch,
    setWorkflowStep,
    setShowLineupModal,
    handleReplayRally,
    matchData
}) => {
    return (
        <div className="h-auto min-h-[120px] py-3 lg:h-44 bg-slate-100 border-t-[4px] border-slate-300 shadow-inner p-3 flex flex-col lg:flex-row justify-between items-center gap-4 shrink-0 relative z-20 select-none">

            {workflowStep === 'SET_ENDING' ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="font-semibold text-rose-600 uppercase tracking-widest text-lg mb-2 animate-pulse">SET POINT REACHED</span>
                    <button
                        onClick={() => finishSet(pendingSetWinner.winnerCode, pendingSetWinner.finalScore)}
                        className="px-16 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl shadow-lg rounded-xl transition-all active:scale-95"
                    >
                        END SET
                    </button>
                </div>
            ) : workflowStep === 'SET_FINISHED' ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="font-semibold text-slate-800 uppercase tracking-tight text-lg mb-2">Set {matchData.currentSet} Concluded</span>
                    <button onClick={startNextSet} className="px-12 py-3 bg-[#3b82f6] hover:bg-blue-600 text-white font-bold shadow-md">
                        START NEXT SET
                    </button>
                </div>
            ) : workflowStep === 'MATCH_FINISHED' ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="font-semibold text-slate-800 uppercase tracking-tight text-lg mb-4">End off match</span>
                    <button onClick={handleFinishMatch} className="px-16 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl shadow-xl rounded-xl transition-all active:scale-95 flex items-center gap-3">
                        <PenTool size={24} /> SIGNATURES
                    </button>
                </div>
            ) : workflowStep === 'COIN_TOSS' ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="font-semibold text-slate-800 uppercase tracking-tight text-lg mb-2">coin toss </span>
                    <button onClick={runCoinTossFlow} className="px-12 py-3 bg-[#eab308] hover:bg-yellow-600 text-white font-bold shadow-md rounded-xl transition-all active:scale-95 flex items-center gap-2">
                        <Trophy size={20} /> Coin Toss
                    </button>
                </div>
            ) : workflowStep === 'RALLY' || workflowStep === 'SERVING' || workflowStep === 'SERVER_SELECT' || workflowStep === 'READY' || workflowStep === 'LINEUP' || workflowStep === 'CHALLENGE_REVIEW' ? (
                <>
                    {/* ---------------- LEFT TEAM CONTROLS ---------------- */}
                    <div className="hidden lg:flex gap-2 h-full">
                        <div className="flex flex-col gap-1 w-[130px] justify-center">
                            <button
                                className="bg-indigo-700 border border-indigo-900 text-white py-1.5 text-[11px] font-bold hover:bg-indigo-800 disabled:opacity-50 leading-tight rounded shadow-sm"
                                disabled={workflowStep === 'RALLY' || workflowStep === 'LINEUP' || workflowStep === 'CHALLENGE_REVIEW'}
                                onClick={() => handleInjury(leftTeam.code)}
                            >
                                Injury
                            </button>
                            <button
                                onClick={() => { setSanctionTeam(leftTeam.code); setShowSanctionModal(true); }}
                                disabled={workflowStep === 'RALLY' || workflowStep === 'LINEUP' || workflowStep === 'CHALLENGE_REVIEW'}
                                className="bg-amber-500 border border-amber-600 text-white py-1.5 text-[11px] font-bold hover:bg-amber-600 disabled:opacity-50 rounded shadow-sm"
                            >
                                Sanction
                            </button>
                        </div>
                    </div>

                    {/* ---------------- CENTER CONTROLS ---------------- */}
                    <div className="flex-1 flex flex-col items-center justify-center h-full relative border-x border-slate-300 px-4">
                        {/* Main Center Button Logic */}
                        {workflowStep === 'CHALLENGE_REVIEW' && currentChallengeReview ? (
                            <div className="w-full flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl p-3 shadow-md z-30">
                                <div className="flex items-center gap-1 text-rose-500 font-extrabold text-[10px] uppercase mb-1.5 animate-pulse">
                                    <Flag size={12} />
                                    <span>Challenge Review</span>
                                </div>

                                <div className="text-center mb-2">
                                    <h4 className="text-xs font-black text-slate-800 uppercase">
                                        {currentChallengeReview.team === 'home' ? matchData.teamHome : matchData.teamAway}
                                    </h4>
                                </div>

                                <div className="bg-slate-50 w-full rounded-lg px-2 py-1.5 border border-slate-100 flex flex-col items-center mb-2">
                                    <div className="flex items-center gap-1.5">
                                        {isEditingChallengeReason ? (
                                            <select
                                                value={currentChallengeReview.reason}
                                                onChange={(e) => {
                                                    setCurrentChallengeReview(prev => ({ ...prev, reason: e.target.value }));
                                                    setIsEditingChallengeReason(false);
                                                }}
                                                className="text-[10px] p-0.5 border rounded bg-white font-black"
                                            >
                                                {[
                                                    'Antenna touch',
                                                    'Block touch',
                                                    'Net touch',
                                                    'Floor touch',
                                                    'Foot fault',
                                                    'Reaching beyond the net',
                                                    'Last touch'
                                                ].map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <>
                                                <span className="text-[11px] font-black text-blue-700">{currentChallengeReview.reason}</span>
                                                <button
                                                    onClick={() => setIsEditingChallengeReason(true)}
                                                    className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    <PenTool size={10} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">
                                        {currentChallengeReview.lastAction ? 'Last Action' : 'Previous Action'}
                                    </span>
                                </div>

                                {/* Fault Admission (Double click) */}
                                <button
                                    onDoubleClick={handleFaultAdmission}
                                    className="w-full mb-2 py-1 bg-orange-50 border border-dashed border-orange-300 hover:bg-orange-100/50 text-orange-800 rounded-lg flex flex-col items-center justify-center transition-all select-none group"
                                >
                                    <span className="text-[10px] font-bold uppercase">Fault Admission</span>
                                    <span className="text-[7px] text-orange-500 mt-0.5 opacity-80">Double-click if player admits fault</span>
                                </button>

                                {/* Outcome Selection */}
                                <div className="w-full">
                                    <div className="grid grid-cols-3 gap-1">
                                        <button
                                            onClick={() => handleChallengeOutcome('SUCCESSFUL')}
                                            className="py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded text-[9px] shadow-sm transition-all"
                                        >
                                            Successful
                                        </button>
                                        <button
                                            onClick={() => handleChallengeOutcome('UNSUCCESSFUL')}
                                            className="py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded text-[9px] shadow-sm transition-all"
                                        >
                                            Unsuccessful
                                        </button>
                                        <button
                                            onClick={() => handleChallengeOutcome('INCONCLUSIVE')}
                                            className="py-1 bg-slate-500 hover:bg-slate-600 text-white font-bold rounded text-[9px] shadow-sm transition-all"
                                        >
                                            Inconclusive
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : workflowStep === 'READY' ? (
                            <button onClick={handleStartMatch} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xl py-3 px-10 shadow-md w-full max-w-xs transition-colors mt-4">
                                START MATCH
                            </button>
                        ) : workflowStep === 'SERVING' ? (
                            <div className="flex flex-col items-center w-full max-w-sm mt-2">
                                <div className="text-indigo-700 font-bold text-sm flex items-center gap-2 mb-1.5 uppercase">
                                    <Clock size={18} />
                                    <span>After referee whistle</span>
                                </div>
                                <button
                                    onClick={() => setWorkflowStep('RALLY')}
                                    className="bg-indigo-700 hover:bg-indigo-800 text-white font-black text-3xl py-3 w-full shadow-md transition-colors"
                                >
                                    Serve
                                </button>
                            </div>
                        ) : workflowStep === 'RALLY' ? (
                            <div className="flex flex-col items-center justify-center mt-4 text-center">
                                <span className="text-indigo-700 font-bold text-lg uppercase tracking-widest animate-pulse">Rally in progress...</span>
                                <span className="text-slate-500 text-xs font-semibold mt-1">Use side panels to score or manage actions</span>
                            </div>
                        ) : workflowStep === 'LINEUP' ? (
                            <button
                                onClick={() => setShowLineupModal(true)}
                                className="flex flex-col items-center justify-center gap-1 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-black text-2xl py-3 px-12 shadow-md w-full max-w-xs transition-all duration-200 active:scale-95 group rounded-2xl"
                            >
                                <Users size={24} className="group-hover:scale-110 transition-transform" />
                                <span>Start Line Up</span>
                            </button>
                        ) : (
                            <div className="text-slate-500 font-bold uppercase tracking-widest mt-4">Complete Lineup</div>
                        )}

                        {/* Game Phase Utility Buttons (Always Visible) */}
                        {['SERVING', 'RALLY', 'READY'].includes(workflowStep) && (
                            <div className="mt-4 flex items-center gap-6">
                                {workflowStep === 'RALLY' && (
                                    <button
                                        onClick={handleReplayRally}
                                        className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold uppercase tracking-widest text-xs transition-colors"
                                    >
                                        <RotateCcw size={14} />
                                        Replay rally
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ---------------- RIGHT TEAM CONTROLS ---------------- */}
                    <div className="hidden lg:flex gap-2 h-full">
                        <div className="flex flex-col gap-1 w-[130px] justify-center">
                            <button
                                className="bg-rose-700 border border-rose-900 text-white py-1.5 text-[11px] font-bold hover:bg-rose-800 disabled:opacity-50 leading-tight rounded shadow-sm"
                                disabled={workflowStep === 'RALLY' || workflowStep === 'LINEUP' || workflowStep === 'CHALLENGE_REVIEW'}
                                onClick={() => handleInjury(rightTeam.code)}
                            >
                                Injury
                            </button>
                            <button
                                onClick={() => { setSanctionTeam(rightTeam.code); setShowSanctionModal(true); }}
                                disabled={workflowStep === 'RALLY' || workflowStep === 'LINEUP' || workflowStep === 'CHALLENGE_REVIEW'}
                                className="bg-amber-500 border border-amber-600 text-white py-1.5 text-[11px] font-bold hover:bg-amber-600 disabled:opacity-50 rounded shadow-sm"
                            >
                                Sanction
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex justify-center items-center gap-2 text-slate-400">
                    <AlertTriangle size={24} className="opacity-50" />
                    <span className="font-bold text-sm uppercase tracking-widest">Game Controls Paused</span>
                </div>
            )}
        </div>
    );
};

export default ControlActionsPanel;
