import React, { useState } from 'react';
import { AlertTriangle, X, Users, CheckCircle } from 'lucide-react';

const SanctionModal = ({ isOpen, onClose, teamName, roster, onConfirm }) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [cardType, setCardType] = useState('YELLOW');

    if (!isOpen) return null;

    const handleConfirmClick = () => {
        const player = roster.find(p => p.id == selectedPlayerId);
        if (player) {
            onConfirm(player, cardType);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3 tracking-tight">
                            <div className="bg-rose-500 p-2 rounded-md text-white shadow-lg shadow-rose-100">
                                <AlertTriangle size={20} />
                            </div>
                            ISSUE SANCTION
                        </h2>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Team: <span className="text-blue-600">{teamName}</span></div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-8 bg-white">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1">Select Offending Player</label>
                            <div className="relative group">
                                <select
                                    value={selectedPlayerId}
                                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-lg text-slate-800 font-semibold uppercase text-xs tracking-widest focus:ring-4 focus:ring-indigo-50 focus:border-blue-200 focus:outline-none appearance-none cursor-pointer transition-all"
                                >
                                    <option value="">— SELECT ATHLETE —</option>
                                    {roster.map(p => (
                                        <option key={p.id} value={p.id}>
                                            #{p.number} — {p.name || `${p.firstname} ${p.lastname}`}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-slate-500 transition-colors">
                                    <Users size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1 text-center">Sanction Gravity</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setCardType('YELLOW')} 
                                    className={`p-6 rounded-3xl font-semibold uppercase tracking-widest text-[10px] border transition-all flex flex-col items-center gap-3 ${cardType === 'YELLOW' ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-xl shadow-amber-50 translate-y-[-4px]' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-300'}`}
                                >
                                    <div className={`w-8 h-12 rounded-lg shadow-sm transition-colors ${cardType === 'YELLOW' ? 'bg-amber-400' : 'bg-slate-200 opacity-50'}`}></div>
                                    YELLOW CARD
                                    <span className="text-[8px] opacity-60 font-bold">(Warning)</span>
                                </button>
                                <button 
                                    onClick={() => setCardType('RED')} 
                                    className={`p-6 rounded-3xl font-semibold uppercase tracking-widest text-[10px] border transition-all flex flex-col items-center gap-3 ${cardType === 'RED' ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-xl shadow-rose-50 translate-y-[-4px]' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-300'}`}
                                >
                                    <div className={`w-8 h-12 rounded-lg shadow-sm transition-colors ${cardType === 'RED' ? 'bg-rose-500' : 'bg-slate-200 opacity-50'}`}></div>
                                    RED CARD
                                    <span className="text-[8px] opacity-60 font-bold">(Penalty Point)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-8 py-3 rounded-md font-semibold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-all">Cancel</button>
                    <button 
                        onClick={handleConfirmClick} 
                        disabled={!selectedPlayerId} 
                        className="px-10 py-3 rounded-md font-semibold text-[10px] uppercase tracking-widest bg-slate-900 hover:bg-black text-white disabled:opacity-20 disabled:grayscale transition-all shadow-xl active:scale-95 flex items-center gap-3"
                    >
                        Confirm Sanction <CheckCircle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SanctionModal;