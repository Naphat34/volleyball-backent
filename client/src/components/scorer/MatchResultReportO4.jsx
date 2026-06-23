
import React from 'react';
import { ChevronLeft } from 'lucide-react';

// Helper to format age group
const getAgeGroupName = (id) => {
    const ageGroups = { 1: "Senior", 2: "Junior", 3: "Youth" };
    return ageGroups[parseInt(id)] || "";
};

// Helper to calculate set duration
const getCalculatedSetDuration = (r, fallbackStart) => {
    const start = r.start_time || fallbackStart;
    const end = r.end_time;
    if (!start || !end) {
        return Number(r.duration_minutes) || Number(r.duration) || 0;
    }

    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return null;
        if (timeStr.includes('-') || timeStr.includes('T')) {
            const d = new Date(timeStr);
            if (!isNaN(d)) {
                return d.getHours() * 60 + d.getMinutes();
            }
        }
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (!isNaN(h) && !isNaN(m)) {
                return h * 60 + m;
            }
        }
        return null;
    };

    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);

    if (startMin !== null && endMin !== null) {
        let diff = endMin - startMin;
        if (diff < 0) {
            diff += 24 * 60; // Cross midnight
        }
        return diff;
    }

    return Number(r.duration_minutes) || Number(r.duration) || 0;
};

// Main FIVB O-4 Match Result Report Component
export default function MatchResultReportO4({ matchData, scoreData, rosterData }) {
    if (!matchData) return null;

    // --- Parse Live State from Scorer Console ---
    let liveState = matchData?.live_state || {};
    if (typeof liveState === 'string') {
        try { liveState = JSON.parse(liveState); } catch { liveState = {}; }
    }

    const compName = matchData.title || matchData.competition_title || matchData.competition_name || '';
    const city = matchData.city || matchData.stadium_city || '';
    const time = matchData.start_time ? matchData.start_time.substring(0, 5) : '';
    const matchNumber = matchData.match_number || '';
    const category = matchData.age_group_id ? getAgeGroupName(matchData.age_group_id) : (matchData.competition_category || matchData.category || '');
    const gender = matchData.gender || matchData.competition_gender || '';

    const isHomeOnLeft = matchData.left_side_team_id ? matchData.left_side_team_id === matchData.home_team_id : true;

    // Team IDs mapped to A and B
    const idA = isHomeOnLeft ? matchData.home_team_id : matchData.away_team_id;
    const idB = isHomeOnLeft ? matchData.away_team_id : matchData.home_team_id;

    // Team Names
    const teamA = isHomeOnLeft
        ? (matchData?.home_team_name || matchData?.home_team_code || 'Team A')
        : (matchData?.away_team_name || matchData?.away_team_code || 'Team A');

    const teamB = !isHomeOnLeft
        ? (matchData?.home_team_name || matchData?.home_team_code || 'Team B')
        : (matchData?.away_team_name || matchData?.away_team_code || 'Team B');

    const getPlayerId = (p) => {
        if (!p) return '';
        return p.id || p.player_id || p.playerId || '';
    };

    const getPlayerNo = (p) => {
        if (!p) return '';
        return p.number || p.shirt_number || p.jersey_number || p.shirtNumber || '';
    };

    const getPlayerName = (p) => {
        if (!p) return '';
        const fName = p.first_name || p.firstname || '';
        const lName = p.last_name || p.lastname || p.name || '';
        if (fName && lName) return `${fName} ${lName}`.trim();
        return (lName || fName || '').trim();
    };

    const getFullPlayerDetails = (teamKey, p) => {
        if (!p) return null;
        const rosterList = rosterData?.[teamKey]?.players || [];
        const scoreList = scoreData?.[teamKey === 'home' ? 'homePlayers' : 'awayPlayers'] || 
                          scoreData?.[teamKey === 'home' ? 'home_players' : 'away_players'] || [];
        
        const pId = getPlayerId(p);
        const pNo = getPlayerNo(p);

        let found = rosterList.find(rp => {
            const rpId = getPlayerId(rp);
            const rpNo = getPlayerNo(rp);
            return (pId && rpId && String(rpId) === String(pId)) || 
                   (pNo && rpNo && String(rpNo) === String(pNo));
        });
        if (!found) {
            found = scoreList.find(rp => {
                const rpId = getPlayerId(rp);
                const rpNo = getPlayerNo(rp);
                return (pId && rpId && String(rpId) === String(pId)) || 
                       (pNo && rpNo && String(rpNo) === String(pNo));
            });
        }
        return found ? { ...found, ...p } : p;
    };

    // Roster and player extraction (fallback to liveState)
    let rawHome = (liveState.homeRoster && liveState.homeRoster.length > 0) ? liveState.homeRoster : (rosterData?.home?.players || scoreData?.homePlayers || scoreData?.home_players || []);
    let rawAway = (liveState.awayRoster && liveState.awayRoster.length > 0) ? liveState.awayRoster : (rosterData?.away?.players || scoreData?.awayPlayers || scoreData?.away_players || []);

    // Resolve full details for all players
    rawHome = rawHome.map(p => getFullPlayerDetails('home', p));
    rawAway = rawAway.map(p => getFullPlayerDetails('away', p));

    const actualLineups = scoreData?.lineups || scoreData?.match_lineups || [];
 
    const isLibero = (p) => {
        if (!p) return false;
        const pos = String(p.position || '').trim().toLowerCase();
        const role = String(p.role || '').trim().toUpperCase();
        return pos === 'libero' || pos === 'l' ||
            p.is_libero === true || p.isLibero === true ||
            p.is_libero1 === true || p.is_libero2 === true ||
            role === 'L1' || role === 'L2' || role === 'L1+C' || role === 'L2+C';
    };
 
    const extractLiberos = (teamKey, rawPlayers) => {
        let libs = [];
 
        // 0. ดึงจาก liveState ที่ Scorer ทำการยืนยันหน้าสนามเป็นอันดับแรก
        const liveLibs = liveState?.[teamKey === 'home' ? 'homeLiberos' : 'awayLiberos'];
        if (liveLibs) {
            if (liveLibs.l1 && (getPlayerId(liveLibs.l1) || getPlayerNo(liveLibs.l1))) {
                const found = rawPlayers.find(rp => {
                    const rpId = getPlayerId(rp);
                    const rpNo = getPlayerNo(rp);
                    const lId = getPlayerId(liveLibs.l1);
                    const lNo = getPlayerNo(liveLibs.l1);
                    return (rpId && lId && String(rpId) === String(lId)) ||
                           (rpNo && lNo && String(rpNo) === String(lNo));
                });
                libs.push(found ? { ...found, ...liveLibs.l1 } : liveLibs.l1);
            }
            if (liveLibs.l2 && (getPlayerId(liveLibs.l2) || getPlayerNo(liveLibs.l2))) {
                const found = rawPlayers.find(rp => {
                    const rpId = getPlayerId(rp);
                    const rpNo = getPlayerNo(rp);
                    const lId = getPlayerId(liveLibs.l2);
                    const lNo = getPlayerNo(liveLibs.l2);
                    return (rpId && lId && String(rpId) === String(lId)) ||
                           (rpNo && lNo && String(rpNo) === String(lNo));
                });
                libs.push(found ? { ...found, ...liveLibs.l2 } : liveLibs.l2);
            }
        }
 
        const teamRoster = rosterData?.[teamKey];
        if (teamRoster && libs.length === 0) {
            if (teamRoster.l1 && (getPlayerId(teamRoster.l1) || getPlayerNo(teamRoster.l1))) {
                const found = rawPlayers.find(rp => {
                    const rpId = getPlayerId(rp);
                    const rpNo = getPlayerNo(rp);
                    const lId = getPlayerId(teamRoster.l1);
                    const lNo = getPlayerNo(teamRoster.l1);
                    return (rpId && lId && String(rpId) === String(lId)) ||
                           (rpNo && lNo && String(rpNo) === String(lNo));
                });
                libs.push(found ? { ...found, ...teamRoster.l1 } : teamRoster.l1);
            }
            if (teamRoster.l2 && (getPlayerId(teamRoster.l2) || getPlayerNo(teamRoster.l2))) {
                const found = rawPlayers.find(rp => {
                    const rpId = getPlayerId(rp);
                    const rpNo = getPlayerNo(rp);
                    const lId = getPlayerId(teamRoster.l2);
                    const lNo = getPlayerNo(teamRoster.l2);
                    return (rpId && lId && String(rpId) === String(lId)) ||
                           (rpNo && lNo && String(rpNo) === String(lNo));
                });
                libs.push(found ? { ...found, ...teamRoster.l2 } : teamRoster.l2);
            }
            if (teamRoster.liberos) {
                if (teamRoster.liberos.l1) {
                    const found = rawPlayers.find(rp => {
                        const rpId = getPlayerId(rp);
                        const rpNo = getPlayerNo(rp);
                        const lId = getPlayerId(teamRoster.liberos.l1);
                        const lNo = getPlayerNo(teamRoster.liberos.l1);
                        return (rpId && lId && String(rpId) === String(lId)) ||
                               (rpNo && lNo && String(rpNo) === String(lNo));
                    });
                    libs.push(found ? { ...found, ...teamRoster.liberos.l1 } : teamRoster.liberos.l1);
                }
                if (teamRoster.liberos.l2) {
                    const found = rawPlayers.find(rp => {
                        const rpId = getPlayerId(rp);
                        const rpNo = getPlayerNo(rp);
                        const lId = getPlayerId(teamRoster.liberos.l2);
                        const lNo = getPlayerNo(teamRoster.liberos.l2);
                        return (rpId && lId && String(rpId) === String(lId)) ||
                               (rpNo && lNo && String(rpNo) === String(lNo));
                    });
                    libs.push(found ? { ...found, ...teamRoster.liberos.l2 } : teamRoster.liberos.l2);
                }
            }
        }
        if (libs.length === 0) {
            const teamScore = scoreData?.[teamKey] || scoreData?.roster?.[teamKey];
            if (teamScore) {
                if (teamScore.l1) {
                    const found = rawPlayers.find(rp => {
                        const rpId = getPlayerId(rp);
                        const rpNo = getPlayerNo(rp);
                        const lId = getPlayerId(teamScore.l1);
                        const lNo = getPlayerNo(teamScore.l1);
                        return (rpId && lId && String(rpId) === String(lId)) ||
                               (rpNo && lNo && String(rpNo) === String(lNo));
                    });
                    libs.push(found ? { ...found, ...teamScore.l1 } : teamScore.l1);
                }
                if (teamScore.l2) {
                    const found = rawPlayers.find(rp => {
                        const rpId = getPlayerId(rp);
                        const rpNo = getPlayerNo(rp);
                        const lId = getPlayerId(teamScore.l2);
                        const lNo = getPlayerNo(teamScore.l2);
                        return (rpId && lId && String(rpId) === String(lId)) ||
                               (rpNo && lNo && String(rpNo) === String(lNo));
                    });
                    libs.push(found ? { ...found, ...teamScore.l2 } : teamScore.l2);
                }
            }
        }
        if (libs.length === 0 && Array.isArray(rawPlayers)) {
            libs = rawPlayers.filter(p => isLibero(p));
        }
 
        const uniqueLibs = [];
        libs.forEach(l => {
            if (l && (getPlayerId(l) || getPlayerNo(l))) {
                if (!uniqueLibs.some(ul => {
                    const ulId = getPlayerId(ul);
                    const ulNo = getPlayerNo(ul);
                    const lId = getPlayerId(l);
                    const lNo = getPlayerNo(l);
                    return (ulId && lId && String(ulId) === String(lId)) ||
                           (ulNo && lNo && String(ulNo) === String(lNo));
                })) {
                    uniqueLibs.push(l);
                }
            }
        });
        return uniqueLibs.slice(0, 2);
    };
 
    const homeLibs = extractLiberos('home', rawHome);
    const awayLibs = extractLiberos('away', rawAway);
 
    const isPlayerInLibs = (p, libs) => libs.some(l => {
        const pId = getPlayerId(p);
        const pNo = getPlayerNo(p);
        const lId = getPlayerId(l);
        const lNo = getPlayerNo(l);
        return (pId && lId && String(pId) === String(lId)) ||
               (pNo && lNo && String(pNo) === String(lNo));
    });
 
    const homeNormalPlayers = rawHome.filter(p => !isLibero(p) && p.role !== 'Coach' && !isPlayerInLibs(p, homeLibs));
    const awayNormalPlayers = rawAway.filter(p => !isLibero(p) && p.role !== 'Coach' && !isPlayerInLibs(p, awayLibs));
 
    const playersA = isHomeOnLeft ? homeNormalPlayers : awayNormalPlayers;
    const playersB = isHomeOnLeft ? awayNormalPlayers : homeNormalPlayers;
    const liberosA = isHomeOnLeft ? homeLibs : awayLibs;
    const liberosB = isHomeOnLeft ? awayLibs : homeLibs;
 
    // Format players for display (A and B) - merge normal players + liberos, total up to 12
    const formatTeamPlayers = (normalList, liberosList) => {
        const list = [];
        const maxNormal = Math.max(0, 12 - liberosList.length);
        const slicedNormal = normalList.slice(0, maxNormal);

        slicedNormal.forEach(p => {
            const isCap = p.is_captain === true || p.isCaptain === true || p.role === 'C' || p.role === 'L1+C' || p.role === 'L2+C' || String(p.is_captain) === 'true' || String(p.isCaptain) === 'true';
            const tag = isCap ? 'C' : '';
            list.push({ number: getPlayerNo(p), tag, name: getPlayerName(p) });
        });
        liberosList.forEach((p) => {
            const isCap = p.is_captain === true || p.isCaptain === true || p.role === 'C' || p.role === 'L1+C' || p.role === 'L2+C' || String(p.is_captain) === 'true' || String(p.isCaptain) === 'true';
            const tag = isCap ? 'C/L' : 'L';
            list.push({ number: getPlayerNo(p), tag, name: getPlayerName(p) });
        });
        // Pad to exactly 12 items
        while (list.length < 12) {
            list.push({ number: '', tag: '', name: '' });
        }
        return list.slice(0, 12);
    };

    const displayPlayersA = formatTeamPlayers(playersA, liberosA);
    const displayPlayersB = formatTeamPlayers(playersB, liberosB);

    // Staff / Coaches
    const getStaffName = (staffArray, roles) => {
        if (!Array.isArray(staffArray)) return '';
        const staff = staffArray.find(s => {
            const r = String(s.role || '').toLowerCase().trim();
            return roles.some(role => r.includes(role));
        });
        return staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : '';
    };

    const homeStaff = rosterData?.home?.staff || [];
    const awayStaff = rosterData?.away?.staff || [];

    const hCoach = getStaffName(homeStaff, ['head coach', 'coach']) || scoreData?.home_coach || '';
    const aCoach = getStaffName(awayStaff, ['head coach', 'coach']) || scoreData?.away_coach || '';

    const coachA = isHomeOnLeft ? hCoach : aCoach;
    const coachB = isHomeOnLeft ? aCoach : hCoach;

    const hAssistant = getStaffName(homeStaff, ['assistant coach 1', 'assistant coach', 'assistant']) || scoreData?.home_assistant_coach || '';
    const aAssistant = getStaffName(awayStaff, ['assistant coach 1', 'assistant coach', 'assistant']) || scoreData?.away_assistant_coach || '';

    const assistantCoachA = isHomeOnLeft ? hAssistant : aAssistant;
    const assistantCoachB = isHomeOnLeft ? aAssistant : hAssistant;

    // Referees
    const firstReferee = refereesText(matchData.r1_firstname, matchData.r1_lastname) || scoreData?.match?.referee1 || '';
    const secondReferee = refereesText(matchData.r2_firstname, matchData.r2_lastname) || scoreData?.match?.referee2 || '';

    function refereesText(first, last) {
        if (first && last) return `${first} ${last}`;
        return first || last || '';
    }

    // Results mapping
    const rawResults = scoreData?.sets || scoreData?.results || [];
    const results = Array.from({ length: 5 }, (_, i) => {
        const setNum = i + 1;
        return rawResults.find(r => Number(r.set_number) === setNum) || {};
    });

    const getScoreA = (idx) => isHomeOnLeft ? (Number(results[idx]?.home_score) || 0) : (Number(results[idx]?.away_score) || 0);
    const getScoreB = (idx) => isHomeOnLeft ? (Number(results[idx]?.away_score) || 0) : (Number(results[idx]?.home_score) || 0);

    const totalHomeWon = rawResults.filter(r => (Number(r.home_score) || 0) > (Number(r.away_score) || 0)).length;
    const totalAwayWon = rawResults.filter(r => (Number(r.away_score) || 0) > (Number(r.home_score) || 0)).length;
    const totalWonA = isHomeOnLeft ? totalHomeWon : totalAwayWon;
    const totalWonB = isHomeOnLeft ? totalAwayWon : totalHomeWon;

    const totalPointsA = results.reduce((sum, _, idx) => sum + getScoreA(idx), 0);
    const totalPointsB = results.reduce((sum, _, idx) => sum + getScoreB(idx), 0);

    // Starting Lineups and Substitutes
    const getPlayerNoById = (playerId) => {
        if (!playerId) return '';
        const player = [...rawHome, ...rawAway].find(p => {
            const pId = getPlayerId(p);
            return pId && String(pId) === String(playerId);
        });
        return player ? getPlayerNo(player) : '';
    };

    const getLineupForSet = (setNum, teamId) => {
        if (!teamId || actualLineups.length === 0) return Array(6).fill('');
        const lineup = actualLineups.find(l => String(l.set_number) === String(setNum) && String(l.team_id) === String(teamId));
        if (!lineup) return Array(6).fill('');
        return [
            getPlayerNoById(lineup.player_id_p1), getPlayerNoById(lineup.player_id_p2),
            getPlayerNoById(lineup.player_id_p3), getPlayerNoById(lineup.player_id_p4),
            getPlayerNoById(lineup.player_id_p5), getPlayerNoById(lineup.player_id_p6)
        ];
    };

    const getSubstitutesForSet = (setNum, teamId) => {
        if (!teamId || !scoreData?.events) return Array(6).fill('');

        const subEvents = scoreData.events.filter(e =>
            String(e.set_id) === String(setNum) &&
            String(e.team_id) === String(teamId) &&
            e.event_type === 'SUBSTITUTION'
        );

        const lineup = actualLineups.find(l => String(l.set_number) === String(setNum) && String(l.team_id) === String(teamId));
        if (!lineup) return Array(6).fill('');

        const startingIds = [
            lineup.player_id_p1, lineup.player_id_p2, lineup.player_id_p3,
            lineup.player_id_p4, lineup.player_id_p5, lineup.player_id_p6
        ];

        return startingIds.map(startPlayerId => {
            const sub = subEvents.find(e => {
                let d = {};
                try { d = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {}); } catch {/**/}
                return String(d.player_out_id || d.out) === String(startPlayerId);
            });
            return sub ? getPlayerNoById(sub.player_id) : '';
        });
    };

    // Calculate Set Durations
    const setDurations = results.map((r, idx) => getCalculatedSetDuration(r, idx === 0 ? matchData?.start_time : null));
    const totalDuration = setDurations.reduce((sum, d) => sum + d, 0);

    return (
        <div className="o4-paper w-[820px] min-h-[1000px] mx-auto bg-white border border-gray-300 p-8 shadow-md text-[11px] leading-snug font-sans text-black select-none box-border flex flex-col justify-between">
            {/* Style override for printing O-4 */}
            <style>{`
                @media print {
                    body {
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .o4-paper {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 8mm !important;
                        width: 100% !important;
                        height: 100% !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
                .bordered-table th, .bordered-table td {
                    border: 1px solid black;
                    padding: 3px 5px;
                    text-align: center;
                }
                .input-line {
                    border-bottom: 1px solid black;
                    display: inline-block;
                    min-width: 120px;
                    padding-left: 5px;
                    font-weight: bold;
                }
            `}</style>

            <div>
                {/* --- 1. HEADER SECTION --- */}
                <div className="flex border-2 border-black h-[90px] mb-1.5 shrink-0 bg-white">
                    {/* Left Part: 60% Competition Name */}
                    <div className="w-[60%] border-r-2 border-black p-3 flex flex-col justify-center">
                        <div className="font-bold text-[9px] text-gray-500 uppercase tracking-tight">COMPETITION NAME (INCLUDING SEX AND CATEGORY) + LOGO</div>
                        <div className="font-bold text-[8px] text-gray-400 italic mb-1">Nom et emblème de la compétition (incluant sexe et catégorie)</div>
                        <div className="font-black text-[13px] uppercase text-gray-900 leading-snug">
                            {compName}{gender ? ` - ${gender === 'Male' ? 'Men' : gender === 'Female' ? 'Women' : gender}` : ''}{category ? ` (${category})` : ''}
                        </div>
                    </div>

                    {/* Right Part: 40% FIVB + O-4 (stacked vertically) */}
                    <div className="w-[40%] flex flex-col">
                        {/* Top half: FEDERATION ... + FIVB Logo */}
                        <div className="h-[55%] border-b-2 border-black flex items-center justify-between px-3 py-1 bg-white">
                            <div className="font-bold text-[8px] text-gray-750 leading-[1.15] tracking-tight">
                                FEDERATION<br />INTERNATIONALE<br />DE VOLLEYBALL
                            </div>
                            <div className="flex flex-col items-center justify-center shrink-0">
                                <span className="text-[15px] font-black italic tracking-tighter leading-none">FIVB</span>
                                {/* SVG curve line underneath the logo */}
                                <svg className="w-[70px] h-[5px] mt-0.5 text-black" viewBox="0 0 100 10" preserveAspectRatio="none">
                                    <path d="M 0 8 Q 50 0 100 8" stroke="currentColor" strokeWidth="2.5" fill="none" />
                                </svg>
                            </div>
                        </div>

                        {/* Bottom half: O-4 + MATCH RESULT REPORT */}
                        <div className="h-[45%] flex items-center px-2 py-1 gap-2 bg-white">
                            {/* O-4 box */}
                            <div className="w-[22%] h-full border border-black bg-gray-100 flex items-center justify-center font-black text-[13px]">
                                O-4
                            </div>
                            {/* MATCH RESULT REPORT box */}
                            <div className="flex-1 h-full border border-black p-1 pl-2 flex flex-col justify-center leading-none bg-white">
                                <span className="font-black text-[8.5px] text-gray-800">MATCH RESULT REPORT</span>
                                <span className="text-[7px] font-bold text-gray-400 italic mt-0.5">Rapport de résultat de match</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- 2. METADATA ROW 1 --- */}
                <div className="flex gap-2 mb-1">
                    <div className="flex-1 flex items-center gap-1.5 border border-black p-1 bg-white h-7">
                        <span className="font-bold text-[10px] whitespace-nowrap">CITY :</span>
                        <span className="font-bold text-[11px] truncate flex-1 uppercase">{city}</span>
                    </div>
                    <div className="w-[180px] flex items-center justify-center border border-black p-1 bg-white h-7 gap-1">
                        <span className="font-bold text-[10px]">DATE :</span>
                        <span className="font-bold text-[11px]">
                            {matchData.match_date ? new Date(matchData.match_date).toLocaleDateString('en-GB') : '__/__/____'}
                        </span>
                    </div>
                    <div className="w-[130px] flex items-center justify-center border border-black p-1 bg-white h-7 gap-1">
                        <span className="font-bold text-[10px]">TIME :</span>
                        <span className="font-bold text-[11px] tracking-widest">{time || '__:__'}</span>
                    </div>
                </div>

                {/* --- 3. METADATA ROW 2 --- */}
                <div className="flex gap-2 mb-1.5">
                    <div className="w-[120px] flex items-center border border-black p-1 h-7">
                        <span className="font-bold text-[10px] mr-1">MATCH N° :</span>
                        <span className="font-bold text-[11px]">{matchNumber}</span>
                    </div>
                    <div className="flex-1 flex items-center border border-black p-1 h-7">
                        <span className="font-bold text-[10px] mr-1">HALL :</span>
                        <span className="font-bold text-[11px] uppercase truncate">{matchData.stadium_name || matchData.location || ''}</span>
                    </div>
                    <div className="w-[160px] flex items-center border border-black p-1 h-7">
                        <span className="font-bold text-[10px] mr-1">POOL/PHASE :</span>
                        <span className="font-bold text-[11px] truncate uppercase">{[matchData.pool_name, matchData.round_name].filter(Boolean).join(' / ')}</span>
                    </div>
                    <div className="w-[130px] flex items-center border border-black p-1 h-7">
                        <span className="font-bold text-[10px] mr-1">SPECTATORS :</span>
                        <span className="font-bold text-[11px]">{matchData.spectators || '0'}</span>
                    </div>
                </div>

                {/* --- 4. TEAM DETAILS & MATCH RESULT TABLE --- */}
                <div className="flex gap-2 border-2 border-black p-2 mb-2 bg-white">
                    {/* Left Column: Team A */}
                    <div className="w-[33%] flex flex-col">
                        <div className="border-b border-black pb-1 mb-1 font-bold">
                            TEAM A: <span className="font-black ml-1 uppercase">{teamA}</span>
                        </div>
                        <table className="w-full text-[10.5px]">
                            <thead>
                                <tr className="border-b border-black text-left font-bold text-[9px] text-gray-500">
                                    <th className="w-8">N°</th>
                                    <th className="w-8">C/L</th>
                                    <th>Name of Players</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayPlayersA.map((p, idx) => (
                                    <tr key={idx} className="h-[21px] border-b border-gray-100">
                                        <td className="font-bold text-center border-r border-gray-100">{p.number}</td>
                                        <td className="text-center font-bold border-r border-gray-100">{p.tag}</td>
                                        <td className="pl-1 truncate font-medium max-w-[150px]">{p.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Middle Column: Match Result & Table */}
                    <div className="w-[34%] px-1.5 flex flex-col border-x border-black">
                        <div className="border-b border-black pb-1 mb-1 font-bold text-center uppercase tracking-wide text-[12px]">
                            MATCH RESULT
                        </div>
                        <div className="w-full border-2 border-black flex flex-col justify-between h-full bg-white">
                            <div>
                                {/* Sets Won Header with Dots */}
                                <div className="text-center font-bold text-[11px] py-1 border-b border-black flex items-center justify-between px-3">
                                    <span className="flex-1 mx-2 border-b border-dotted border-black mb-1">{totalWonA}</span>
                                    <span className="uppercase tracking-wider font-black text-[10.5px]">Sets Won</span>
                                    <span className="flex-1 mx-2 border-b border-dotted border-black mb-1">{totalWonB}</span>
                                </div>

                                {/* Result Table */}
                                <table className="w-full text-[10.5px] border-collapse bg-white">
                                    <thead>
                                        <tr className="border-b border-black">
                                            {/* Left Column Header */}
                                            <th className="w-[40%] border-r border-black py-1.5 align-top">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">TEAM</span>
                                                    <div className="flex gap-2 mt-1">
                                                        <div className={isHomeOnLeft 
                                                            ? "w-[18px] h-[18px] rounded-full border border-black bg-black text-white flex items-center justify-center font-bold text-[10px]" 
                                                            : "w-[18px] h-[18px] rounded-full border border-black text-black flex items-center justify-center font-medium text-[10px]"}>A</div>
                                                        <div className={!isHomeOnLeft 
                                                            ? "w-[18px] h-[18px] rounded-full border border-black bg-black text-white flex items-center justify-center font-bold text-[10px]" 
                                                            : "w-[18px] h-[18px] rounded-full border border-black text-black flex items-center justify-center font-medium text-[10px]"}>B</div>
                                                    </div>
                                                </div>
                                            </th>
                                            {/* Middle Column Header */}
                                            <th className="w-[20%] border-r border-black py-1.5 align-top">
                                                <div className="flex flex-col items-center leading-none justify-center h-full">
                                                    <span className="text-[7.5px] font-bold text-gray-500 uppercase tracking-tighter">Points Won</span>
                                                    <span className="text-[10px] font-black uppercase mt-1">Sets</span>
                                                </div>
                                            </th>
                                            {/* Right Column Header */}
                                            <th className="w-[40%] py-1.5 align-top">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">TEAM</span>
                                                    <div className="flex gap-2 mt-1">
                                                        <div className={!isHomeOnLeft 
                                                            ? "w-[18px] h-[18px] rounded-full border border-black bg-black text-white flex items-center justify-center font-bold text-[10px]" 
                                                            : "w-[18px] h-[18px] rounded-full border border-black text-black flex items-center justify-center font-medium text-[10px]"}>A</div>
                                                        <div className={isHomeOnLeft 
                                                            ? "w-[18px] h-[18px] rounded-full border border-black bg-black text-white flex items-center justify-center font-bold text-[10px]" 
                                                            : "w-[18px] h-[18px] rounded-full border border-black text-black flex items-center justify-center font-medium text-[10px]"}>B</div>
                                                    </div>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[0, 1, 2, 3, 4].map(idx => {
                                            const scoreA = getScoreA(idx);
                                            const scoreB = getScoreB(idx);
                                            const isSetPlayed = scoreA > 0 || scoreB > 0;

                                            return (
                                                <tr key={idx} className="border-b border-black h-[21px]">
                                                    {/* Left Points */}
                                                    <td className="border-r border-black text-center font-bold text-[11px]">
                                                        {isSetPlayed ? scoreA : ''}
                                                    </td>
                                                    {/* Set Number */}
                                                    <td className="border-r border-black text-center font-bold text-[10.5px] bg-gray-50">
                                                        {idx + 1}
                                                    </td>
                                                    {/* Right Points */}
                                                    <td className="text-center font-bold text-[11px]">
                                                        {isSetPlayed ? scoreB : ''}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total Row */}
                                        <tr className="h-[21px] border-b border-black">
                                            {/* Left Total */}
                                            <td className="border-r border-black text-center font-black text-[11px] bg-gray-50">
                                                {totalPointsA}
                                            </td>
                                            {/* TOTAL label */}
                                            <td className="border-r border-black text-center font-black text-[8.5px] bg-gray-150 uppercase tracking-wider">
                                                TOTAL
                                            </td>
                                            {/* Right Total */}
                                            <td className="text-center font-black text-[11px] bg-gray-50">
                                                {totalPointsB}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Signatures and Referees Section */}
                            <div className="border-t border-black p-2.5 space-y-1.5 bg-white flex flex-col justify-between">
                                {/* 1st Coach */}
                                <div className="flex items-center text-[10px] w-full gap-1">
                                    <span className="flex-1 border-b border-black text-center font-bold truncate h-3.5 leading-none">
                                        {coachB || ''}
                                    </span>
                                    <span className="font-bold whitespace-nowrap px-0.5 text-gray-700">1st Coach</span>
                                    <span className="flex-1 border-b border-black text-center font-bold truncate h-3.5 leading-none">
                                        {coachA || ''}
                                    </span>
                                </div>

                                {/* 2nd Coach */}
                                <div className="flex items-center text-[10px] w-full gap-1">
                                    <span className="flex-1 border-b border-black text-center font-bold truncate h-3.5 leading-none">
                                        {assistantCoachB || ''}
                                    </span>
                                    <span className="font-bold whitespace-nowrap px-0.5 text-gray-700">2nd Coach</span>
                                    <span className="flex-1 border-b border-black text-center font-bold truncate h-3.5">
                                        {assistantCoachA || ''}
                                    </span>
                                </div>

                                {/* 1st Referee */}
                                <div className="flex items-center text-[10px] w-full gap-1 pt-0.5">
                                    <span className="font-bold whitespace-nowrap pr-1.5 text-gray-700">1st Referee</span>
                                    <span className="flex-1 border-b border-black text-left pl-1.5 font-bold truncate h-3.5 leading-none">
                                        {firstReferee || ''}
                                    </span>
                                </div>

                                {/* 2nd Referee */}
                                <div className="flex items-center text-[9.5px] w-full gap-1">
                                    <span className="font-bold whitespace-nowrap pr-1.5 text-gray-700">2nd Referee</span>
                                    <span className="flex-1 border-b border-black text-left pl-1.5 font-bold truncate h-3.5 leading-none">
                                        {secondReferee || ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Team B */}
                    <div className="w-[33%] flex flex-col">
                        <div className="border-b border-black pb-1 mb-1 font-bold">
                            TEAM B: <span className="font-black ml-1 uppercase">{teamB}</span>
                        </div>
                        <table className="w-full text-[10.5px]">
                            <thead>
                                <tr className="border-b border-black text-left font-bold text-[9px] text-gray-500">
                                    <th className="w-8">N°</th>
                                    <th className="w-8">C/L</th>
                                    <th>Name of Players</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayPlayersB.map((p, idx) => (
                                    <tr key={idx} className="h-[21px] border-b border-gray-100">
                                        <td className="font-bold text-center border-r border-gray-100">{p.number}</td>
                                        <td className="text-center font-bold border-r border-gray-100">{p.tag}</td>
                                        <td className="pl-1 truncate font-medium max-w-[150px]">{p.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- 5. STARTING PLAYERS & SUBSTITUTIES GRID --- */}
                <div className="border-2 border-black p-2 bg-white">
                    <div className="text-center font-black text-[11px] uppercase tracking-wide border-b border-black pb-1 mb-2">STARTING PLAYERS</div>
                    <div className="flex justify-between items-stretch">
                        {/* Team A Grid */}
                        <div className="w-[47%] flex flex-col justify-between">
                            <div className="flex items-center justify-between border-b border-black font-bold text-[9.5px] pb-1 mb-1 bg-gray-50 px-1">
                                <span>TEAM A Substitutes</span>
                                <span>TEAM A Starting Players</span>
                            </div>
                            <table className="w-full text-[10px] border-collapse bordered-table">
                                <thead>
                                    <tr className="bg-gray-100 font-bold text-[8.5px]">
                                        <th colSpan="6">Substituties</th>
                                        <th colSpan="6" className="bg-gray-150">Starting Players</th>
                                    </tr>
                                    <tr className="bg-gray-50 text-[8px] font-bold">
                                        <th>I</th><th>II</th><th>III</th><th>IV</th><th>V</th><th>VI</th>
                                        <th className="bg-gray-100">I</th><th className="bg-gray-100">II</th><th className="bg-gray-100">III</th><th className="bg-gray-100">IV</th><th className="bg-gray-100">V</th><th className="bg-gray-100">VI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2, 3, 4, 5].map(setNum => {
                                        const starts = getLineupForSet(setNum, idA);
                                        const subs = getSubstitutesForSet(setNum, idA);
                                        return (
                                            <tr key={setNum} className="h-[21px]">
                                                {/* Subs I to VI */}
                                                {subs.map((s, idx) => <td key={idx} className="font-bold text-gray-600">{s}</td>)}
                                                {/* Starting I to VI */}
                                                {starts.map((s, idx) => <td key={idx} className="font-black bg-gray-50">{s}</td>)}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* SETS Column */}
                        <div className="w-[5%] flex flex-col justify-end items-center">
                            <table className="w-full text-[10px] border-collapse bordered-table h-[133.5px]">
                                <thead>
                                    <tr className="bg-gray-100 font-bold text-[8.5px] h-[28.5px]">
                                        <th>Sets</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2, 3, 4, 5].map(setNum => (
                                        <tr key={setNum} className="h-[21px]">
                                            <td className="font-bold bg-white">{setNum}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Team B Grid */}
                        <div className="w-[47%] flex flex-col justify-between">
                            <div className="flex items-center justify-between border-b border-black font-bold text-[9.5px] pb-1 mb-1 bg-gray-50 px-1">
                                <span>TEAM B Starting Players</span>
                                <span>TEAM B Substitutes</span>
                            </div>
                            <table className="w-full text-[10px] border-collapse bordered-table">
                                <thead>
                                    <tr className="bg-gray-100 font-bold text-[8.5px]">
                                        <th colSpan="6" className="bg-gray-150">Starting Players</th>
                                        <th colSpan="6">Substitutes</th>
                                    </tr>
                                    <tr className="bg-gray-50 text-[8px] font-bold">
                                        <th className="bg-gray-100">I</th><th className="bg-gray-100">II</th><th className="bg-gray-100">III</th><th className="bg-gray-100">IV</th><th className="bg-gray-100">V</th><th className="bg-gray-100">VI</th>
                                        <th>I</th><th>II</th><th>III</th><th>IV</th><th>V</th><th>VI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2, 3, 4, 5].map(setNum => {
                                        const starts = getLineupForSet(setNum, idB);
                                        const subs = getSubstitutesForSet(setNum, idB);
                                        return (
                                            <tr key={setNum} className="h-[21px]">
                                                {/* Starting I to VI */}
                                                {starts.map((s, idx) => <td key={idx} className="font-black bg-gray-50">{s}</td>)}
                                                {/* Subs I to VI */}
                                                {subs.map((s, idx) => <td key={idx} className="font-bold text-gray-600">{s}</td>)}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* --- 6. GAME JURY & DURATION BOTTOM BOX --- */}
                <div className="flex gap-2 mt-1.5">
                    {/* Left: Game Jury Match Report */}
                    <div className="flex-1 border-2 border-black p-2.5 bg-white flex flex-col justify-between">
                        <div className="font-black text-[10px] border-b border-black pb-1 mb-1.5">GAME JURY MATCH REPORT</div>
                        <div className="space-y-1.5 text-[9.5px]">
                            <div>
                                <span className="font-bold">HEADLINE :</span>
                                <span className="input-line w-[80%]"></span>
                            </div>
                            <div className="flex gap-4">
                                <div>
                                    <span className="font-bold">MAX. TEMPERATURE :</span>
                                    <span className="input-line w-[80px]"></span>
                                </div>
                                <div>
                                    <span className="font-bold">MAX. HUMIDITY :</span>
                                    <span className="input-line w-[80px]"></span>
                                </div>
                            </div>
                            <div>
                                <span className="font-bold">REMARKS :</span>
                                <span className="input-line w-[85%]"></span>
                            </div>
                            <div className="flex gap-4 items-center">
                                <span className="font-bold">DOPING CONTROL :</span>
                                <span className="text-[8.5px] text-gray-500">N° of players drawn :</span>
                                <div className="flex gap-3">
                                    <div className="flex items-center gap-1">
                                        <span>Team A:</span>
                                        <div className="w-5 h-5 border border-black text-center bg-gray-50 font-bold flex items-center justify-center"></div>
                                        <div className="w-5 h-5 border border-black text-center bg-gray-50 font-bold flex items-center justify-center"></div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span>Team B:</span>
                                        <div className="w-5 h-5 border border-black text-center bg-gray-50 font-bold flex items-center justify-center"></div>
                                        <div className="w-5 h-5 border border-black text-center bg-gray-50 font-bold flex items-center justify-center"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-end mt-2 pt-1.5 border-t border-gray-200">
                            <div>
                                <div className="font-bold text-[9px] text-gray-600">Game Jury President</div>
                                <div className="input-line w-[200px] mt-1"></div>
                                <div className="text-[8px] text-gray-400 text-center font-bold">Name & Signature</div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Sets Duration */}
                    <div className="w-[220px] border-2 border-black p-2.5 bg-white flex flex-col">
                        <div className="font-black text-[10px] border-b border-black pb-1 mb-1.5">SETS DURATION:</div>
                        <div className="flex-1 flex flex-col justify-between text-[10px] font-bold space-y-1">
                            {[0, 1, 2, 3, 4].map(idx => {
                                const dur = setDurations[idx];
                                return (
                                    <div key={idx} className="flex justify-between border-b border-gray-100 pb-0.5">
                                        <span>Set {idx + 1}</span>
                                        <span className="font-black text-gray-800">{dur > 0 ? `${dur} min.` : '...... min.'}</span>
                                    </div>
                                );
                            })}
                            <div className="flex justify-between pt-1 border-t border-black text-red-650 text-[11px] font-black">
                                <span>Total</span>
                                <span>{totalDuration > 0 ? `${totalDuration} min.` : '...... min.'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 7. FOOTER --- */}
            <div className="flex justify-between items-center text-[7.5px] font-bold text-gray-400 border-t border-gray-200 pt-1 mt-2 shrink-0">
                <span>Print: {new Date().toLocaleString()} eScorersheet Version DEMO 2026.06.11</span>
                <span>Phatthalung Provincial Volleyball Association</span>
            </div>
        </div>
    );
}
