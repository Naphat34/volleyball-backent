import React from 'react';
import { X, Users } from 'lucide-react';

const PlayerPickerModal = ({ isOpen, onClose, teamName, roster, lineup, liberos, onSelect, context }) => {
    if (!isOpen) return null;
    const getPlayerId = (player) => {
        if (!player) return null;
        return player.id || player.player_id || player.playerId || null;
    };


    // ตรวจสอบว่า context มีค่าหรือไม่ เพื่อป้องกัน error
    const safeContext = context || {};
    const isCourtPosition = typeof safeContext.posIndex === 'number';
    
    // ฟังก์ชันดึงเบอร์เสื้อ (เพื่อให้รองรับ key ต่างๆ เหมือนกับ LineupModal)
    const getPlayerNumber = (player) => player.number || player.jersey_number || player.shirt_number || '?';

    // ตรวจสอบ liberos ว่ามีค่าหรือไม่
    const safeLiberos = liberos || { l1: null, l2: null };

    return (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in duration-300">
                <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-3 tracking-tight">
                            <div className="bg-blue-600 p-2 rounded-md text-white shadow-lg shadow-indigo-100">
                                <Users size={20} />
                            </div>
                            SELECT PLAYER
                        </h2>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {teamName} • {isCourtPosition ? `POS P${safeContext.posIndex + 1}` : (typeof safeContext.posIndex === 'string' ? safeContext.posIndex.toUpperCase() : 'GENERAL')}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-3 custom-scrollbar bg-white">
                    {roster && roster.map(player => {
                        const alreadyInLineup = lineup && lineup.some(p => 
                            p && getPlayerId(p) === getPlayerId(player)
                        );

                        const alreadyIsLibero = Object.values(safeLiberos).some(p => 
                            p && getPlayerId(p) === getPlayerId(player)
                        );
                        const isRestrictedLibero = isCourtPosition && player.isLibero;
                        const isDisabled = alreadyInLineup || alreadyIsLibero || isRestrictedLibero;

                        return (
                            <button
                                key={getPlayerId(player)}
                                disabled={isDisabled}
                                onClick={() => onSelect(player)}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left relative group ${isDisabled ? 'bg-slate-50 border-slate-50 opacity-20 grayscale cursor-not-allowed' : 'bg-white border-slate-100 hover:border-blue-500 hover:shadow-lg hover:shadow-indigo-50 active:scale-95'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-lg transition-colors ${player.isLibero ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                    {getPlayerNumber(player)}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className={`font-semibold uppercase tracking-tight truncate text-xs ${isDisabled ? 'text-slate-400' : 'text-slate-800 group-hover:text-blue-600'}`}>{player.firstname || player.first_name || player.name}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{player.position || 'Player'}</div>
                                </div>
                                {player.isLibero && <span className="absolute top-2 right-2 bg-rose-500 text-[8px] px-1.5 py-0.5 rounded font-semibold text-white uppercase tracking-tighter">LIB</span>}
                                {isRestrictedLibero && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg backdrop-blur-[1px]">
                                        <div className="bg-rose-500 text-white text-[8px] font-semibold px-2 py-0.5 rounded shadow-sm uppercase tracking-widest">Libero Only</div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-[9px] text-slate-400 font-bold text-center uppercase tracking-widest px-8 leading-relaxed">
                    Libero players are restricted to specialized positions. Players already assigned are hidden or disabled.
                </div>
            </div>
        </div>
    );
};

export default PlayerPickerModal;