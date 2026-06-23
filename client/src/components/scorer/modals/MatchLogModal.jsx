import React from 'react';
import { X, FileText, Clock } from 'lucide-react';

const MatchLogModal = ({ isOpen, onClose, events }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md h-[80vh] flex flex-col animate-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3 tracking-tight">
                            <div className="bg-blue-600 p-2 rounded-md text-white shadow-lg shadow-indigo-100">
                                <FileText size={20} />
                            </div>
                            MATCH LOG
                        </h2>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Real-time Match Events Timeline</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body (List) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-white">
                    {(!events || events.length === 0) ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-200">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="font-semibold uppercase text-[10px] tracking-widest text-slate-300">No events recorded yet</p>
                        </div>
                    ) : (
                        events.map((ev, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-lg bg-white border border-slate-100 hover:border-blue-100 hover:bg-slate-50 transition-all group">
                                <div className="flex flex-col items-center pt-1 min-w-[3.5rem] border-r border-slate-100 pr-4">
                                    <div className="text-slate-800 font-semibold text-[11px] font-mono">{ev.time}</div>
                                    <div className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter mt-1">Ref Time</div>
                                </div>
                                <div className="flex-1">
                                    <div className="text-slate-800 font-semibold text-xs uppercase tracking-tight leading-snug">{ev.description}</div>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="bg-slate-900 text-white text-[9px] font-semibold px-2 py-0.5 rounded-lg uppercase tracking-tighter shadow-sm">SET {ev.set}</div>
                                        <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all">
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Score:</div>
                                            <div className="text-[10px] font-semibold text-blue-600 font-mono tracking-widest">{ev.score}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                    <button onClick={onClose} className="px-12 py-2 rounded-md font-semibold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-all active:scale-95">Close Log Console</button>
                </div>
            </div>
        </div>
    );
};

export default MatchLogModal;