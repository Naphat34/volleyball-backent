import React, { useState } from 'react';

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

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="flex flex-col flex-1 justify-center">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">COIN TOSS WINNER</h2>
                            <p className="text-xs text-slate-500 mt-1">Select the winner of the coin toss:</p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setTossWinner('home')}
                                className={`flex-1 py-4 border-2 rounded-xl text-base font-bold transition-all ${
                                    tossWinner === 'home'
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-600 hover:bg-indigo-50/50'
                                }`}
                            >
                                {teamHome}
                            </button>
                            <button
                                onClick={() => setTossWinner('away')}
                                className={`flex-1 py-4 border-2 rounded-xl text-base font-bold transition-all ${
                                    tossWinner === 'away'
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-600 hover:bg-indigo-50/50'
                                }`}
                            >
                                {teamAway}
                            </button>
                        </div>
                    </div>
                );
            case 2: {
                const winnerName = tossWinner === 'home' ? teamHome : teamAway;
                return (
                    <div className="flex flex-col flex-1 justify-center">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">COURT SIDE</h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Winner: <span className="text-indigo-600 font-bold">{winnerName}</span>
                            </p>
                            <p className="text-sm font-semibold text-slate-600 mt-2">
                                Which team is on <span className="text-sky-500">Court Side A (Left)</span>?
                            </p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setCourtLeft('home')}
                                className={`flex-1 py-3 px-2 border-2 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center ${
                                    courtLeft === 'home'
                                        ? 'border-sky-500 bg-sky-500 text-white shadow-lg'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-sky-500 hover:bg-sky-50/50'
                                }`}
                            >
                                <span className={`text-[10px] font-medium mb-1 ${courtLeft === 'home' ? 'text-white/80' : 'text-slate-400'}`}>
                                    Court A (Left)
                                </span>
                                {teamHome}
                            </button>
                            <button
                                onClick={() => setCourtLeft('away')}
                                className={`flex-1 py-3 px-2 border-2 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center ${
                                    courtLeft === 'away'
                                        ? 'border-sky-500 bg-sky-500 text-white shadow-lg'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-sky-500 hover:bg-sky-50/50'
                                }`}
                            >
                                <span className={`text-[10px] font-medium mb-1 ${courtLeft === 'away' ? 'text-white/80' : 'text-slate-400'}`}>
                                    Court A (Left)
                                </span>
                                {teamAway}
                            </button>
                        </div>
                    </div>
                );
            }
            case 3:
                return (
                    <div className="flex flex-col flex-1 justify-center">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">FIRST SERVE</h2>
                            <p className="text-xs text-slate-500 mt-1">Which team will serve first?</p>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setServingTeam('home')}
                                className={`flex-1 py-4 border-2 rounded-xl text-base font-bold transition-all ${
                                    servingTeam === 'home'
                                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50'
                                }`}
                            >
                                {teamHome}
                            </button>
                            <button
                                onClick={() => setServingTeam('away')}
                                className={`flex-1 py-4 border-2 rounded-xl text-base font-bold transition-all ${
                                    servingTeam === 'away'
                                        ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50'
                                }`}
                            >
                                {teamAway}
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center pointer-events-auto">
            <div className="bg-white w-[450px] h-[450px] p-[30px] rounded-[24px] flex flex-col justify-between box-border shadow-2xl border border-slate-100 relative">
                {/* Step indicator */}
                <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5">
                    {[1, 2, 3].map(s => (
                        <div
                            key={s}
                            className={`w-8 h-1.5 rounded-full transition-all duration-300 ${
                                s <= step ? 'bg-indigo-600' : 'bg-slate-200'
                            }`}
                        />
                    ))}
                </div>

                {/* Main Content Area */}
                {renderStepContent()}

                {/* Actions Footer */}
                <div className="flex gap-3 mt-6">
                    {step > 1 && (
                        <button
                            onClick={handleBack}
                            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-colors"
                        >
                            BACK
                        </button>
                    )}
                    {step < 3 ? (
                        <button
                            onClick={handleNext}
                            disabled={
                                (step === 1 && !tossWinner) ||
                                (step === 2 && !courtLeft)
                            }
                            className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                        >
                            NEXT
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            disabled={!servingTeam}
                            className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                        >
                            CONFIRM
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
