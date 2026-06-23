import React from 'react';
import { Settings, Timer } from 'lucide-react';
import { formatThaiFullDateTime } from '../../../utils';

// Helper to extract 3-letter code from team name
const getTeamCode = (teamName) => {
    if (!teamName) return '';
    if (teamName.includes('-')) {
        return teamName.split('-')[0].trim().toUpperCase();
    }
    return teamName.substring(0, 3).toUpperCase();
};

const MatchHistorySidebar = ({
    matchData,
    staffConnections,
    isHomeLeft,
    homeLineup,
    awayLineup,
    matchEvents,
    activeHistoryTab,
    setActiveHistoryTab,
    pendingRequests,
    postponedChallengeIds,
    teamColors,
    history,
    setShowSetup,
    setActiveChallengeRequest,
    setShowChallengeRequestPopup,
    setChallengeConfirmMode,
    handleUndo
}) => {
    const leftLineup = isHomeLeft ? homeLineup : awayLineup;
    const rightLineup = isHomeLeft ? awayLineup : homeLineup;

    return (
        <aside className="w-[300px] bg-white border-l border-slate-200 rounded-lg hidden xl:flex flex-col z-10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden shrink-0">

            {/* Top Row: Staff connection status */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white">
                <button
                    onClick={() => setShowSetup(true)}
                    className="p-1 border border-slate-200 rounded text-slate-400 hover:bg-slate-50 transition-colors"
                >
                    <Settings size={16} />
                </button>
                <div className="text-xs font-bold text-slate-700 flex-1 px-3">Staff connections</div>
                <div className="flex gap-3 text-xs font-bold">
                    <div className="flex items-center gap-1.5" title={`${isHomeLeft ? matchData.teamHome : matchData.teamAway} Staff`}>
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${(isHomeLeft ? staffConnections.home : staffConnections.away)
                            ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse'
                            : 'bg-slate-300'
                            }`}></div>
                        <span className="text-slate-700">
                            {isHomeLeft
                                ? (matchData.teamHomeCode || getTeamCode(matchData.teamHome))
                                : (matchData.teamAwayCode || getTeamCode(matchData.teamAway))}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5" title={`${isHomeLeft ? matchData.teamAway : matchData.teamHome} Staff`}>
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${(isHomeLeft ? staffConnections.away : staffConnections.home)
                            ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse'
                            : 'bg-slate-300'
                            }`}></div>
                        <span className="text-slate-700">
                            {isHomeLeft
                                ? (matchData.teamAwayCode || getTeamCode(matchData.teamAway))
                                : (matchData.teamHomeCode || getTeamCode(matchData.teamHome))}
                        </span>
                    </div>
                </div>
            </div>

            {/* Match History & Set Selector */}
            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-white">
                <h3 className="text-[15px] font-bold text-[#1e293b]">Match history</h3>
                <div className="flex items-center bg-[#f8fafc] border border-slate-200 rounded-md px-2 py-1 gap-1.5">
                    <span className="text-[11px] font-bold text-[#475569]">Set</span>
                    <span className="text-[11px] font-bold text-blue-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 min-w-[20px] text-center">{matchData.currentSet}</span>
                </div>
            </div>

            {/* Team Tabs */}
            <div className="flex bg-white shrink-0">
                <div className="flex-1 text-center py-2.5 text-xs truncate font-bold border-b-2" style={{
                    borderColor: isHomeLeft ? teamColors.home : teamColors.away,
                    backgroundColor: `${isHomeLeft ? teamColors.home : teamColors.away}1A`
                }}>
                    {isHomeLeft ? matchData.teamHome : matchData.teamAway}
                </div>
                <div className="flex-1 text-center py-2.5 text-xs font-bold border-b-2" style={{
                    borderColor: isHomeLeft ? teamColors.away : teamColors.home,
                    backgroundColor: `${isHomeLeft ? teamColors.away : teamColors.home}1A`
                }}>
                    {isHomeLeft ? matchData.teamAway : matchData.teamHome}
                </div>
            </div>

            {/* Lineup Row */}
            <div className="flex items-center border-b border-slate-200 bg-white text-[10px] font-bold shrink-0">
                <div className="flex-1 text-center py-2 tracking-wider truncate px-1">
                    {leftLineup.filter(Boolean).map(p => p.number).join(', ')}
                </div>
                <div className="px-2.5 py-2 bg-[#f1f5f9] text-slate-500 border-x border-slate-200 uppercase tracking-widest text-[9px]">
                    Lineup
                </div>
                <div className="flex-1 text-center py-2 tracking-wider truncate px-1">
                    {rightLineup.filter(Boolean).map(p => p.number).join(', ')}
                </div>
            </div>

            {/* Feed Area */}
            <div className="flex-1 bg-white overflow-y-auto">
                {(() => {
                    const setEvents = matchEvents.filter(e => e.set === activeHistoryTab);
                    if (setEvents.length === 0) return (
                        <div className="flex items-center justify-center h-24 text-[11px] text-slate-400">No events yet</div>
                    );

                    return (
                        <div className="divide-y divide-slate-100">
                            {setEvents.map((ev) => {
                                const isHome = ev.metadata?.team === matchData.teamHome;
                                const isAway = ev.metadata?.team === matchData.teamAway;
                                const isLeftEvent = isHomeLeft ? isHome : isAway;
                                const isRightEvent = isHomeLeft ? isAway : isHome;
                                const isNeutralEvent = !isLeftEvent && !isRightEvent;
                                const accentColor = isHome ? teamColors.home : isAway ? teamColors.away : '#cbd5e1';
                                const [homeScore, awayScore] = (ev.score || '0-0').split('-');
                                const leftScore = isHomeLeft ? homeScore : awayScore;
                                const rightScore = isHomeLeft ? awayScore : homeScore;
                                const mt = ev.metadata || {};

                                // ---- Row content by event type ----
                                if (mt.type === 'POINT') {
                                    // Point: icon + "Point" on team side, score badge opposite
                                    return (
                                        <div key={ev.id} className="flex items-center px-3 py-2.5 hover:bg-slate-50 transition-colors">
                                            {/* Left placeholder or content */}
                                            <div className="flex-1 flex items-center gap-2">
                                                {isLeftEvent && (
                                                    <>
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}20` }}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" /><path d="M12 12a12.72 12.72 0 0 1-8.7-4" /><path d="M12.9 16.9a16.55 16.55 0 0 1-10.9-4" /><path d="M12 12a12.72 12.72 0 0 1 8.7 4" /><path d="M11.1 16.9A16.55 16.55 0 0 1 4 6.1" /><path d="M12 12a12.72 12.72 0 0 1 4.7-8" /><path d="M12.9 7.1A16.55 16.55 0 0 1 20 17.9" /><path d="M12 12a12.72 12.72 0 0 1-4.7 8" /></svg>
                                                        </div>
                                                        <span className="text-[12px] font-semibold text-slate-700">Point</span>
                                                    </>
                                                )}
                                            </div>
                                            {/* Score badge center */}
                                            <div className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 mx-2">
                                                <span className="text-slate-700 w-4 text-center">{leftScore}</span>
                                                <span className="text-slate-400">-</span>
                                                <span className="text-slate-700 w-4 text-center">{rightScore}</span>
                                            </div>
                                            {/* Right placeholder or content */}
                                            <div className="flex-1 flex items-center justify-end gap-2">
                                                {isRightEvent && (
                                                    <>
                                                        <span className="text-[12px] font-semibold text-slate-700">Point</span>
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accentColor}20` }}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" /><path d="M12 12a12.72 12.72 0 0 1-8.7-4" /><path d="M12.9 16.9a16.55 16.55 0 0 1-10.9-4" /><path d="M12 12a12.72 12.72 0 0 1 8.7 4" /><path d="M11.1 16.9A16.55 16.55 0 0 1 4 6.1" /><path d="M12 12a12.72 12.72 0 0 1 4.7-8" /><path d="M12.9 7.1A16.55 16.55 0 0 1 20 17.9" /><path d="M12 12a12.72 12.72 0 0 1-4.7 8" /></svg>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                if (mt.type === 'TIMEOUT') {
                                    return (
                                        <div key={ev.id} className="flex items-center px-3 py-2 hover:bg-slate-50 transition-colors">
                                            <div className="flex-1">{isLeftEvent && <span className="text-[11px] font-semibold text-slate-500">Timeout</span>}</div>
                                            <div className="flex-1 flex justify-end">
                                                {isRightEvent && (
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                                                        Timeout
                                                        <Timer size={12} />
                                                    </span>
                                                )}
                                                {isLeftEvent && (
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                                                        Timeout
                                                        <Timer size={12} />
                                                    </span>
                                                )}
                                                {isNeutralEvent && <span className="text-[10px] text-slate-400">Timeout</span>}
                                            </div>
                                        </div>
                                    );
                                }

                                if (mt.type === 'SUBSTITUTION' || mt.type === 'LIBERO') {
                                    const label = mt.type === 'LIBERO' ? 'Libero' : 'Substitution';
                                    const rows = (
                                        <div className={`flex flex-col gap-0.5 text-[11px] ${isRightEvent ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-emerald-600 font-bold">↓ {mt.out}</span>
                                                {mt.outName && <span className="text-slate-600">{mt.outName}</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-blue-600 font-bold">↑ {mt.in}</span>
                                                {mt.inName && <span className="text-slate-600">{mt.inName}</span>}
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</span>
                                        </div>
                                    );
                                    return (
                                        <div key={ev.id} className="flex items-start px-3 py-2.5 hover:bg-slate-50 transition-colors border-l-2" style={{ borderColor: accentColor }}>
                                            <div className="flex-1">{isLeftEvent && rows}</div>
                                            <div className="flex-1 flex justify-end">{isRightEvent && rows}</div>
                                        </div>
                                    );
                                }

                                if (mt.type === 'LINEUP_CONFIRM') {
                                    const nums = (mt.lineup || '').split(',').map(s => s.trim()).filter(Boolean);
                                    return (
                                        <div key={ev.id} className="flex items-center px-3 py-2 bg-slate-50/60 hover:bg-slate-100/60 transition-colors border-l-2" style={{ borderColor: accentColor }}>
                                            <div className={`flex flex-wrap gap-1 flex-1 ${isRightEvent ? 'justify-end' : 'justify-start'}`}>
                                                {nums.map((n, i) => (
                                                    <span key={i} className="bg-white border border-slate-200 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">{n}</span>
                                                ))}
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest self-center ml-1">Lineup</span>
                                            </div>
                                        </div>
                                    );
                                }

                                // Generic fallback
                                return (
                                    <div key={ev.id} className="flex items-center px-3 py-2 hover:bg-slate-50 transition-colors">
                                        <div className="flex-1 text-[11px] text-slate-500">{isLeftEvent && ev.description}</div>
                                        <div className="flex-1 text-right text-[11px] text-slate-500">{isRightEvent && ev.description}</div>
                                        {isNeutralEvent && <div className="w-full text-center text-[11px] text-slate-400">{ev.description}</div>}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

            {/* Postponed Challenges Button */}
            {pendingRequests.filter(r => r.request_type === 'CHALLENGE' && postponedChallengeIds.includes(r.id)).length > 0 && (
                <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Postponed Challenges</p>
                    {pendingRequests.filter(r => r.request_type === 'CHALLENGE' && postponedChallengeIds.includes(r.id)).map(req => {
                        const isHome = String(req.team_id) === String(matchData.teamHomeId);
                        const teamColor = isHome ? teamColors.home : teamColors.away;
                        return (
                            <button
                                key={req.id}
                                onClick={() => {
                                    setActiveChallengeRequest(req);
                                    setShowChallengeRequestPopup(true);
                                    setChallengeConfirmMode(false);
                                }}
                                className="w-full mb-1.5 py-1.5 px-2.5 bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-200 rounded hover:bg-blue-100 transition-colors flex justify-between items-center"
                            >
                                <span className="truncate">Challenge: <span style={{ color: teamColor }}>{req.team_name}</span></span>
                                <span className="shrink-0 text-[8px] bg-blue-200 px-1 py-0.5 rounded font-mono uppercase font-black">Resume</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Undo Button at Bottom */}
            <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <button
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="w-full py-2.5 bg-rose-50 text-rose-500 text-sm font-semibold border border-rose-200 rounded disabled:opacity-50 hover:bg-rose-100 transition-colors"
                >
                    Undo last action
                </button>
            </div>

        </aside>
    );
};

export default MatchHistorySidebar;
