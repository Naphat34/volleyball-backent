import React from 'react';
import { X } from 'lucide-react';

const PlayerPicker = ({ isOpen, onClose, teamName, roster, lineup, liberos, onSelect, context }) => {
    if (!isOpen) return null;

    const safeContext = context || {};
    const isCourtPosition = typeof safeContext.posIndex === 'number';

    // Helper to get player number
    const getPlayerNumber = (p) => p.number || p.jersey_number || p.shirt_number || '?';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-600 w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
                    <div>
                        <span className="font-bold text-white text-lg block">Select Player ({teamName})</span>
                        <span className="text-xs text-slate-400">
                            Position: {isCourtPosition ? `P${safeContext.posIndex + 1}` : (typeof safeContext.posIndex === 'string' ? safeContext.posIndex.toUpperCase() : '')}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 custom-scrollbar">
                    {roster && roster.map(player => {
                        const alreadyInLineup = lineup && lineup.some(p => p?.id === player.id);
                        const safeLiberos = liberos || {};
                        const alreadyIsLibero = Object.values(safeLiberos).some(p => p?.id === player.id);
                        const isRestrictedLibero = isCourtPosition && player.isLibero;
                        const isDisabled = alreadyInLineup || alreadyIsLibero || isRestrictedLibero;

                        return (
                            <button
                                key={player.id}
                                disabled={isDisabled}
                                onClick={() => onSelect(player)}
                                className={`flex items-center gap-3 p-3 rounded-md border-2 transition-all text-left relative ${isDisabled ? 'bg-slate-900/50 border-slate-800 opacity-40 cursor-not-allowed' : 'bg-slate-700 border-slate-600 hover:border-blue-500 hover:bg-slate-600 active:scale-95'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${player.isLibero ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                    {getPlayerNumber(player)}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-white font-bold truncate text-sm">{player.firstname || player.first_name || player.name}</div>
                                    <div className="text-xs text-slate-400 truncate">{player.lastname || player.last_name || ''}</div>
                                </div>
                                {player.isLibero && <span className="absolute top-1 right-1 bg-blue-500 text-[10px] px-1 rounded font-semibold text-white">L</span>}
                                {isRestrictedLibero && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-md">
                                        <span className="text-[10px] font-bold text-red-400">LIBERO ONLY</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PlayerPicker;