import React from 'react';
import { X, Check, ArrowUpRight, ArrowDownRight, Timer } from 'lucide-react';

const PlayerJersey = ({ number, tone = 'blue' }) => {
    const palette = tone === 'out'
        ? 'bg-slate-700 text-white border-slate-500'
        : 'bg-blue-900 text-white border-blue-700';

    return (
        <div className={`relative w-9 h-8 ${palette} border shadow-sm flex items-center justify-center font-black text-sm leading-none`}>
            <div className="absolute -top-1 left-1 w-2 h-2 bg-current opacity-70 rounded-sm rotate-45"></div>
            <div className="absolute -top-1 right-1 w-2 h-2 bg-current opacity-70 rounded-sm rotate-45"></div>
            {number || '?'}
        </div>
    );
};

const ActionButton = ({ children, className = '', onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded text-[11px] font-semibold transition-colors ${className}`}
    >
        {children}
    </button>
);

export default function StaffRequestModal({
    isOpen,
    request,
    matchData,
    teamColors,
    onAccept,
    onReject,
    onPostpone
}) {
    if (!isOpen || !request) return null;

    const requestType = String(request.request_type || '').toUpperCase();
    const isTimeout = requestType === 'TIMEOUT';
    const isSubstitution = requestType === 'SUBSTITUTION';
    const isLineup = requestType === 'LINEUP';
    const isHomeTeam = String(request.team_id) === String(matchData.teamHomeId);
    const teamColor = isHomeTeam ? (teamColors.home || '#f59e0b') : (teamColors.away || '#2563eb');
    const teamName = request.team_name || (isHomeTeam ? matchData.teamHome : matchData.teamAway) || 'Team';
    const title = isTimeout ? 'Timeout request' : isSubstitution ? 'Substitution request' : isLineup ? 'Lineup request' : 'Staff request';
    let requestDetails = request.details || {};
    if (typeof requestDetails === 'string') {
        try {
            requestDetails = JSON.parse(requestDetails || '{}');
        } catch {
            requestDetails = {};
        }
    }
    const pairs = Array.isArray(requestDetails.pairs) ? requestDetails.pairs : [];

    const handlePostpone = () => {
        if (onPostpone) onPostpone(request);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/15 pointer-events-auto">
            <div className="w-[430px] max-w-[calc(100vw-24px)] bg-white border border-slate-300 shadow-xl rounded-sm overflow-hidden">
                <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800">{title}</h2>
                    <button
                        onClick={handlePostpone}
                        className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                        title="Postpone"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-8 pt-7 pb-5 text-center">
                    {isTimeout && (
                        <div className="mb-4 flex justify-center">
                            <div className="w-24 h-24 rounded-full bg-amber-50 border border-amber-400 flex items-center justify-center text-amber-500">
                                <Timer size={52} strokeWidth={2.3} />
                            </div>
                        </div>
                    )}

                    <p className="text-xl text-slate-700 leading-snug">
                        Team{' '}
                        <span className="font-extrabold" style={{ color: teamColor }}>
                            {teamName}
                        </span>{' '}
                        requested a{' '}
                        <span className="font-extrabold text-slate-800">
                            {isTimeout ? 'time out' : isSubstitution ? 'substitution' : isLineup ? 'lineup' : 'request'}
                        </span>
                    </p>

                    {isSubstitution && pairs.length > 0 && (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                            {pairs.map((pair, idx) => (
                                <div key={idx} className="h-11 px-2 rounded-md bg-blue-50 border border-blue-200 flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-sm bg-blue-400 text-white flex items-center justify-center">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                    <PlayerJersey number={pair.outPlayer?.number} tone="out" />
                                    <ArrowUpRight size={16} className="text-rose-500" strokeWidth={2.6} />
                                    <ArrowDownRight size={16} className="text-emerald-500" strokeWidth={2.6} />
                                    <PlayerJersey number={pair.inPlayer?.number} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 pb-5 flex items-center justify-center gap-3">
                    <ActionButton
                        onClick={handlePostpone}
                        className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                        Postpone
                    </ActionButton>
                    <ActionButton
                        onClick={() => onReject(request.id)}
                        className="bg-rose-500 text-white hover:bg-rose-600"
                    >
                        Reject
                    </ActionButton>
                    <ActionButton
                        onClick={() => onAccept(request)}
                        className="bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                        Accept
                    </ActionButton>
                </div>
            </div>
        </div>
    );
}
