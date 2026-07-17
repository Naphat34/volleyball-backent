import React, { useState } from 'react';
import {
    PenTool, Trophy, Flag, Clock, Users, RotateCcw, AlertTriangle
} from 'lucide-react';

const CompactInjuryIcon = () => (
    <div className="relative h-11 w-11">
        <span className="absolute inset-0 rounded-full bg-blue-100" />
        <span className="absolute inset-[3px] rounded-full border-[3px] border-blue-500 bg-white shadow-sm" />
        <span className="absolute left-1/2 top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-orange-500" />
        <span className="absolute left-1/2 top-1/2 h-2 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-orange-500" />
    </div>
);

const CompactSanctionIcon = () => (
    <div className="relative h-10 w-11">
        <span className="absolute right-0 top-1 h-7 w-5 rounded-[4px] bg-amber-300 shadow-sm" />
        <span className="absolute right-2 top-0 h-8 w-5 rounded-[4px] bg-orange-500 shadow-md" />
        <span className="absolute bottom-1 left-2 h-3 w-5 rounded-full bg-sky-100" />
        <span className="absolute bottom-0 left-5 h-5 w-5 rounded-full border-2 border-sky-200 bg-white shadow-sm" />
    </div>
);

const OfficialActionPill = ({ label, icon, disabled, onClick, accentClass = '' }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`relative flex h-[58px] w-[156px] overflow-hidden rounded-xl border bg-white px-3 py-2 text-left shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.16)] active:scale-95 disabled:pointer-events-none disabled:opacity-45 ${accentClass || 'border-slate-200'}`}
    >
        <span className="relative z-10 flex min-w-0 flex-1 items-center text-[14px] font-semibold leading-[1.12] text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.65)]">{label}</span>
        <span className="relative z-10 flex shrink-0 items-center justify-center">{React.createElement(icon)}</span>
    </button>
);

const TeamChoiceModal = ({ isOpen, title, subtitle, leftTeam, rightTeam, onCancel, onSelect }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                        <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    >
                        <XIcon />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {[leftTeam, rightTeam].map((team) => (
                        <button
                            key={team.code}
                            type="button"
                            onClick={() => onSelect(team.code)}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md active:scale-95"
                        >
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {team.code}
                            </span>
                            <span className="mt-1 block truncate text-base font-bold text-slate-950">
                                {team.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const ControlActionsPanel = ({
    workflowStep,
    onConfirmSetEnd,
    isEndingSet,
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
    const [showInjuryTeamPicker, setShowInjuryTeamPicker] = useState(false);
    const officialActionsDisabled = workflowStep === 'RALLY' || workflowStep === 'LINEUP' || workflowStep === 'CHALLENGE_REVIEW';
    const officialActionsVisible = ['SERVING', 'SERVER_SELECT', 'READY'].includes(workflowStep);

    return (
        <div className="h-auto min-h-[120px] py-2 lg:h-44 bg-slate-100 border-t-[4px] border-slate-300 shadow-inner p-3 flex flex-col lg:flex-row justify-between items-center gap-3 shrink-0 relative z-20 select-none">

            {workflowStep === 'SET_ENDING'  ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="font-semibold text-rose-600 uppercase tracking-widest text-lg mb-2 animate-pulse">SET POINT REACHED</span>
                    <button
                        onClick={onConfirmSetEnd}
                        disabled={isEndingSet}
                        className="px-16 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xl shadow-lg rounded-xl transition-all active:scale-95"
                    >
                        {isEndingSet ? 'ENDING...' : 'END SET'}
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
                    {/* ---------------- CENTER CONTROLS ---------------- */}
                    <div className="flex-1 grid h-full w-full grid-cols-1 items-center gap-3 px-1 lg:grid-cols-[1fr_minmax(260px,420px)_1fr]">
                        <div className="order-2 flex justify-center lg:order-1 lg:justify-start">
                            {officialActionsVisible && (
                                <div className="flex flex-col items-center gap-1.5 lg:items-start">
                                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                        Injury
                                    </div>
                                    <OfficialActionPill
                                        label="Exceptional sub. / Injury"
                                        icon={CompactInjuryIcon}
                                        disabled={officialActionsDisabled}
                                        onClick={() => setShowInjuryTeamPicker(true)}
                                        accentClass="border-blue-100"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="order-1 flex min-w-0 flex-col items-center justify-center lg:order-2">
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
                            <div className="mt-2 flex items-center gap-6">
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

                        <div className="order-3 flex justify-center lg:justify-end">
                            {officialActionsVisible && (
                                <div className="flex flex-col items-center gap-1.5 lg:items-end">
                                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Sanction
                                </div>
                                <OfficialActionPill
                                    label="Sanction"
                                    icon={CompactSanctionIcon}
                                    onClick={() => { setSanctionTeam(leftTeam.code); setShowSanctionModal(true); }}
                                    disabled={officialActionsDisabled}
                                    accentClass="border-rose-100"
                                />
                            </div>
                            )}
                        </div>

                        <TeamChoiceModal
                            isOpen={showInjuryTeamPicker}
                            title="Exceptional Substitution / Injury"
                            subtitle="Select the team before opening injury substitution."
                            leftTeam={leftTeam}
                            rightTeam={rightTeam}
                            onCancel={() => setShowInjuryTeamPicker(false)}
                            onSelect={(teamCode) => {
                                setShowInjuryTeamPicker(false);
                                handleInjury(teamCode);
                            }}
                        />
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
