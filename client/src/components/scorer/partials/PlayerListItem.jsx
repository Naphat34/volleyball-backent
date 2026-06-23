import React from 'react';

const PlayerListItem = ({ player, label, align, isActive, isLibero, isSwappedLibero, isLastSwap }) => {
    const isRight = align === 'right';
    
    const getPlayerName = (p) => {
        if (!p) return '';
        if (p.name) return p.name;
        if (p.firstname) return p.firstname + ' ' + (p.lastname || '');
        if (p.first_name) return p.first_name + ' ' + (p.last_name || '');
        return 'Unknown';
    };

    // New light theme tokens
    const activeClass = 'bg-white border-slate-100 shadow-sm';
    const inactiveClass = 'hover:bg-slate-50/50 text-slate-400';
    const numberInactiveClass = 'bg-slate-50 text-slate-300';
    const liberoClass = 'bg-amber-100 text-amber-700 border-amber-200';
    const swappedLiberoClass = 'bg-blue-600 text-white border-indigo-400 shadow-indigo-100 shadow-md scale-105';
    const lastSwapClass = 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-white';
    const nameActiveClass = 'text-slate-800';
    const nameInactiveClass = 'text-slate-400';
    const numberActiveClass = 'bg-slate-800 text-white';
    const captainClass = 'bg-amber-400 text-amber-900';
    const labelClass = 'bg-slate-100 text-slate-500';

    return (
        <div className={`flex items-center gap-3 p-2 rounded-md border border-transparent transition-all duration-300 ${isActive ? activeClass : inactiveClass} ${isRight ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${isLastSwap ? lastSwapClass : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-xs shrink-0 border transition-all ${isSwappedLibero ? swappedLiberoClass : (isLibero ? liberoClass : (isActive && player ? `${numberActiveClass} border-slate-800` : `${numberInactiveClass} border-slate-100`))}`}>
                {player ? player.number : '-'}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className={`text-xs truncate font-bold flex items-center gap-2 ${isActive ? nameActiveClass : nameInactiveClass} ${isRight ? 'flex-row-reverse' : ''}`}>
                    <span>{getPlayerName(player)}</span>
                    {player?.isCaptain && (
                        <span className={`text-[8px] font-semibold w-4 h-4 flex items-center justify-center rounded-full ${captainClass}`} title="Captain">C</span>
                    )}
                </div>
            </div>
            {label && (
                <div className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${labelClass}`}>{label}</div>
            )}
        </div>
    );
};

export default PlayerListItem;