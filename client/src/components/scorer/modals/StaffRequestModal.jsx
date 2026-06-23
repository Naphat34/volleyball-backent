import React from 'react';
import { X, ArrowUpLeft, ArrowDownRight, AlarmClock, ArrowUpDown} from 'lucide-react';

export default function StaffRequestModal({
    isOpen,
    request,
    matchData,
    teamColors,
    onAccept,
    onReject
}) {
    if (!isOpen || !request) return null;

    const requestTypeText = request.request_type === 'TIMEOUT'
        ? 'Timeout'
        : request.request_type === 'LINEUP'
            ? 'Lineup'
            : request.request_type === 'SUBSTITUTION'
                ? 'Substitution'
                : 'คำขอเปลี่ยนสถานะ';

    const isHomeTeam = String(request.team_id) === String(matchData.teamHomeId);
    const teamColor = isHomeTeam ? (teamColors.home || '#ef4444') : (teamColors.away || '#3b82f6');

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center pointer-events-auto">
            <div className="bg-white w-[500px] rounded-2xl flex flex-col justify-between shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-col">
                    {/* Title */}
                    <div className="flex justify-between items-start">
                        <span className="text-[20px] font-bold text-black  mb-1 flex items-center gap-1.5 font-sans">
                            {requestTypeText} Request
                        </span>
                        <button
                            onClick={() => onReject(request.id)}
                            className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Reject request"
                        >
                            <X size={20} />
                        </button>
                    </div> 
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
                    {request.request_type === 'SUBSTITUTION' && request.details?.pairs ? (
                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 max-h-[280px] overflow-y-auto">
                            <div className="text-center py-6">
                                <div className="flex justify-center mb-2">
                                    <ArrowUpDown  size={100} className="animate-pulse" color={teamColor} />
                                </div>
                                <p className="text-lg font-semibold text-slate-600 mt-8">
                                    Team <span className="font-extrabold" style={{ color: teamColor }}>{request.team_name}</span> Request a Substitution
                                </p>
                            </div>  

                            <div className="flex flex-col gap-2">
                                {request.details.pairs.map((pair, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200/60 rounded-lg shadow-sm">
                                        {/* Left: Out Player */}
                                        <div className="flex items-center gap-2 w-[42%] justify-end">
                                            <span className="text-xs font-bold text-slate-700 text-right truncate max-w-[110px]">
                                                {<ArrowUpLeft color="#f90101" />}
                                            </span>
                                            <span className="w-8 h-8 rounded bg-rose-100 text-rose-600 border border-rose-200 font-extrabold text-sm flex items-center justify-center shrink-0">
                                                {pair.outPlayer?.number || '?'}
                                            </span>
                                        </div>

                                        {/* Right: In Player */}
                                        <div className="flex items-center gap-2 w-[42%] justify-start">
                                            <span className="w-8 h-8 rounded bg-emerald-100 text-emerald-600 border border-emerald-200 font-extrabold text-sm flex items-center justify-center shrink-0">
                                                {pair.inPlayer?.number || '?'}
                                            </span>
                                            <span className="text-xs font-bold text-slate-700 text-left truncate max-w-[110px]">
                                                {<ArrowDownRight color="#22c55e" />}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : request.request_type === 'TIMEOUT' ? (
                        <div className="text-center py-6">
                            <div className="flex justify-center mb-2">
                                <AlarmClock  size={100} className="animate-pulse" color={teamColor} />
                            </div>
                            <p className="text-lg font-semibold text-slate-600 mt-8">
                                Team <span className="font-extrabold" style={{ color: teamColor }}>{request.team_name}</span> Request a Timeout
                            </p>
                        </div>
                    ) : request.request_type === 'LINEUP' ? (
                        <div className="text-center py-6">
                            <p className="text-sm font-semibold text-slate-600">
                                Team <span className="font-extrabold" style={{ color: teamColor }}>{request.team_name}</span> Lineup
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <p className="text-sm font-medium text-slate-600">ต้องการดำเนินการตามคำขอนี้หรือไม่?</p>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button
                        onClick={() => onReject(request.id)}
                        className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                    >
                        Reject
                    </button>
                    <button
                        onClick={() => onAccept(request)}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
}
