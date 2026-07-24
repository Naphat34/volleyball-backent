import React from 'react';
import { X, Users } from 'lucide-react';
import { getPlayerId, getPlayerNumber, isPlayerLibero, filterActivePlayers } from '../../../utils/playerFilters';

const PlayerPickerModal = ({ isOpen, onClose, teamName, roster, lineup, liberos, onSelect, context }) => {
    if (!isOpen) return null;

    const safeContext = context || {};
    const isCourtPosition = typeof safeContext.posIndex === 'number';
    const safeLiberos = liberos || { l1: null, l2: null };
    const activePlayers = filterActivePlayers(roster || []);
    const getPlayerName = (player) => [
        player.firstname || player.first_name || '',
        player.lastname || player.last_name || ''
    ].filter(Boolean).join(' ') || player.name || '';
    const selectionLabel = isCourtPosition
        ? `Court position P${safeContext.posIndex + 1}`
        : (typeof safeContext.posIndex === 'string' ? safeContext.posIndex.toUpperCase() : 'General selection');

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm animate-in fade-in transition-all">
            <div className="flex max-h-[82vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in duration-300">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
                                <Users size={19} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-bold tracking-tight text-slate-900">Select player</h2>
                                <p className="mt-0.5 truncate text-xs font-medium text-slate-500" title={teamName}>{teamName}</p>
                            </div>
                        </div>
                        <div className="ml-[52px] mt-3 inline-flex rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                            {selectionLabel}
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close player picker">
                        <X size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {activePlayers.map(player => {
                            const alreadyInLineup = lineup && lineup.some(p => p && getPlayerId(p) === getPlayerId(player));
                            const alreadyIsLibero = Object.values(safeLiberos).some(p => p && getPlayerId(p) === getPlayerId(player));
                            const isRestrictedLibero = isCourtPosition && isPlayerLibero(player);
                            const isDisabled = alreadyInLineup || alreadyIsLibero || isRestrictedLibero;

                            return (
                                <button
                                    key={getPlayerId(player)}
                                    disabled={isDisabled}
                                    onClick={() => onSelect(player)}
                                    className={`group relative flex min-h-[68px] items-center gap-3 rounded-xl border p-3 text-left transition-all ${isDisabled ? 'cursor-not-allowed border-slate-200 bg-slate-100/80 opacity-55 grayscale' : 'border-white bg-white shadow-sm hover:-translate-y-px hover:border-blue-200 hover:shadow-md hover:shadow-blue-100/60 active:scale-[0.98]'}`}
                                >
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-bold transition-colors ${isPlayerLibero(player) ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700'}`}>
                                        {getPlayerNumber(player)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className={`truncate text-sm font-semibold ${isDisabled ? 'text-slate-400' : 'text-slate-800 group-hover:text-blue-700'}`}>{getPlayerName(player)}</div>
                                        <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">{player.position || 'Player'}</div>
                                    </div>
                                    {isPlayerLibero(player) && <span className="absolute right-2 top-2 rounded bg-orange-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">LIB</span>}
                                    {isRestrictedLibero && (
                                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/85 backdrop-blur-[1px]">
                                            <div className="rounded-md bg-orange-500 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">Libero only</div>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {activePlayers.length === 0 && (
                        <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 text-center">
                            <Users size={24} className="mb-2 text-slate-300" />
                            <p className="text-sm font-semibold text-slate-500">No active players</p>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 bg-white px-6 py-3 text-center text-[10px] font-medium leading-relaxed text-slate-400">
                    Players already assigned, or ineligible for the selected position, are unavailable.
                </div>
            </div>
        </div>
    );
};

export default PlayerPickerModal;
