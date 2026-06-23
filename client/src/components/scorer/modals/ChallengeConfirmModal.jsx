import React, { useState } from 'react';
import { X, Video } from 'lucide-react';

const ChallengeConfirmModal = ({
    isOpen,
    activeChallengeRequest,
    matchData,
    teamColors,
    onClose,
    onConfirm,
    onBack
}) => {
    const [confirmedChallengeReason, setConfirmedChallengeReason] = useState(
        activeChallengeRequest?.details?.reason || 'Antenna touch'
    );
    const [confirmedLastAction, setConfirmedLastAction] = useState(
        activeChallengeRequest?.details?.lastAction ?? true
    );

    if (!isOpen || !activeChallengeRequest) return null;

    const isHome = String(activeChallengeRequest.team_id) === String(matchData.teamHomeId);
    const teamBg = isHome ? (teamColors.home || '#ef4444') : (teamColors.away || '#3b82f6');

    return (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 transition-all">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col relative animate-in zoom-in duration-200">

                {/* Postpone button (X) in top right corner */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors z-10"
                    title="Postpone Challenge"
                >
                    <X size={24} />
                </button>

                {/* Modal Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-sans">
                        <Video size={12} className="animate-pulse" />
                        Video Challenge Confirmation
                    </span>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-sans">
                        Team:
                        <span className="font-extrabold uppercase px-2 py-0.5 rounded text-white" style={{ backgroundColor: teamBg }}>
                            {activeChallengeRequest.team_name}
                        </span>
                    </h2>
                </div>

                {/* Confirm Mode (Modify Reason / LastAction) */}
                <div className="p-6 flex-1 flex flex-col space-y-6">
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider font-sans">
                            1. Verify Challenge Reason
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                'Antenna touch',
                                'Block touch',
                                'Net touch',
                                'Floor touch',
                                'Foot fault',
                                'Reaching beyond the net',
                                'Last touch'
                            ].map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setConfirmedChallengeReason(r)}
                                    className={`py-2 px-3 text-left rounded-xl text-xs font-bold border transition-all truncate font-sans ${confirmedChallengeReason === r
                                        ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider font-sans">
                            2. Challenged Action
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmedLastAction(true)}
                                className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all text-center font-sans ${confirmedLastAction === true
                                    ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                Challenging Last Action (YES)
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmedLastAction(false)}
                                className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all text-center font-sans ${confirmedLastAction === false
                                    ? 'bg-indigo-500 border-indigo-500 text-white shadow-md'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                Challenging Previous Action (NO)
                            </button>
                        </div>
                    </div>

                    {/* Confirmation Buttons */}
                    <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                        <button
                            onClick={onBack}
                            className="py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-200 transition-colors font-sans"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => onConfirm(confirmedChallengeReason, confirmedLastAction)}
                            className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] font-sans"
                        >
                            Confirm & Start Review
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ChallengeConfirmModal;
