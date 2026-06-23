import React, { useState } from 'react';
import { Flag, CheckCircle, X } from 'lucide-react';

const ChallengeModal = ({ isOpen, onClose, teamName, remaining, onConfirm }) => {
    const reasons = [
        { id: 'BALL_IN_OUT', label: 'Ball In/Out' },
        { id: 'TOUCH_BLOCK', label: 'Touch Block' },
        { id: 'NET_TOUCH', label: 'Net Touch' },
        { id: 'ANTENNA', label: 'Antenna Touch' },
        { id: 'FOOT_FAULT', label: 'Foot Fault (Serve/Line)' },
    ];

    const [selectedReason, setSelectedReason] = useState(reasons[0].id);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all">
            <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3 tracking-tight">
                            <div className="bg-amber-400 p-2 rounded-md text-white shadow-lg shadow-amber-100">
                                <Flag size={20} />
                            </div>
                            VIDEO CHALLENGE
                        </h2>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Team: <span className="text-blue-600">{teamName}</span></div>
                    </div>
                    <div className="bg-white px-3 py-1.5 rounded-md text-[10px] font-semibold border border-slate-100 shadow-sm text-slate-500 uppercase tracking-widest">
                        LEFT: {remaining}
                    </div>
                </div>

                <div className="p-8 space-y-8 bg-white">
                    <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase mb-4 block tracking-[.2em] text-center">Challenge Reason</label>
                        <div className="grid grid-cols-2 gap-3">
                            {reasons.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedReason(r.id)}
                                    className={`p-3 rounded-lg text-[10px] font-semibold uppercase tracking-widest border transition-all ${selectedReason === r.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl translate-y-[-2px]' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-300 hover:text-slate-600'}`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold text-slate-400 uppercase mb-4 block tracking-[.2em] text-center">Final Decision</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => onConfirm('SUCCESSFUL', selectedReason)}
                                className="group bg-white border border-slate-100 hover:border-emerald-500 p-6 rounded-3xl flex flex-col items-center gap-2 transition-all hover:shadow-2xl hover:shadow-emerald-50 hover:scale-[1.05]"
                            >
                                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                    <CheckCircle size={24} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-800 uppercase tracking-widest">Successful</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Keep Quota</span>
                            </button>
                            <button
                                onClick={() => onConfirm('UNSUCCESSFUL', selectedReason)}
                                className="group bg-white border border-slate-100 hover:border-rose-500 p-6 rounded-3xl flex flex-col items-center gap-2 transition-all hover:shadow-2xl hover:shadow-rose-50 hover:scale-[1.05]"
                            >
                                <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                    <X size={24} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-800 uppercase tracking-widest">Unsuccessful</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase font-semibold">Lose 1 Quota</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
                    <button onClick={onClose} className="px-8 py-2 rounded-md text-slate-400 hover:text-slate-800 text-[10px] font-semibold uppercase tracking-widest transition-all">Cancel Request</button>
                </div>
            </div>
        </div>
    );
};

export default ChallengeModal;