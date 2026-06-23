import React, { useState, useEffect } from 'react';
import { X, Settings, CheckCircle, AlertTriangle } from 'lucide-react';

const ManualEditModal = ({ 
    isOpen, onClose, teamHome, teamAway, score, currentSet, onConfirm 
}) => {
    const [localScore, setLocalScore] = useState({ home: 0, away: 0 });
    const [localSet, setLocalSet] = useState(1);
    const [remark, setRemark] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLocalScore({ ...score });
            setLocalSet(currentSet);
            setRemark('');
        }
    }, [isOpen, score, currentSet]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm({
            score: localScore,
            currentSet: localSet,
            remark
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3 tracking-tight">
                            <div className="bg-amber-500 p-2 rounded-md text-white shadow-lg shadow-amber-100">
                                <Settings size={20} />
                            </div>
                            MANUAL ADJUSTMENT
                        </h2>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Manual Override Console</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Score Adjustment */}
                    <div className="space-y-4">
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1">Adjust Current Score</label>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 flex flex-col items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{teamHome}</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setLocalScore(prev => ({...prev, home: Math.max(0, prev.home - 1)}))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">-</button>
                                    <span className="text-3xl font-black text-slate-800 w-12 text-center">{localScore.home}</span>
                                    <button onClick={() => setLocalScore(prev => ({...prev, home: prev.home + 1}))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">+</button>
                                </div>
                            </div>
                            <div className="text-slate-200 font-bold text-xl">:</div>
                            <div className="flex-1 flex flex-col items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{teamAway}</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setLocalScore(prev => ({...prev, away: Math.max(0, prev.away - 1)}))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">-</button>
                                    <span className="text-3xl font-black text-slate-800 w-12 text-center">{localScore.away}</span>
                                    <button onClick={() => setLocalScore(prev => ({...prev, away: prev.away + 1}))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">+</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Set Adjustment */}
                    <div className="space-y-4">
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1">Set Number</label>
                        <div className="flex items-center justify-center gap-4">
                            <button onClick={() => setLocalSet(prev => Math.max(1, prev - 1))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">-</button>
                            <span className="text-2xl font-bold text-slate-800">SET {localSet}</span>
                            <button onClick={() => setLocalSet(prev => Math.min(5, prev + 1))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50">+</button>
                        </div>
                    </div>

                    {/* Remark / Report */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1">Reason for Adjustment (Report)</label>
                        <textarea 
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            placeholder="e.g., Wrong point assigned to wrong team..."
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all min-h-[100px] resize-none"
                        />
                        <p className="text-[10px] text-amber-600 flex items-center gap-1 font-medium italic">
                            <AlertTriangle size={12} /> This adjustment will be logged in the official report.
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-8 py-3 rounded-md font-semibold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-all">Cancel</button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!remark.trim()}
                        className="px-10 py-3 rounded-md font-semibold text-[10px] uppercase tracking-widest bg-slate-900 hover:bg-black text-white disabled:opacity-20 disabled:grayscale transition-all shadow-xl active:scale-95 flex items-center gap-3"
                    >
                        Apply Changes <CheckCircle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualEditModal;
