import React, { useState } from 'react';
import { Trophy, Flag, ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

export default function CoinTossModal({
    isOpen,
    teamHome,
    teamAway,
    teamColors,
    onConfirm
}) {
    const [step, setStep] = useState(1);
    const [tossWinner, setTossWinner] = useState(null);
    const [courtLeft, setCourtLeft] = useState(null);
    const [servingTeam, setServingTeam] = useState(null);

    const getTeamStyle = (teamKey, selected) => {
        const color = teamColors?.[teamKey] || '';
        return {
            backgroundColor: selected ? (color || '#4f46e5') : color ? `${color}20` : undefined,
            borderColor: selected ? (color || '#4f46e5') : '#e2e8f0',
            color: selected ? '#ffffff' : color ? '#111827' : undefined,
        };
    };

    const getTeamName = (teamKey) => (teamKey === 'home' ? teamHome : teamAway);

    const renderStepContent = () => {
        const winnerName = tossWinner ? getTeamName(tossWinner) : null;
        switch (step) {
            case 1:
                return (
                    <div className="flex flex-col flex-1 justify-center gap-6">
                        <div className="text-center">
                            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                                <Trophy size={32} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Coin Toss Winner</h2>
                            <p className="text-sm text-slate-500 mt-2">Choose which team won the toss to start the match.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {['home', 'away'].map((teamKey) => {
                                const selected = tossWinner === teamKey;
                                return (
                                    <button
                                        key={teamKey}
                                        onClick={() => setTossWinner(teamKey)}
                                        style={getTeamStyle(teamKey, selected)}
                                        className={`group rounded-3xl border-2 p-5 flex flex-col items-center justify-center transition-all duration-300 shadow-sm ${selected ? 'shadow-indigo-300/50' : 'hover:-translate-y-0.5 hover:shadow-lg'} `}
                                    >
                                        <span className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Winner</span>
                                        <span className="text-lg font-bold">{getTeamName(teamKey)}</span>
                                        {selected && (
                                            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                                                <CheckCircle2 size={14} /> Selected
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">
                            <Sparkles size={18} className="inline-block mb-1 text-amber-500" />
                            If you are unsure, ask the referee to confirm the toss winner before continuing.
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="flex flex-col flex-1 justify-center gap-6">
                        <div className="text-center">
                            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shadow-inner">
                                <Flag size={32} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Court Side Selection</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                {winnerName ? `${winnerName} won the toss.` : 'Select the team on Court A (Left).' }
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {['home', 'away'].map((teamKey) => {
                                const selected = courtLeft === teamKey;
                                return (
                                    <button
                                        key={teamKey}
                                        onClick={() => setCourtLeft(teamKey)}
                                        style={getTeamStyle(teamKey, selected)}
                                        className={`group rounded-3xl border-2 p-5 flex flex-col items-start justify-between transition-all duration-300 shadow-sm ${selected ? 'shadow-sky-300/50' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                                            <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Court A</span>
                                        </div>
                                        <div>
                                            <p className="text-xl font-semibold">{getTeamName(teamKey)}</p>
                                            <p className="text-xs text-slate-500 mt-1">Left side for first set</p>
                                        </div>
                                        {selected && (
                                            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                                                <ArrowLeft size={14} /> Left
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">
                            The toss winner chooses which court side to take. The other team receives the remaining side automatically.
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="flex flex-col flex-1 justify-center gap-6">
                        <div className="text-center">
                            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                                <ArrowRight size={32} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">First Serve</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                Choose which team will serve first in the opening rally.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {['home', 'away'].map((teamKey) => {
                                const selected = servingTeam === teamKey;
                                return (
                                    <button
                                        key={teamKey}
                                        onClick={() => setServingTeam(teamKey)}
                                        style={getTeamStyle(teamKey, selected)}
                                        className={`group rounded-3xl border-2 p-5 flex flex-col items-center justify-center transition-all duration-300 shadow-sm ${selected ? 'shadow-emerald-300/50' : 'hover:-translate-y-0.5 hover:shadow-lg'}`}
                                    >
                                        <span className="text-sm uppercase tracking-[0.3em] text-slate-400 mb-2">Serve First</span>
                                        <span className="text-xl font-semibold">{getTeamName(teamKey)}</span>
                                        {selected && (
                                            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                                                <CheckCircle2 size={14} /> Ready
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-600">
                            Finalize the opening serve so the match can begin with a clear starting team.
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };



    if (!isOpen) return null;

    const handleNext = () => {
        if (step < 3) {
            setStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(prev => prev - 1);
        }
    };

    const handleConfirm = () => {
        if (tossWinner && courtLeft && servingTeam) {
            onConfirm({
                colors: teamColors,
                tossWinner,
                servingTeam,
                isHomeLeft: courtLeft === 'home'
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center px-4 py-6 pointer-events-auto">
            <div className="bg-white w-full max-w-2xl min-h-[520px] p-8 rounded-[32px] flex flex-col justify-between shadow-[0_35px_80px_-30px_rgba(15,23,42,0.5)] border border-slate-100 relative">
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
                    <div className="text-sm uppercase tracking-[0.3em] font-semibold text-slate-500">Step {step} of 3</div>
                    <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden mx-4">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 transition-all" style={{ width: `${(step / 3) * 100}%` }} />
                    </div>
                    <div className="text-sm font-semibold text-slate-700">Coin Toss</div>
                </div>

                <div className="mt-10">{renderStepContent()}</div>

                <div className="pt-6 border-t border-slate-200 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                        onClick={handleBack}
                        disabled={step === 1}
                        className="flex-1 py-3.5 rounded-2xl border border-slate-300 text-slate-700 font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                        Back
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={handleNext}
                            disabled={
                                (step === 1 && !tossWinner) ||
                                (step === 2 && !courtLeft)
                            }
                            className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-semibold transition hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            disabled={!servingTeam}
                            className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-white font-semibold transition hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
