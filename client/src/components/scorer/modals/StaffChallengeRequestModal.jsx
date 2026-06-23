import React from 'react';
import { X, Video, AlertTriangle } from 'lucide-react';

export default function StaffChallengeRequestModal({
    isOpen,
    request,
    matchData,
    teamColors,
    popupTimeLeft,
    isChallengeExpired,
    onAccept,
    onInvalid,
    onPostpone
}) {
    if (!isOpen || !request) return null;

    const isHome = String(request.team_id) === String(matchData.teamHomeId);
    const teamColor = isHome ? (teamColors.home || '#ef4444') : (teamColors.away || '#3b82f6');
    const details = request.details || {};
    const reason = details.reason;
    const lastAction = details.lastAction;

    const progress = (popupTimeLeft / 7) * 100;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center pointer-events-auto">
            <div className="bg-white w-[480px] rounded-2xl flex flex-col justify-between shadow-2xl border border-slate-100 relative overflow-hidden">
                
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1 flex items-center gap-1.5 font-sans">
                        <Video size={14} className="animate-pulse" />
                        Video Challenge Request
                    </span>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-sans mt-1">
                        Team:
                        <span className="font-extrabold uppercase px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: teamColor }}>
                            {request.team_name}
                        </span>
                    </h2>
                </div>

                {/* Content */}
                <div className="p-6 flex-grow flex flex-col items-center justify-center min-h-[200px]">
                    {isChallengeExpired ? (
                        <div className="text-center w-full flex flex-col items-center">
                            <div className="bg-rose-50 border border-rose-200 text-rose-500 p-3 rounded-full mb-3">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-base font-extrabold text-rose-700 uppercase tracking-wide">
                                Challenge Request Expired
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                The 7-second period to submit a reason has passed.
                            </p>
                            
                            {reason ? (
                                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl w-full text-left">
                                    <div className="text-[10px] font-bold uppercase text-rose-500 mb-1 tracking-wider">
                                        Late Submission (For Info Only)
                                    </div>
                                    <div className="text-lg font-black text-slate-800">{reason}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        Challenging: <span className="font-bold">{lastAction ? 'Last Rally Action' : 'Previous Action'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl w-full text-center text-xs text-slate-400 italic">
                                    No challenge reason was selected on the tablet.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center w-full flex flex-col items-center">
                            {!reason ? (
                                <>
                                    {/* Timer ring */}
                                    <div className="relative w-20 h-20 flex items-center justify-center mb-4">
                                        <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 36 36">
                                            <path className="text-slate-100" strokeWidth="3.5" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                            <path className="text-amber-500 transition-all duration-300" strokeWidth="3.5" strokeDasharray={`${progress}, 100`} strokeLinecap="round" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        </svg>
                                        <span className="absolute font-mono text-xl font-black text-slate-800">{popupTimeLeft}s</span>
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5 justify-center">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                                        Waiting for challenge reason...
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        The team has 7 seconds to select the reason on their tablet.
                                    </p>
                                </>
                            ) : (
                                <div className="w-full flex flex-col items-center">
                                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-3 rounded-full mb-3 animate-bounce">
                                        <Video size={32} />
                                    </div>
                                    <div className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">
                                        Reason Received On Time
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{reason}</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Challenging:{' '}
                                        <span className="font-extrabold text-slate-800 uppercase">
                                            {lastAction ? 'Last Rally Action (YES)' : 'Previous Action (NO)'}
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-2">
                    <button
                        onClick={onInvalid}
                        className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                    >
                        Invalid
                    </button>
                    <button
                        onClick={onPostpone}
                        className="flex-1 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                    >
                        Postpone
                    </button>
                    <button
                        onClick={onAccept}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
