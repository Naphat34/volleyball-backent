import React from 'react';
import { Settings, Timer } from 'lucide-react';

import Logo from '../../../assets/img/volleyball.png';

// Helper to extract 3-letter code from team name
const getTeamCode = (teamName) => {
    if (!teamName) return '';
    if (teamName.includes('-')) {
        return teamName.split('-')[0].trim().toUpperCase();
    }
    return teamName.substring(0, 3).toUpperCase();
};

const getSanctionCardType = (metadata = {}, description = '') => {
    const raw = String(metadata.card || metadata.sanctionType || description || '').toUpperCase();
    if (raw.includes('DELAY_PENALTY')) return 'DELAY_PENALTY';
    if (raw.includes('DELAY_WARNING')) return 'DELAY_WARNING';
    if (raw.includes('IMPROPER_REQUEST')) return 'IMPROPER_REQUEST';
    if (raw.includes('DISQUALIFICATION')) return 'DISQUALIFICATION';
    if (raw.includes('EXPULSION')) return 'EXPULSION';
    if (raw.includes('RED') || raw.includes('PENALTY')) return 'RED';
    if (raw.includes('YELLOW') || raw.includes('WARNING')) return 'YELLOW';
    return raw || 'SANCTION';
};

const getSanctionLabel = (cardType) => ({
    YELLOW: 'Yellow card',
    RED: 'Red card',
    DELAY_WARNING: 'Delay warning',
    DELAY_PENALTY: 'Delay penalty',
    EXPULSION: 'Expulsion',
    DISQUALIFICATION: 'Disqualification',
    IMPROPER_REQUEST: 'Improper request'
}[cardType] || 'Sanction');

const SanctionCardMark = ({ cardType }) => {
    if (cardType === 'EXPULSION') {
        return (
            <div className="relative h-7 w-8 shrink-0">
                <span className="absolute left-1 top-1 h-6 w-4 rounded-[3px] bg-amber-400 shadow-sm" />
                <span className="absolute left-3 top-1 h-6 w-4 rounded-[3px] bg-rose-500 shadow-sm" />
            </div>
        );
    }

    if (cardType === 'DISQUALIFICATION') {
        return (
            <div className="flex h-7 w-9 shrink-0 items-center justify-center gap-1">
                <span className="h-6 w-3.5 rounded-[3px] bg-amber-400 shadow-sm" />
                <span className="h-6 w-3.5 rounded-[3px] bg-rose-500 shadow-sm" />
            </div>
        );
    }

    if (cardType === 'IMPROPER_REQUEST') {
        return (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[9px] font-black text-sky-700">
                IR
            </div>
        );
    }

    const color = cardType === 'RED' || cardType === 'DELAY_PENALTY' ? 'bg-rose-500' : 'bg-amber-400';
    return <span className={`h-7 w-5 shrink-0 rounded-[3px] shadow-sm ${color}`} />;
};

const parseLineupNumbers = (lineupText) => {
    if (Array.isArray(lineupText)) return lineupText.map(String).filter(Boolean);
    return String(lineupText || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
};

const formatLineupForCourtSide = (lineupText, side) => {
    const nums = parseLineupNumbers(lineupText);
    if (nums.length < 6) return nums.join(', ');

    // Same visual placement order as CourtView.
    const order = side === 'right' ? [1, 0, 2, 5, 3, 4] : [4, 3, 5, 2, 0, 1];
    return order.map(index => nums[index]).filter(Boolean).join(', ');
};

const MatchHistorySidebar = ({
    matchData,
    staffConnections,
    isHomeLeft,
    homeLineup,
    awayLineup,
    matchEvents,
    activeHistoryTab,
    completedSets,
    setActiveHistoryTab,
    pendingRequests,
    postponedChallengeIds,
    teamColors,
    challengeEnabled = true,
    history,
    setShowSetup,
    setActiveChallengeRequest,
    setShowChallengeRequestPopup,
    setChallengeConfirmMode,
    handleUndo
}) => {
    const completedSetMap = new Map((completedSets || []).map((s) => [Number(s.set), s]));
    const availableSetNumbers = Array.from(new Set([
        ...matchEvents.map((e) => Number(e.set)),
        ...((completedSets || []).map((s) => Number(s.set))),
        Number(matchData.currentSet)
    ]))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);
    const selectedSet = Number(activeHistoryTab) || Number(matchData.currentSet) || 1;
    const selectedSetEvents = matchEvents.filter(e => Number(e.set) === Number(selectedSet));
    const selectedCombinedLineupEvent = selectedSetEvents.find(e => e.metadata?.type === 'LINEUP_CONFIRM' && (e.metadata?.homeLineup || e.metadata?.awayLineup));
    const selectedLegacyLineupEvent = selectedSetEvents.find(e => e.metadata?.type === 'LINEUP_CONFIRM' && e.description?.includes('Lineup Confirmed'));
    const legacyLineupMatch = selectedLegacyLineupEvent?.description?.match(/Lineup Confirmed - .*?: \[([^\]]*)\] \| .*?: \[([^\]]*)\]/);
    const selectedHomeLineupEvent = selectedSetEvents.find(e => e.metadata?.type === 'LINEUP_CONFIRM' && (e.metadata?.teamCode === 'home' || e.metadata?.team === matchData.teamHome));
    const selectedAwayLineupEvent = selectedSetEvents.find(e => e.metadata?.type === 'LINEUP_CONFIRM' && (e.metadata?.teamCode === 'away' || e.metadata?.team === matchData.teamAway));
    const selectedHomeLineupText = selectedCombinedLineupEvent?.metadata?.homeLineup || selectedHomeLineupEvent?.metadata?.lineup || legacyLineupMatch?.[1] || homeLineup.filter(Boolean).map(p => p.number).join(', ');
    const selectedAwayLineupText = selectedCombinedLineupEvent?.metadata?.awayLineup || selectedAwayLineupEvent?.metadata?.lineup || legacyLineupMatch?.[2] || awayLineup.filter(Boolean).map(p => p.number).join(', ');
    const leftLineupText = formatLineupForCourtSide(isHomeLeft ? selectedHomeLineupText : selectedAwayLineupText, 'left');
    const rightLineupText = formatLineupForCourtSide(isHomeLeft ? selectedAwayLineupText : selectedHomeLineupText, 'right');

    return (
        <aside className="w-[300px] bg-white border-l border-slate-200 rounded-lg hidden xl:flex flex-col z-10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden shrink-0">

            {/* Top Row: Staff connection status */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white">
                <button
                    onClick={() => setShowSetup(true)}
                    className="p-1 border border-slate-200 rounded text-slate-400 hover:bg-slate-50 transition-colors"
                >
                    <Settings size={18} />
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
            <div className="p-3 border-b border-slate-100 bg-white">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[15px] font-bold text-[#1e293b]">Match history</h3>
                    <div className="flex items-center bg-[#f8fafc] border border-slate-200 rounded-md px-2 py-1 gap-1.5">
                        <span className="text-[11px] font-bold text-[#475569]">Current</span>
                        <span className="text-[11px] font-bold text-blue-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 min-w-[20px] text-center">{matchData.currentSet}</span>
                    </div>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                    {availableSetNumbers.map((setNum) => {
                        const completed = completedSetMap.get(setNum);
                        const isActive = selectedSet === setNum;
                        return (
                            <button
                                key={setNum}
                                onClick={() => setActiveHistoryTab(setNum)}
                                className={`shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${isActive
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                title={completed ? `Set ${setNum}: ${completed.home}-${completed.away}` : `Set ${setNum}`}
                            >
                                <span>Set {setNum}</span>
                                {completed && (
                                    <span className="ml-1 opacity-80">{completed.home}-{completed.away}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Team Tabs */}
            <div className="flex bg-white shrink-0">
                <div
                    className="min-w-0 flex-1 overflow-hidden px-1 text-center text-xs font-bold border-b-2"
                    title={isHomeLeft ? matchData.teamHome : matchData.teamAway}
                    style={{
                    borderColor: isHomeLeft ? teamColors.home : teamColors.away,
                    backgroundColor: `${isHomeLeft ? teamColors.home : teamColors.away}1A`
                    }}
                >
                    <span className="block truncate">{isHomeLeft ? matchData.teamHome : matchData.teamAway}</span>
                </div>
                <div
                    className="min-w-0 flex-1 overflow-hidden px-1 text-center text-xs font-bold border-b-2"
                    title={isHomeLeft ? matchData.teamAway : matchData.teamHome}
                    style={{
                    borderColor: isHomeLeft ? teamColors.away : teamColors.home,
                    backgroundColor: `${isHomeLeft ? teamColors.away : teamColors.home}1A`
                    }}
                >
                    <span className="block truncate">{isHomeLeft ? matchData.teamAway : matchData.teamHome}</span>
                </div>
            </div>

            {/* Lineup Row */}
            <div className="flex items-center border-b border-slate-200 bg-white text-[10px] font-bold shrink-0">
                <div className="flex-1 text-center py-2 tracking-wider truncate px-1">
                    {leftLineupText}
                </div>
                <div className="px-2.5 py-2 bg-[#f1f5f9] text-slate-500 border-x border-slate-200 uppercase tracking-widest text-[9px]">
                    Lineup
                </div>
                <div className="flex-1 text-center py-2 tracking-wider truncate px-1">
                    {rightLineupText}
                </div>
            </div>

            {/* Feed Area */}
            <div className="flex-1 bg-white overflow-y-auto">
                {(() => {
                    const seenEventKeys = new Set();
                    const setEvents = selectedSetEvents
                        .filter(e => {
                            const mt = e.metadata || {};
                            const key = [
                                e.set,
                                e.score,
                                mt.type || e.type || e.event_type,
                                mt.teamCode || mt.team,
                                mt.in,
                                mt.out,
                                e.description
                            ].join('|');
                            if (seenEventKeys.has(key)) return false;
                            seenEventKeys.add(key);
                            return true;
                        });
                    if (setEvents.length === 0) return (
                        <div className="flex items-center justify-center h-24 text-[11px] text-slate-400">No events yet</div>
                    );

                    return (
                        <div className="divide-y divide-slate-100">
                            {setEvents.map((ev) => {
                                const mt = ev.metadata || {};
                                const isHome = mt.teamCode === 'home' || mt.team === matchData.teamHome;
                                const isAway = mt.teamCode === 'away' || mt.team === matchData.teamAway;
                                const isLeftEvent = isHomeLeft ? isHome : isAway;
                                const isRightEvent = isHomeLeft ? isAway : isHome;
                                const isNeutralEvent = !isLeftEvent && !isRightEvent;
                                const accentColor = isHome ? teamColors.home : isAway ? teamColors.away : '#cbd5e1';
                                const eventTeamName = isHome ? matchData.teamHome : isAway ? matchData.teamAway : mt.team;
                                const [homeScore, awayScore] = (ev.score || '0-0').split('-');
                                const leftScore = isHomeLeft ? homeScore : awayScore;
                                const rightScore = isHomeLeft ? awayScore : homeScore;

                                // ---- Row content by event type ----
                                if (mt.type === 'POINT') {
                                    return (
                                        <div key={ev.id} className="flex items-center px-3 py-1.5 hover:bg-slate-50/80 transition-colors">
                                            {/* Left placeholder or content */}
                                            <div className="flex-1 flex items-center gap-2">
                                                {isLeftEvent && (
                                                    <>
                                                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 opacity-80" style={{ backgroundColor: `${accentColor}18` }}>
                                                           <img src={Logo} alt="Point" className="w-4 h-4" /> 
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-slate-500 truncate">Point {eventTeamName}</span>
                                                    </>
                                                )}
                                            </div>
                                            {/* Score badge center */}
                                            <div className="flex items-center gap-1 text-[11px] font-black px-1.5 py-0.5 rounded-md mx-1 bg-slate-50 border border-slate-100">
                                                <span className="text-slate-700 w-4 text-center">{leftScore}</span>
                                                <span className="text-slate-400">-</span>
                                                <span className="text-slate-700 w-4 text-center">{rightScore}</span>
                                            </div>
                                            {/* Right placeholder or content */}
                                            <div className="flex-1 flex items-center justify-end gap-2">
                                                {isRightEvent && (
                                                    <>
                                                        <span className="text-[10px] font-semibold text-slate-500 truncate">Point {eventTeamName}</span>
                                                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 opacity-80" style={{ backgroundColor: `${accentColor}18` }}>
                                                            <img src={Logo} alt="Point" className="w-4 h-4" />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                if (mt.type === 'TIMEOUT') {
                                    return (
                                        <div key={ev.id} className="flex items-center px-3 py-2.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors border-l-[3px]" style={{ borderColor: accentColor }}>
                                            <div className="flex-1">
                                                {isLeftEvent && (
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-sm" style={{ color: accentColor }}>
                                                        <Timer size={12} />
                                                        Timeout {eventTeamName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 flex justify-end">
                                                {isRightEvent && (
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-sm" style={{ color: accentColor }}>
                                                        Timeout {eventTeamName}
                                                        <Timer size={12} />
                                                    </span>
                                                )}
                                                {isNeutralEvent && <span className="text-[10px] text-slate-400">Timeout {eventTeamName || ''}</span>}
                                            </div>
                                        </div>
                                    );
                                }

                                if (mt.type === 'SUBSTITUTION' || mt.type === 'LIBERO') {
                                    const label = mt.type === 'LIBERO' ? 'Libero' : 'Sub';
                                    const rows = (
                                        <div className={`flex flex-col gap-0.5 text-[11px] ${isRightEvent ? 'items-end text-right' : 'items-start'}`}>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label} {eventTeamName}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-emerald-600 font-bold">↓ {mt.out}</span>
                                                {mt.outName && <span className="text-slate-600">{mt.outName}</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-red-600 font-bold">↑ {mt.in}</span>
                                                {mt.inName && <span className="text-slate-600">{mt.inName}</span>}
                                            </div>
                                        </div>
                                    );
                                    return (
                                        <div key={ev.id} className="flex items-start px-3 py-3 bg-slate-50/60 hover:bg-slate-100/70 transition-colors border-l-[3px]" style={{ borderColor: accentColor }}>
                                            <div className="flex-1">{isLeftEvent && rows}</div>
                                            <div className="flex-1 flex justify-end">{isRightEvent && rows}</div>
                                        </div>
                                    );
                                }

                                if (mt.type === 'SANCTION') {
                                    const cardType = getSanctionCardType(mt, ev.description);
                                    const label = getSanctionLabel(cardType);
                                    const receiver = mt.receiver === 'PLAYER'
                                        ? (mt.player ? `#${mt.player}` : 'Player')
                                        : mt.receiver === 'STAFF'
                                            ? (mt.staff || 'Staff')
                                            : 'Team';
                                    const content = (
                                        <div className={`flex items-center gap-2 ${isRightEvent ? 'flex-row-reverse text-right' : ''}`}>
                                            <SanctionCardMark cardType={cardType} />
                                            <div className="min-w-0">
                                                <div className="text-[11px] font-black uppercase tracking-wide text-slate-700">{label}</div>
                                                <div className="text-[10px] font-semibold text-slate-500 truncate">
                                                    {receiver} {eventTeamName ? `(${eventTeamName})` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <div key={ev.id} className="flex items-center px-3 py-3 bg-amber-50/35 hover:bg-amber-50/70 transition-colors border-l-[3px] shadow-[inset_0_-1px_0_rgba(148,163,184,0.16)]" style={{ borderColor: accentColor }}>
                                            <div className="flex-1">{isLeftEvent && content}</div>
                                            <div className="flex-1 flex justify-end">{isRightEvent && content}</div>
                                            {isNeutralEvent && <div className="w-full flex justify-center">{content}</div>}
                                        </div>
                                    );
                                }

                                if (mt.type === 'LINEUP_CONFIRM') {
                                    const lineupSide = isRightEvent ? 'right' : 'left';
                                    const nums = parseLineupNumbers(formatLineupForCourtSide(mt.lineup || '', lineupSide));
                                    return (
                                        <div key={ev.id} className="flex items-center px-3 py-2.5 bg-blue-50/35 hover:bg-blue-50/70 transition-colors border-l-[3px]" style={{ borderColor: accentColor }}>
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
            {challengeEnabled && pendingRequests.filter(r => r.request_type === 'CHALLENGE' && postponedChallengeIds.includes(r.id)).length > 0 && (
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
