import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import Swal from 'sweetalert2';

export default function SubstitutionRequestModal({ request, teamName, homeRoster, awayRoster, onClose, onAccept, onReject, onPostpone }) {
    // request.details.pairs should contain { outPlayer, inPlayer }
    const pairs = request?.details?.pairs || [];
    
    // Checkboxes state for partial accept
    const [selectedPairs, setSelectedPairs] = useState(
        pairs.map((_, i) => i) // initially select all indices
    );

    const handleTogglePair = (index) => {
        setSelectedPairs(prev => 
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const handleAccept = () => {
        if (selectedPairs.length === 0) {
            Swal.fire('Warning', 'No substitutions selected.', 'warning');
            return;
        }
        const acceptedPairs = pairs.filter((_, i) => selectedPairs.includes(i));
        onAccept(request, acceptedPairs);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transform transition-all">
                <div className="bg-slate-800 p-6 text-white text-center">
                    <h2 className="text-2xl font-bold">Substitution Request</h2>
                    <p className="text-slate-300 mt-2">Team {teamName} requested a substitution</p>
                </div>
                
                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                        {pairs.map((pair, index) => {
                            const isSelected = selectedPairs.includes(index);
                            return (
                                <div 
                                    key={index} 
                                    onClick={() => handleTogglePair(index)}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-95
                                        ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}
                                    `}
                                >
                                    <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors
                                        ${isSelected ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}
                                    `}>
                                        {isSelected && <Check size={16} strokeWidth={3} />}
                                    </div>
                                    
                                    <div className="flex-1 flex items-center justify-center gap-6 font-black text-2xl">
                                        <div className="text-rose-500 flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Out</span>
                                            <span>{pair.outPlayer.number}</span>
                                        </div>
                                        <div className="text-slate-300">&gt;&lt;</div>
                                        <div className="text-emerald-600 flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">In</span>
                                            <span>{pair.inPlayer.number}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex gap-3">
                    <button 
                        onClick={() => onPostpone(request)} 
                        className="flex-1 py-3 px-4 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all shadow-sm"
                    >
                        Postpone
                    </button>
                    <button 
                        onClick={() => onReject(request)} 
                        className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all shadow-sm shadow-rose-500/20"
                    >
                        Reject
                    </button>
                    <button 
                        onClick={handleAccept} 
                        className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                        <Check size={20} strokeWidth={3} />
                        Accept
                    </button>
                </div>
                
                {/* Close button (acts like postpone/cancel) */}
                <button 
                    onClick={() => onClose()}
                    className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>
        </div>
    );
}
