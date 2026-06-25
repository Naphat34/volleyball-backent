import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Printer, ArrowLeft } from 'lucide-react';
import MatchResultReportO4 from '../components/scorer/MatchResultReportO4';


const getAgeGroupName = (id) => {
    const ageGroups = { 1: "Senior", 2: "Junior", 3: "Youth" };
    return ageGroups[parseInt(id)] || "";
};
const formatSetTime = (timeStr) => {
    if (!timeStr) return '';
    // กรณีเป็น Timestamp เต็มรูปแบบจาก DB
    if (timeStr.includes('-') || timeStr.includes('T')) {
        const d = new Date(timeStr);
        if (!isNaN(d)) {
            return `${d.getHours().toString().padStart(2, '0')} : ${d.getMinutes().toString().padStart(2, '0')}`;
        }
    }
    // กรณีเป็น Time string ปกติ (เช่น "21:30:00")
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        return `${parts[0]} : ${parts[1]}`;
    }
    return '';
};

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

const formatMatchTime = (rawTime) => {
    if (!rawTime) return '___ h ___ mn';
    const formatted = formatSetTime(rawTime);
    if (!formatted) return '___ h ___ mn';
    const parts = formatted.replace(/\s+/g, '').split(':');
    if (parts.length === 2) {
        return `${parts[0]} h ${parts[1]} mn`;
    }
    return '___ h ___ mn';
};

const getTeamFontSize = (name, baseSize = 12) => {
    const len = name ? name.length : 0;
    if (baseSize === 14) {
        if (len > 25) return 'text-[8.5px]';
        if (len > 20) return 'text-[10px]';
        if (len > 15) return 'text-[12px]';
        return 'text-[14px]';
    }
    if (baseSize === 12) {
        if (len > 25) return 'text-[8px]';
        if (len > 20) return 'text-[9.5px]';
        if (len > 15) return 'text-[11px]';
        return 'text-[12px]';
    }
    if (baseSize === 10) {
        if (len > 25) return 'text-[7.5px]';
        if (len > 20) return 'text-[8.5px]';
        if (len > 15) return 'text-[9.5px]';
        return 'text-[10px]';
    }
    return `text-[${baseSize}px]`;
};

export default function ScoreSheet({ matchId }) {
    const params = useParams();
    const effectiveMatchId = matchId || params.matchId;
    const navigate = useNavigate();

    const [matchData, setMatchData] = useState(null);
    const [scoreData, setScoreData] = useState(null);
    const [rosterData, setRosterData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [searchParams] = useSearchParams();
    const [showO4, setShowO4] = useState(() => {
        const view = searchParams.get('view');
        return view === 'result' || view === 'o4';
    });

    useEffect(() => {
        // แก้ไข: ใช้ effectiveMatchId แทน matchId (prop)
        if (!effectiveMatchId) return;

        const fetchScoreSheetData = async () => {
            try {
                setLoading(true); // ป้องกันการกระพริบของข้อมูล

                // ดึงข้อมูลทั้งหมดโดยส่ง effectiveMatchId ที่มีค่าแล้วไปให้ API
                const [matchRes, compsRes, teamsRes, scoreRes, rosterRes] = await Promise.all([
                    api.getMatchById(effectiveMatchId).catch(() => ({ data: {} })),
                    api.getAllCompetitions().catch(() => ({ data: [] })),
                    api.getAllTeams().catch(() => ({ data: [] })),
                    api.getMatchScoresheetData(effectiveMatchId).catch(() => ({ data: {} })),
                    api.getMatchRosterData(effectiveMatchId).catch(() => ({ data: {} })),
                ]);

                // ป้องกันกรณี matchRes.data เป็น null ให้สร้างเป็น Object ว่างแทน
                let currentMatchData = {
                    ...(matchRes?.data || {}),
                    ...(scoreRes?.data?.match || {})
                };

                if (currentMatchData.competition_id && compsRes?.data?.length > 0) {
                    const targetComp = compsRes.data.find(c => c.id === currentMatchData.competition_id);
                    if (targetComp) {
                        currentMatchData.title = targetComp.title;
                        currentMatchData.age_group_id = targetComp.age_group_id;
                        currentMatchData.gender = targetComp.gender;
                        currentMatchData.maxSets = currentMatchData.max_sets || 5;
                    }
                }

                if (teamsRes?.data?.length > 0) {
                    const homeTeam = teamsRes.data.find(t => t.id === currentMatchData.home_team_id);
                    const awayTeam = teamsRes.data.find(t => t.id === currentMatchData.away_team_id);

                    // ทีม A (Home)
                    if (homeTeam) {
                        const hName = homeTeam.name || homeTeam.team_name || `Team A`;
                        currentMatchData.home_team_name = hName;
                        currentMatchData.home_team_code = homeTeam.short_name || hName.substring(0, 3).toUpperCase();
                    } else {
                        currentMatchData.home_team_name = 'Team A';
                        currentMatchData.home_team_code = 'TEA';
                    }

                    // ทีม B (Away)
                    if (awayTeam) {
                        const aName = awayTeam.name || awayTeam.team_name || `Team B`;
                        currentMatchData.away_team_name = aName;
                        currentMatchData.away_team_code = awayTeam.short_name || aName.substring(0, 3).toUpperCase();
                    } else {
                        currentMatchData.away_team_name = 'Team B';
                        currentMatchData.away_team_code = 'TEB';
                    }
                }

                setMatchData(currentMatchData);
                setScoreData(scoreRes.data);
                setRosterData(rosterRes.data);
            } catch (error) {
                console.error("Error fetching score sheet data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchScoreSheetData();
    }, [effectiveMatchId]);


    if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-xl">Loading FIVB Score Sheet...</div>;
    if (!matchData) return <div className="min-h-screen flex items-center justify-center font-bold text-xl text-red-500">Match data not found.</div>;

    const compName = matchData.title || matchData.competition_title || matchData.competition_name || '';
    const city = matchData.city || matchData.stadium_city || '';
    const time = matchData.start_time ? matchData.start_time.substring(0, 5) : '';
    const matchNumber = matchData.match_number || '';
    const category = matchData.age_group_id ? getAgeGroupName(matchData.age_group_id) : (matchData.competition_category || matchData.category || '');
    const gender = matchData.gender || matchData.competition_gender || '';

    // --- Parse Live State from Scorer Console ---
    let liveState = matchData?.live_state || {};
    if (typeof liveState === 'string') {
        try { liveState = JSON.parse(liveState); } catch { liveState = {}; }
    }

    // --- 1. ตัวแปรสำหรับกติกา Best of 3 vs Best of 5 ---
    const maxSets = Number(matchData.maxSets || matchData.max_sets || 5);
    const isBestOf3 = maxSets === 3;
    const decidingSetIdx = isBestOf3 ? 2 : 4;
    const decidingSetNum = isBestOf3 ? 3 : 5;

    // --- 2. เช็คว่าใครอยู่แดนซ้าย (A) หรือแดนขวา (B) ตามผล Coin Toss ---
    const hasCoinToss = !!matchData.left_side_team_id && !!matchData.first_serve_team_id;
    const isHomeOnLeft = matchData.left_side_team_id ? matchData.left_side_team_id === matchData.home_team_id : true; // ถ้ายังไม่เสี่ยง ให้ Home อยู่ซ้ายไว้ก่อน

    // Team IDs mapped to A (Left) and B (Right)
    const idA = isHomeOnLeft ? matchData.home_team_id : matchData.away_team_id;
    const idB = isHomeOnLeft ? matchData.away_team_id : matchData.home_team_id;

    // Team Names
    const teamA = isHomeOnLeft
        ? (matchData?.home_team_name || matchData?.home_team_code || 'Team A')
        : (matchData?.away_team_name || matchData?.away_team_code || 'Team A');

    const teamB = !isHomeOnLeft
        ? (matchData?.home_team_name || matchData?.home_team_code || 'Team B')
        : (matchData?.away_team_name || matchData?.away_team_code || 'Team B');

    const displayTeamA = hasCoinToss ? teamA : '';
    const displayTeamB = hasCoinToss ? teamB : '';
    const isTeamAServesFirst = hasCoinToss ? (matchData.first_serve_team_id === idA) : null;

    // --- 3. ดึงข้อมูลนักกีฬาให้ตรงกับฝั่ง A และ B ---

    // 1. ดึงข้อมูลจาก liveState (ถ้ามี) หรือ rosterData เป็นอันดับแรก เพื่อให้ตรงกับการตั้งค่าของ scorer หน้าสนาม
    const rawHome = (liveState.homeRoster && liveState.homeRoster.length > 0) ? liveState.homeRoster : (rosterData?.home?.players || scoreData?.homePlayers || scoreData?.home_players || []);
    const rawAway = (liveState.awayRoster && liveState.awayRoster.length > 0) ? liveState.awayRoster : (rosterData?.away?.players || scoreData?.awayPlayers || scoreData?.away_players || []);
    // ดึงข้อมูล Lineup จาก scoreData.lineups (ซึ่งมีข้อมูลทุกเซตจาก API getMatchScoresheetData)
    const actualLineups = scoreData?.lineups || scoreData?.match_lineups || [];

    // 2. ฟังก์ชันเช็ค Libero (รองรับบทบาทควบ L1+C / L2+C)
    const isLibero = (p) => {
        if (!p) return false;
        const pos = String(p.position || '').trim().toLowerCase();
        const role = String(p.role || '').trim().toUpperCase();
        return pos === 'libero' || pos === 'l' ||
            p.is_libero === true || p.isLibero === true ||
            p.is_libero1 === true || p.is_libero2 === true ||
            role === 'L1' || role === 'L2' || role === 'L1+C' || role === 'L2+C';
    };

    // 3. ค้นหา Libero จากโครงสร้าง JSON 
    const extractLiberos = (teamKey, rawPlayers) => {
        let libs = [];

        // 0. ดึงจาก liveState ที่ Scorer ทำการยืนยันหน้าสนามเป็นอันดับแรก
        const liveLibs = liveState?.[teamKey === 'home' ? 'homeLiberos' : 'awayLiberos'];
        if (liveLibs) {
            if (liveLibs.l1 && (liveLibs.l1.id || liveLibs.l1.number)) libs.push(liveLibs.l1);
            if (liveLibs.l2 && (liveLibs.l2.id || liveLibs.l2.number)) libs.push(liveLibs.l2);
        }

        // ค้นหาจาก Object rosterData โดยตรง 
        const teamRoster = rosterData?.[teamKey];
        if (teamRoster && libs.length === 0) {
            if (teamRoster.l1 && (teamRoster.l1.id || teamRoster.l1.number)) libs.push(teamRoster.l1);
            if (teamRoster.l2 && (teamRoster.l2.id || teamRoster.l2.number)) libs.push(teamRoster.l2);

            // เผื่อกรณีซ้อนอยู่ใน object liberos
            if (teamRoster.liberos) {
                if (teamRoster.liberos.l1) libs.push(teamRoster.liberos.l1);
                if (teamRoster.liberos.l2) libs.push(teamRoster.liberos.l2);
            }
        }

        // ถ้าใน rosterData ไม่เจอ ให้ลองหาใน scoreData
        if (libs.length === 0) {
            const teamScore = scoreData?.[teamKey] || scoreData?.roster?.[teamKey];
            if (teamScore) {
                if (teamScore.l1) libs.push(teamScore.l1);
                if (teamScore.l2) libs.push(teamScore.l2);
            }
        }

        // ถ้าไม่เจอ Object แยก l1, l2 เลยจริงๆ ให้ใช้ Array นักกีฬาทั้งหมดมากรอง
        if (libs.length === 0 && Array.isArray(rawPlayers)) {
            libs = rawPlayers.filter(p => isLibero(p));
        }

        // ตัดคนที่ซ้ำกันออก
        const uniqueLibs = [];
        libs.forEach(l => {
            if (l && (l.id || l.number)) {
                if (!uniqueLibs.some(ul => String(ul.id) === String(l.id) || String(ul.number) === String(l.number))) {
                    uniqueLibs.push(l);
                }
            }
        });

        return uniqueLibs.slice(0, 2);
    };

    const homeLibs = extractLiberos('home', rawHome);
    const awayLibs = extractLiberos('away', rawAway);

    const isPlayerInLibs = (p, libs) => libs.some(l => String(l.id) === String(p.id) || String(l.number) === String(p.number));

    // 4. กรองเอานักกีฬาปกติ 12 คน (ตัดชื่อคนที่ลงกล่อง Libero แล้วออกไป)
    const homeNormalPlayers = rawHome.filter(p => !isLibero(p) && p.role !== 'Coach' && !isPlayerInLibs(p, homeLibs));
    const awayNormalPlayers = rawAway.filter(p => !isLibero(p) && p.role !== 'Coach' && !isPlayerInLibs(p, awayLibs));

    // 5. แยกนักกีฬาและ Mapping ไปที่ทีม A (ซ้าย) และทีม B (ขวา)
    const playersA = (isHomeOnLeft ? homeNormalPlayers : awayNormalPlayers).slice(0, 12);
    const playersB = (isHomeOnLeft ? awayNormalPlayers : homeNormalPlayers).slice(0, 12);
    const liberosA = isHomeOnLeft ? homeLibs : awayLibs;
    const liberosB = isHomeOnLeft ? awayLibs : homeLibs;

    // ฟังก์ชันช่วยดึงชื่อเจ้าหน้าที่ (Staff) ตาม Role จากฐานข้อมูล
    const getStaffName = (staffArray, roles) => {
        if (!Array.isArray(staffArray)) return '';
        const staff = staffArray.find(s => {
            const r = String(s.role || '').toLowerCase().trim();
            // แค่มีคำที่ตรงกันบางส่วน (เช่น มีคำว่า 'manager' ใน 'team manager') ก็ถือว่าใช่
            return roles.some(role => r.includes(role));
        });
        return staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : '';
    };

    const homeStaff = rosterData?.home?.staff || [];
    const awayStaff = rosterData?.away?.staff || [];

    const hCoach = getStaffName(homeStaff, ['head coach', 'coach']) || scoreData?.home_coach || '';
    const hAC1 = getStaffName(homeStaff, ['assistant coach 1', 'assistant coach']);
    const hAC2 = getStaffName(homeStaff, ['assistant coach 2']);
    const hTeamManager = getStaffName(homeStaff, ['manager', 'team manager', 'ผู้จัดการทีม']);
    const hMedical = getStaffName(homeStaff, ['medical', 'doctor', 'medical doctor']);

    const aCoach = getStaffName(awayStaff, ['head coach', 'coach']) || scoreData?.away_coach || '';
    const aAC1 = getStaffName(awayStaff, ['assistant coach 1', 'assistant coach']);
    const aAC2 = getStaffName(awayStaff, ['assistant coach 2']);
    const aTeamManager = getStaffName(awayStaff, ['manager', 'team manager', 'ผู้จัดการทีม']);
    const aMedical = getStaffName(awayStaff, ['medical', 'doctor', 'medical doctor']);

    // โค้ชและเจ้าหน้าที่ Mapping ไปที่ทีม A (ซ้าย) และทีม B (ขวา) ตามผลเสี่ยงแดน
    const coachA = isHomeOnLeft ? hCoach : aCoach;
    const coachB = isHomeOnLeft ? aCoach : hCoach;
    const ac1A = isHomeOnLeft ? hAC1 : aAC1;
    const ac1B = isHomeOnLeft ? aAC1 : hAC1;
    const ac2A = isHomeOnLeft ? hAC2 : aAC2;
    const ac2B = isHomeOnLeft ? aAC2 : hAC2;
    const tmA = isHomeOnLeft ? hTeamManager : aTeamManager;
    const tmB = isHomeOnLeft ? aTeamManager : hTeamManager;
    const mdA = isHomeOnLeft ? hMedical : aMedical;
    const mdB = isHomeOnLeft ? aMedical : hMedical;



    const matchSignatures = liveState.matchSignatures || {};
    const sigCapA = isHomeOnLeft ? matchSignatures.homeCaptain : matchSignatures.awayCaptain;
    const sigCapB = isHomeOnLeft ? matchSignatures.awayCaptain : matchSignatures.homeCaptain;
    const sigCoachA = isHomeOnLeft ? matchSignatures.homeCoach : matchSignatures.awayCoach;
    const sigCoachB = isHomeOnLeft ? matchSignatures.awayCoach : matchSignatures.homeCoach;

    // 4. ฟังก์ชันสำหรับ Lineup และ Score 
    const getPlayerNoById = (playerId) => {
        if (!playerId) return '';
        const player = [...rawHome, ...rawAway].find(p => String(p.id) === String(playerId) || String(p.player_id) === String(playerId));
        return player ? (player.number || player.shirt_number || player.jersey_number || '') : '';
    };
    const getPlayerNo = (player) => {
        if (!player) return '';
        return player.number || player.shirt_number || player.jersey_number || '';
    };

    const getPlayerName = (player) => {
        if (!player) return '';
        const fName = player.first_name || player.firstname || '';
        const lName = player.last_name || player.lastname || player.name || '';
        // แก้ไขให้แสดงชื่อ-นามสกุลเต็ม
        if (fName && lName) return `${fName} ${lName}`;
        return lName || fName || '';
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

    // เตรียมผลการแข่งขัน (แยกฝั่ง A และ B)
    const rawResults = scoreData?.sets || scoreData?.results || [];
    const results = Array.from({ length: 5 }, (_, i) => {
        const setNum = i + 1;
        return rawResults.find(r => Number(r.set_number) === setNum) || {};
    });

    const getScoreA = (idx) => isHomeOnLeft ? (Number(results[idx]?.home_score) || 0) : (Number(results[idx]?.away_score) || 0);
    const getScoreB = (idx) => isHomeOnLeft ? (Number(results[idx]?.away_score) || 0) : (Number(results[idx]?.home_score) || 0);

    // 5. ฟังก์ชันสำหรับดึงข้อมูลการเปลี่ยนตัว (Substitutions) 
    const getSubstitutionsForSet = (setNum, teamId) => {
        if (!teamId || !scoreData?.events) return Array(6).fill(null);

        const subEvents = scoreData.events.filter(e =>
            String(e.set_id) === String(setNum) &&
            String(e.team_id) === String(teamId) &&
            e.event_type === 'SUBSTITUTION'
        );

        const lineup = actualLineups.find(l => String(l.set_number) === String(setNum) && String(l.team_id) === String(teamId));
        if (!lineup) return Array(6).fill(null);

        const startingIds = [
            lineup.player_id_p1, lineup.player_id_p2, lineup.player_id_p3,
            lineup.player_id_p4, lineup.player_id_p5, lineup.player_id_p6
        ];

        return startingIds.map(startPlayerId => {
            // 1. หาการเปลี่ยนตัวครั้งแรก (ตัวจริงออก ตัวสำรองเข้า)
            const firstSub = subEvents.find(e => {
                let d = {};
                try { d = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {}); } catch { /* ignore */ }
                return String(d.player_out_id || d.out) === String(startPlayerId);
            });

            if (!firstSub) return null;

            const subPlayerId = firstSub.player_id;

            // 2. หาการเปลี่ยนตัวครั้งที่สอง (ตัวสำรองออก ตัวจริงกลับเข้าสนาม)
            const secondSub = subEvents.find(e => {
                let d = {};
                try { d = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {}); } catch { /* ignore */ }
                return String(d.player_out_id || d.out) === String(subPlayerId) && String(e.player_id) === String(startPlayerId);
            });

            return {
                playerNo: getPlayerNoById(subPlayerId),
                score1: `${firstSub.score_home}:${firstSub.score_away}`,
                score2: secondSub ? `${secondSub.score_home}:${secondSub.score_away}` : null,
                isCompleted: !!secondSub
            };
        });
    };

    // 6. ฟังก์ชันสำหรับดึงข้อมูลการขอเวลา (Timeouts)
    const getTimeoutsForSet = (setNum, teamId) => {
        if (!teamId || !scoreData?.events) return [];
        const toEvents = scoreData.events.filter(e =>
            String(e.set_id) === String(setNum) &&
            String(e.team_id) === String(teamId) &&
            e.event_type === 'TIMEOUT'
        );
        return toEvents.map(e => `${e.score_home}:${e.score_away}`);
    };

    // 7. ฟังก์ชันสำหรับดึงข้อมูลการลงโทษ (Sanctions)
    const getSanctions = () => {
        if (!scoreData?.events) return [];
        return scoreData.events.filter(e => e.event_type === 'CARD' || e.event_type === 'SANCTION');
    };

    // 8. ฟังก์ชันสำหรับดึงข้อมูลบันทึกเพิ่มเติม (Remarks)
    const getRemarks = () => {
        if (!scoreData?.events) return [];
        return scoreData.events.filter(e => e.event_type === 'REMARK');
    };

    // 9. ฟังก์ชันสำหรับคำนวณคะแนนในช่อง Service Rounds
    const getServiceScoresForSet = (setNum, teamId) => {
        const scores = Array(36).fill('');
        if (!teamId || !scoreData?.events) return scores;

        const setEvents = scoreData.events.filter(e => String(e.set_id) === String(setNum) && e.event_type === 'POINT')
            .sort((a, b) => a.id - b.id);

        if (setEvents.length === 0) return scores;

        let currentIdx = 0;

        setEvents.forEach((e, i) => {
            const winnerId = String(e.team_id);
            const winnerScore = winnerId === String(matchData.home_team_id) ? e.score_home : e.score_away;

            // Side-out occurs when the team that just won the point was NOT the one serving
            // Actually, in volleyball, we record the score of the serving team when they LOSE the rally.
            const nextEvent = setEvents[i + 1];
            if (nextEvent && String(nextEvent.team_id) !== winnerId) {
                // The team that just won this point (e) is now going to lose the next point
                // If the winner of current event (e) is the team we are interested in:
                if (winnerId === String(teamId)) {
                    if (currentIdx < 36) {
                        scores[currentIdx] = winnerScore;
                        currentIdx++;
                    }
                }
            }
        });

        // Add final score if the team was serving last
        const lastEvent = setEvents[setEvents.length - 1];
        if (lastEvent && String(lastEvent.team_id) === String(teamId)) {
            // In volleyball, the last point of the set is also recorded in the service round
            if (currentIdx < 36) scores[currentIdx] = (String(teamId) === String(matchData.home_team_id)) ? lastEvent.score_home : lastEvent.score_away;
        }

        return scores;
    };

    const totalHomePoints = rawResults.reduce((sum, r) => sum + (Number(r.home_score) || 0), 0);
    const totalAwayPoints = rawResults.reduce((sum, r) => sum + (Number(r.away_score) || 0), 0);
    const totalHomeWon = rawResults.filter(r => (Number(r.home_score) || 0) > (Number(r.away_score) || 0)).length;
    const totalAwayWon = rawResults.filter(r => (Number(r.away_score) || 0) > (Number(r.home_score) || 0)).length;

    const totalPointsA = isHomeOnLeft ? totalHomePoints : totalAwayPoints;
    const totalPointsB = isHomeOnLeft ? totalAwayPoints : totalHomePoints;
    const totalWonA = isHomeOnLeft ? totalHomeWon : totalAwayWon;
    const totalWonB = isHomeOnLeft ? totalAwayWon : totalHomeWon;
    const totalSubsA = scoreData?.events?.filter(e => String(e.team_id) === String(idA) && e.event_type === 'SUBSTITUTION').length || 0;
    const totalSubsB = scoreData?.events?.filter(e => String(e.team_id) === String(idB) && e.event_type === 'SUBSTITUTION').length || 0;
    const totalToA = scoreData?.events?.filter(e => String(e.team_id) === String(idA) && e.event_type === 'TIMEOUT').length || 0;
    const totalToB = scoreData?.events?.filter(e => String(e.team_id) === String(idB) && e.event_type === 'TIMEOUT').length || 0;

    const totalDuration = results.reduce((sum, r, idx) => {
        const dur = getCalculatedSetDuration(r, idx === 0 ? matchData?.start_time : null);
        return sum + dur;
    }, 0);
    const playedSetsCount = rawResults.filter(r => r.home_score !== undefined || r.away_score !== undefined).length;
    const restDuration = playedSetsCount > 1 ? (playedSetsCount - 1) * 3 : 0;
    const totalMatchDuration = totalDuration > 0 ? totalDuration + restDuration : 0;

    // ค้นหาเวลาจบการแข่งขันของเซตสุดท้ายที่แข่งจบจริง
    const playedSetsWithEndTime = results.filter(r => r.end_time);
    const lastPlayedSet = playedSetsWithEndTime.length > 0 
        ? playedSetsWithEndTime[playedSetsWithEndTime.length - 1] 
        : null;
    const lastSetEndTime = lastPlayedSet ? lastPlayedSet.end_time : null;
    const matchEndTime = lastSetEndTime || matchData.end_time;

    // --- Set 5 (Deciding Set) Coin Toss and Side configuration ---
    const decidingSetEvents = scoreData?.events?.filter(e => String(e.set_id) === String(decidingSetNum)) || [];
    const set5CourtSideLeftEvent = decidingSetEvents.find(e => e.event_type === 'COURT_SIDE_LEFT');
    const set5FirstServeEvent = decidingSetEvents.find(e => e.event_type === 'FIRST_SERVE');

    const isSet5HomeOnLeft = set5CourtSideLeftEvent
        ? (String(set5CourtSideLeftEvent.team_id) === String(matchData.home_team_id))
        : isHomeOnLeft;

    const idSet5L = isSet5HomeOnLeft ? matchData.home_team_id : matchData.away_team_id;
    const idSet5R = isSet5HomeOnLeft ? matchData.away_team_id : matchData.home_team_id;

    const teamSet5L = isSet5HomeOnLeft
        ? (matchData?.home_team_name || matchData?.home_team_code || 'Team A')
        : (matchData?.away_team_name || matchData?.away_team_code || 'Team B');

    const teamSet5R = !isSet5HomeOnLeft
        ? (matchData?.home_team_name || matchData?.home_team_code || 'Team A')
        : (matchData?.away_team_name || matchData?.away_team_code || 'Team B');

    const labelSet5L = idSet5L === idA ? 'A' : 'B';
    const labelSet5R = idSet5R === idA ? 'B' : 'A';

    const set5FirstServeTeamId = set5FirstServeEvent ? String(set5FirstServeEvent.team_id) : null;
    const isSet5TeamLServesFirst = set5FirstServeTeamId !== null
        ? (String(set5FirstServeTeamId) === String(idSet5L))
        : null;

    const displayTeamSet5L = hasCoinToss ? teamSet5L : '';
    const displayTeamSet5R = hasCoinToss ? teamSet5R : '';

    const getTeamScoreForSetIdx = (teamId, idx) => {
        return String(teamId) === String(idA) ? getScoreA(idx) : getScoreB(idx);
    };

    let matchWinner = '', matchScore = '___ : ___';
    if (totalWonA > totalWonB) { matchWinner = teamA; matchScore = `${totalWonA} : ${totalWonB}`; }
    else if (totalWonB > totalWonA) { matchWinner = teamB; matchScore = `${totalWonB} : ${totalWonA}`; }

    return (
        <div className="min-h-screen bg-gray-500 p-4 font-sans ">
            {/* Action Bar (Hidden when printing) */}
            <div className="fixed top-6 right-6 flex gap-3 z-50 print:hidden">
                <button
                    onClick={() => {
                        if (window.history.state && window.history.state.idx > 0) {
                            navigate(-1);
                        } else {
                            window.close();
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-800 rounded-xl shadow-xl font-bold hover:bg-gray-100 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    <ArrowLeft size={20} />
                    Back / Close
                </button>
                <button
                    onClick={() => setShowO4(!showO4)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-800 rounded-xl shadow-xl font-bold hover:bg-gray-100 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    {showO4 ? "Show Score Sheet" : "Show O-4 Report"}
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl shadow-xl font-bold hover:bg-indigo-700 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Printer size={20} />
                    Print {showO4 ? "O-4 Report" : "Score Sheet"}
                </button>
            </div>

            {showO4 ? (
                <MatchResultReportO4 matchData={matchData} scoreData={scoreData} rosterData={rosterData} />
            ) : (
                /* พื้นที่กระดาษ (ตั้งค่าขนาดสำหรับ A3 แนวนอนตอนพิมพ์) */
                <div className="a3-container w-[1587px] h-[1123px] mx-auto bg-white border border-gray-300 shadow-2xl overflow-hidden text-[12px] leading-tight text-black relative box-border p-2 flex flex-col gap-1 pb-4">

                {/* --- ส่วนหัว (HEADER) --- */}
                <div className="flex border-[3px] border-black h-[13%] min-h-0 shrink-0 text-[13px] leading-tight bg-white">

                    {/* ฝั่งซ้าย: ข้อมูลแมตช์ (70%) */}
                    <div className="w-[70%] border-r-[3px] border-black flex flex-col">

                        {/* 1. Name of Competition */}
                        <div className="flex items-center border-b border-black h-[40px] px-2">
                            <span className="font-bold whitespace-nowrap mr-3 text-[15px]">Name of the Competition :</span>
                            <span className="flex-1 font-bold text-lg truncate uppercase">{compName}</span>
                        </div>

                        {/* 2 & 3. Middle Section & Division/Category */}
                        <div className="flex flex-col flex-1">

                            {/* แถวบน: City & Date/Time */}
                            <div className="flex h-[42px] border-b border-black">
                                {/* ซ้าย: City */}
                                <div className="w-[60%] border-r border-black flex items-end px-2 pb-[14px] ">
                                    <span className="w-10 leading-none pb-[2px] text-[14px]">City</span>
                                    <div className="flex-1 border border-black border-b0 h-[24px] relative flex items-end px-1 font-bold text-[14px]">
                                        <span className="mb-[2px]">{city}</span>
                                    </div>
                                    <span className="ml-3 mr-2 whitespace-nowrap leading-none pb-[2px] text-[14px]">Country Code :</span>
                                    <div className="w-14 border border-black h-[24px] flex items-center justify-center font-bold text-[14px] uppercase">
                                        {matchData.country || ''}
                                    </div>
                                </div>

                                {/* ขวา: Date/Time */}
                                <div className="flex-1 flex items-center justify-between px-6">
                                    <div className="flex items-center gap-3">
                                        <span className="leading-none pb-[2px] text-[14px]">Date</span>
                                        <div className="flex flex-col items-center mt-1">
                                            <div className="flex border border-black h-[24px]">
                                                <div className="w-12 border-r border-black flex items-center justify-center font-bold text-[14px]">{matchData.match_date ? new Date(matchData.match_date).getDate().toString().padStart(2, '0') : ''}</div>
                                                <div className="w-12 border-r border-black flex items-center justify-center font-bold text-[14px]">{matchData.match_date ? (new Date(matchData.match_date).getMonth() + 1).toString().padStart(2, '0') : ''}</div>
                                                <div className="w-12 flex items-center justify-center font-bold text-[14px]">{matchData.match_date ? (new Date(matchData.match_date).getFullYear() + 543).toString().slice(-2) : ''}</div>
                                            </div>
                                            <div className="flex w-full text-[9px] text-center mt-[2px] font-bold">
                                                <span className="flex-1">D</span><span className="flex-1">M</span><span className="flex-1">Y</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="leading-none pb-[2px] text-[14px]">Time</span>
                                        <div className="flex flex-col items-center mt-1">
                                            <div className="border border-black w-20 h-[24px] flex items-center justify-center font-bold text-[14px] tracking-widest">{time}</div>
                                            <div className="flex w-full text-[9px] justify-between px-3 mt-[2px] font-bold">
                                                <span>H</span><span>mn</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* แถวล่าง: Hall + Division (ซ้าย) & Teams (ขวา) */}
                            <div className="flex flex-1">

                                {/* ซ้าย: Hall และ Division/Category */}
                                <div className="w-[60%] border-r border-black flex flex-col">
                                    {/* Hall */}
                                    <div className="flex-1 flex items-end px-2 pb-[3px]">
                                        <span className="w-10 leading-none pb-[2px] text-[14px]">Hall</span>
                                        <div className="flex-1 border border-black border h-[24px] relative flex items-end px-1 font-bold text-[14px] truncate">
                                            <span className="mb-[2px]">{matchData.stadium_name || matchData.location || ''}</span>
                                        </div>
                                        <span className="ml-2 mr-2 leading-none pb-[2px] text-[14px]">Pool/Phase</span>
                                        <div className="min-w-[56px] px-2 border border-black h-[24px] flex items-end justify-center font-bold text-[12px]">
                                            {/* นำ Pool และ Round มาต่อกัน เช่น "A / Round 1" */}
                                            <span className="mb-[2px] truncate">
                                                {[matchData.pool_name, matchData.round_name].filter(Boolean).join(' / ')}
                                            </span>
                                        </div>
                                        <span className="ml-2 mr-2 leading-none pb-[2px] text-[14px]">Match N°</span>
                                        <div className="w-12 border border-black border h-[24px] flex items-center justify-center font-bold text-[14px]">
                                            <span className="mb-[2px]">{matchNumber}</span>
                                        </div>
                                    </div>

                                    {/* Division & Category */}
                                    <div className="h-[34px] w-full border-t border-black flex items-center px-2 font-bold gap-2 text-[14px]">
                                        <div className="flex items-center gap-2 w-full">
                                            <span>Division :</span>
                                            <label className="flex items-center gap-1.5 font-normal cursor-pointer">Men
                                                <div className="w-[18px] h-[18px] border border-black flex items-center justify-center text-[14px] font-bold leading-none pb-[2px]">
                                                    {gender === 'Male' || gender === 'Men' ? 'X' : ''}
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-1.5 font-normal cursor-pointer">Women
                                                <div className="w-[18px] h-[18px] border border-black flex items-center justify-center text-[14px] font-bold leading-none pb-[2px]">
                                                    {gender === 'Female' || gender === 'Women' ? 'X' : ''}
                                                </div>
                                            </label>
                                        </div>
                                        <div className="w-[2px] h-[20px] bg-black mx-2"></div>
                                        <div className="flex justify-between w-full gap-1">
                                            <span>Category :</span>
                                            <label className="flex items-center gap-1.5 font-normal cursor-pointer">Senior
                                                <div className="w-[18px] h-[18px] border border-black flex items-center justify-center text-[14px] font-bold leading-none pb-[2px]">
                                                    {category === 'Senior' ? 'X' : ''}
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-1.5 font-normal cursor-pointer">Junior
                                                <div className="w-[18px] h-[18px] border border-black flex items-center justify-center text-[14px] font-bold leading-none pb-[2px]">
                                                    {category === 'Junior' ? 'X' : ''}
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-1.5 font-normal cursor-pointer">Youth
                                                <div className="w-[18px] h-[18px] border border-black flex items-center justify-center text-[14px] font-bold leading-none pb-[2px]">
                                                    {category === 'Youth' ? 'X' : ''}
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* ขวา: Teams */}
                                <div className="flex-1 flex items-center justify-between px-4 pb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col text-[8px] leading-[8px] text-center font-bold text-black mt-1">
                                            <span className="relative">
                                                A
                                                <div className="absolute inset-0 flex items-center justify-center text-[16px] font-normal leading-none -translate-y-[1.5px]">&times;</div>
                                            </span>
                                            <span>or</span>
                                            <span>B</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full border-[1.5px] border-black flex items-center justify-center font-bold text-[16px] bg-white shrink-0">
                                            A
                                        </div>
                                        {/* กล่องทีม A */}
                                        <div className={`border border-black w-auto min-w-[80px] max-w-[120px] px-2 h-8 flex items-center justify-center font-bold bg-gray-100 print:bg-white truncate ${getTeamFontSize(displayTeamA, 14)}`}>
                                            {displayTeamA}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center leading-[0.8] font-bold text-[16px] mx-2 shrink-0">
                                        <span>TEAMS</span><span className="text-[10px]">vs</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* กล่องทีม B */}
                                        <div className={`border border-black w-auto min-w-[80px] max-w-[120px] px-2 h-8 flex items-center justify-center font-bold bg-gray-100 print:bg-white truncate ${getTeamFontSize(displayTeamB, 14)}`}>
                                            {displayTeamB}
                                        </div>
                                        <div className="w-8 h-8 rounded-full border-[1.5px] border-black flex items-center justify-center font-bold text-[16px] bg-white shrink-0">
                                            B
                                        </div>
                                        <div className="flex flex-col items-center leading-[10px] text-[10px] font-bold">
                                            <span>A</span>
                                            <span>or</span>
                                            <span className="relative">
                                                B
                                                <div className="absolute inset-0 flex items-center justify-center text-[20px] font-normal leading-none -translate-y-[1px]">&times;</div>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ฝั่งขวา: Logo & Title (30%) */}
                    <div className="w-[30%] flex flex-col relative bg-white">
                        <div className="flex-1 flex items-center justify-center p-3 gap-4">
                            {/* โลโก้ FIVB (CSS) */}
                            <div className="flex flex-col items-center justify-center w-[120px]">
                                <span className="font-semibold text-[46px] tracking-tighter leading-[0.8]">FIVB</span>
                                <div className="w-full h-3 border-t-[4px] border-black rounded-t-[50%] mt-1"></div>
                            </div>
                            <div className="flex-1 flex flex-col font-normal text-[22px] leading-[1.1] uppercase font-sans tracking-wide">
                                <span>Federation Internationale</span>
                                <span>De Volleyball</span>
                            </div>
                        </div>
                        <div className="border-t-[3px] border-black h-[45px] flex items-center justify-center bg-gray-100 print:bg-white">
                            <span className="font-semibold text-[24px] tracking-[0.1em] scale-y-110 transform">INTERNATIONAL SCORESHEET</span>
                        </div>
                    </div>
                </div>


                {/* --- ส่วนหลัก (MAIN GRID) 43% --- */}
                <div className="flex flex-col gap-1 h-[43%] min-h-0 shrink-0">
                    {/* แถวบน: Set 1 & Set 2 */}
                    <div className="flex flex-1 border-2 border-black bg-white">
                        <RowHeader />
                        {/* เซต 1: ซ้าย A (Home), ขวา B (Away) */}
                        <FivbSetBox setNum={1} teamL={displayTeamA} teamR={displayTeamB} labelL="A" labelR="B"
                            startTime={formatSetTime(results[0]?.start_time) || formatSetTime(matchData?.start_time)} endTime={formatSetTime(results[0]?.end_time)}
                            lineupL={getLineupForSet(1, idA)} lineupR={getLineupForSet(1, idB)}
                            subsL={getSubstitutionsForSet(1, idA)} subsR={getSubstitutionsForSet(1, idB)}
                            toL={getTimeoutsForSet(1, idA)} toR={getTimeoutsForSet(1, idB)}
                            scoreL={getScoreA(0)} scoreR={getScoreB(0)} isTeamAServesFirst={isTeamAServesFirst}
                            serviceScoresL={getServiceScoresForSet(1, idA)} serviceScoresR={getServiceScoresForSet(1, idB)} />

                        {/* เซต 2: สลับแดน ซ้าย B (Away), ขวา A (Home) */}
                        <FivbSetBox setNum={2} teamL={displayTeamB} teamR={displayTeamA} labelL="B" labelR="A" isLast
                            startTime={formatSetTime(results[1]?.start_time)} endTime={formatSetTime(results[1]?.end_time)}
                            lineupL={getLineupForSet(2, idB)} lineupR={getLineupForSet(2, idA)}
                            subsL={getSubstitutionsForSet(2, idB)} subsR={getSubstitutionsForSet(2, idA)}
                            toL={getTimeoutsForSet(2, idB)} toR={getTimeoutsForSet(2, idA)}
                            scoreL={getScoreB(1)} scoreR={getScoreA(1)} isTeamAServesFirst={isTeamAServesFirst}
                            serviceScoresL={getServiceScoresForSet(2, idB)} serviceScoresR={getServiceScoresForSet(2, idA)} />
                    </div>

                    {/* แถวล่าง: Set 3 & Set 4 */}
                    <div className="flex flex-1 border-2 border-black bg-white mt-1">
                        <RowHeader />
                        <FivbSetBox setNum={3} teamL={displayTeamA} teamR={displayTeamB} labelL="A" labelR="B"
                            startTime={formatSetTime(results[2]?.start_time)} endTime={formatSetTime(results[2]?.end_time)}
                            lineupL={getLineupForSet(3, idA)} lineupR={getLineupForSet(3, idB)}
                            subsL={getSubstitutionsForSet(3, idA)} subsR={getSubstitutionsForSet(3, idB)}
                            toL={getTimeoutsForSet(3, idA)} toR={getTimeoutsForSet(3, idB)}
                            scoreL={getScoreA(2)} scoreR={getScoreB(2)} isTeamAServesFirst={isTeamAServesFirst} isGreyedOut={isBestOf3}
                            serviceScoresL={getServiceScoresForSet(3, idA)} serviceScoresR={getServiceScoresForSet(3, idB)} />

                        <FivbSetBox setNum={4} teamL={displayTeamB} teamR={displayTeamA} labelL="B" labelR="A" isLast
                            startTime={formatSetTime(results[3]?.start_time)} endTime={formatSetTime(results[3]?.end_time)}
                            lineupL={getLineupForSet(4, idB)} lineupR={getLineupForSet(4, idA)}
                            subsL={getSubstitutionsForSet(4, idB)} subsR={getSubstitutionsForSet(4, idA)}
                            toL={getTimeoutsForSet(4, idB)} toR={getTimeoutsForSet(4, idA)}
                            scoreL={getScoreB(3)} scoreR={getScoreA(3)} isTeamAServesFirst={isTeamAServesFirst} isGreyedOut={isBestOf3}
                            serviceScoresL={getServiceScoresForSet(4, idB)} serviceScoresR={getServiceScoresForSet(4, idA)} />
                    </div>
                </div>

                {/* --- ส่วนล่างสุดทั้งหมด (Set 5 + Bottom Tables + Roster Right Column) 44% --- */}
                <div className="flex flex-1 gap-1 min-h-0 shrink-0">

                    {/* โซนซ้าย: Set 5 และตารางข้อมูล (กว้าง ~76%) */}
                    <div className="flex-[3.2] flex flex-col gap-1">

                        {/* บนซ้าย: Set 5 */}
                        <div className="h-[40%] border-2 border-black flex bg-white overflow-hidden">
                            <Set5RowHeader />
                            <Set5Box setNum={5} teamL={displayTeamSet5L} teamR={displayTeamSet5R} labelL={labelSet5L} labelR={labelSet5R}
                                startTime={formatSetTime(results[decidingSetIdx]?.start_time)} endTime={formatSetTime(results[decidingSetIdx]?.end_time)}
                                lineupL={getLineupForSet(decidingSetNum, idSet5L)} lineupR={getLineupForSet(decidingSetNum, idSet5R)}
                                subsL={getSubstitutionsForSet(decidingSetNum, idSet5L)} subsR={getSubstitutionsForSet(decidingSetNum, idSet5R)}
                                toL={getTimeoutsForSet(decidingSetNum, idSet5L)} toR={getTimeoutsForSet(decidingSetNum, idSet5R)}
                                scoreL={getTeamScoreForSetIdx(idSet5L, decidingSetIdx)} scoreR={getTeamScoreForSetIdx(idSet5R, decidingSetIdx)}
                                serviceScoresL={getServiceScoresForSet(decidingSetNum, idSet5L)} serviceScoresR={getServiceScoresForSet(decidingSetNum, idSet5R)}
                                isTeamLServesFirst={isSet5TeamLServesFirst} />
                        </div>

                        {/* ล่างซ้าย: Sanctions, Remarks/Approval, Results */}
                        <div className="h-[60%] flex gap-1">
                            {/* 1. SANCTIONS */}
                            <div className="w-[28%] border-2 border-black flex flex-col bg-white">
                                <div className="flex border-b-2 border-black">
                                    <div className="w-[60%] flex items-center justify-center font-bold text-[16px] tracking-wide">SANCTIONS</div>
                                    <div className="w-[40%] border-l-2 border-black flex flex-col text-[8px] font-bold">
                                        <div className="border-b border-black text-center py-[2px]">IMPROPER REQUEST</div>
                                        <div className="flex items-center justify-center gap-1.5 py-[2px] bg-gray-50 print:bg-white">
                                            <span>TEAM</span>
                                            <div className="w-[12px] h-[12px] rounded-full border border-black flex items-center justify-center pb-[1px]">A</div>
                                            <span>: TEAM</span>
                                            <div className="w-[12px] h-[12px] rounded-full border border-black flex items-center justify-center pb-[1px]">B</div>
                                        </div>
                                    </div>
                                </div>
                                <table className="w-full text-center divide-y border-black table-fixed flex-1">
                                    <thead>
                                        <tr className="divide-x border-black bg-gray-50 print:bg-white text-[10px] font-bold">
                                            <th className="w-[12%] leading-tight">W<br /><span className="text-[6px] font-normal">(Warning)</span></th>
                                            <th className="w-[12%] leading-tight">P<br /><span className="text-[6px] font-normal">(Penalty)</span></th>
                                            <th className="w-[12%] leading-tight">E<br /><span className="text-[6px] font-normal">(Expulsion)</span></th>
                                            <th className="w-[12%] leading-tight">D<br /><span className="text-[6px] font-normal">(Disqual.)</span></th>
                                            <th className="w-[12%] leading-tight">A<br /><span className="text-[6px] font-normal">or</span><br />B</th>
                                            <th className="w-[15%]">SET</th>
                                            <th>SCORE</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-black font-bold text-[12px]">
                                        {(() => {
                                            const sanctions = getSanctions();
                                            return [...Array(6)].map((_, i) => {
                                                const s = sanctions[i];
                                                if (!s) return <tr key={i} className="divide-x border-black h-5"><td></td><td></td><td></td><td></td><td></td><td></td><td className="text-[10px]"> : </td></tr>;

                                                let d = {};
                                                try { d = typeof s.details === 'string' ? JSON.parse(s.details) : (s.details || {}); } catch { /* ignore */ }

                                                const cardType = (d.card_type || d.card || '').toUpperCase();
                                                const teamLabel = String(s.team_id) === String(idA) ? 'A' : (String(s.team_id) === String(idB) ? 'B' : '');

                                                // ใครถูกทำโทษ (Player No หรือ Role)
                                                let person = '';
                                                if (s.player_id) {
                                                    person = getPlayerNoById(s.player_id);
                                                } else if (d.person_type) {
                                                    person = d.person_type === 'COACH' ? 'C' : (d.person_type === 'AC1' ? 'AC1' : (d.person_type === 'AC2' ? 'AC2' : 'C'));
                                                }

                                                return (
                                                    <tr key={i} className="divide-x border-black h-5">
                                                        <td className="bg-white">{cardType === 'YELLOW' || cardType === 'WARNING' ? person : ''}</td>
                                                        <td className="bg-white">{cardType === 'RED' || cardType === 'PENALTY' ? person : ''}</td>
                                                        <td className="bg-white">{cardType === 'EXPULSION' ? person : ''}</td>
                                                        <td className="bg-white">{cardType === 'DISQUALIFICATION' ? person : ''}</td>
                                                        <td className="bg-white">{teamLabel}</td>
                                                        <td className="bg-white">{(isBestOf3 && String(s.set_id) === '3') ? '5' : (s.set_id || '')}</td>
                                                        <td className="bg-white text-[10px]">{s.score_home} : {s.score_away}</td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                                <div className="border-t-2 border-black p-1 text-[8px] leading-[1.1] text-justify bg-gray-50 print:bg-white">
                                    <span className="font-bold underline">To record sanctions:</span> Put the corresponding abbreviation (N° for player, <span className="font-bold">C</span>= Coach, <span className="font-bold">AC<sup>1</sup>/AC<sup>2</sup></span>= Assistant Coaches, <span className="font-bold">T</span>= Team Manager, <span className="font-bold">M</span>= Medical Doctor) or <span className="font-bold">D</span> for Delay sanctions, in the appropriate column and indicate the team, the set and the score at the moment of the sanction.
                                </div>
                            </div>

                            {/* 2. REMARKS & APPROVAL */}
                            <div className="w-[42%] flex flex-col gap-1">

                                {/* REMARKS */}
                                <div className="h-[25%] border-2 border-black bg-white flex flex-col overflow-hidden">
                                    <div className="flex border-b border-black bg-gray-50 print:bg-white">
                                        <div className="border-r border-black px-3 py-0.5 flex items-center justify-center font-bold text-[10px] tracking-wide shrink-0">REMARKS</div>
                                        <div className="flex-1 px-2 py-0.5 text-[10px] truncate">
                                            {getRemarks().map((r, idx) => {
                                                let d = {};
                                                try { d = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {}); } catch { /* ignore */ }
                                                return <span key={idx} className="mr-4">{d.text || d || ''}</span>;
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex-1 border-b border-black"></div>
                                    <div className="flex-1 border-b border-black"></div>
                                    <div className="flex-1"></div>
                                </div>

                                {/* APPROVAL */}
                                <div className="flex-1 border-2 border-black bg-white flex flex-col">
                                    <div className="border-b-2 border-black font-bold text-center py-1 text-[16px] tracking-wide">APPROVAL</div>
                                    <table className="w-full text-left table-fixed">
                                        <thead className="border-b border-black text-[11px] font-bold bg-gray-100 print:bg-white text-center">
                                            <tr className="divide-x border-black">
                                                <th className="w-[15%] font-normal py-0.5">Referees</th>
                                                <th className="w-[50%] font-normal">Name</th>
                                                <th className="w-[15%] font-normal">Country</th>
                                                <th className="w-[20%] font-normal">Signature</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y border-black text-[12px] font-bold">
                                            {/* กรรมการที่ 1 */}
                                            <tr className="divide-x border-black">
                                                <td className="p-1 text-center">1<sup className="text-[8px]">st</sup></td>
                                                <td className="px-2 truncate uppercase">{`${matchData?.r1_firstname || ''} ${matchData?.r1_lastname || ''}`.trim()}</td>
                                                <td className="px-2 text-center uppercase">{matchData?.r1_country || ''}</td>
                                                <td className="p-0.5 relative h-[20px]">{matchSignatures.referee1 && <img src={matchSignatures.referee1} alt="Ref 1" className="absolute inset-0 w-full h-full object-contain" />}</td>
                                            </tr>
                                            {/* กรรมการที่ 2 */}
                                            <tr className="divide-x border-black">
                                                <td className="p-1 text-center">2<sup className="text-[8px]">nd</sup></td>
                                                <td className="px-2 truncate uppercase">{`${matchData?.r2_firstname || ''} ${matchData?.r2_lastname || ''}`.trim()}</td>
                                                <td className="px-2 text-center uppercase">{matchData?.r2_country || ''}</td>
                                                <td className="p-0.5 relative h-[20px]">{matchSignatures.referee2 && <img src={matchSignatures.referee2} alt="Ref 2" className="absolute inset-0 w-full h-full object-contain" />}</td>
                                            </tr>
                                            {/* ผู้บันทึกคะแนน */}
                                            <tr className="divide-x border-black">
                                                <td className="p-1 text-center font-normal text-[11px]">Scorer</td>
                                                <td className="px-2 truncate uppercase">{`${matchData?.scorer_firstname || ''} ${matchData?.scorer_lastname || ''}`.trim()}</td>
                                                <td className="px-2 text-center uppercase">{matchData?.scorer_country || ''}</td>
                                                <td></td>
                                            </tr>
                                            {/* ผู้ช่วยผู้บันทึกคะแนน */}
                                            <tr className="divide-x border-black border-b border-black">
                                                <td className="p-1 text-center leading-tight font-normal text-[10px]">Assistant<br />Scorer</td>
                                                <td className="px-2 truncate uppercase">{matchData?.assistant_scorer_name || ''}</td>
                                                <td className="px-2 text-center uppercase">{matchData?.assistant_scorer_country || ''}</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* พื้นที่ด้านล่าง APPROVAL (Line Judges & Team Captains) */}
                                    <div className="flex flex-1 min-h-0">

                                        {/* โซนซ้าย: ชื่อ Line Judge 1, 3 และช่องเซ็นกัปตันทีม A */}
                                        <div className="w-[40%] flex flex-col border-r border-black">
                                            <div className="flex-1 border-b border-black px-2 flex items-center justify-end text-xs font-medium truncate">
                                                {`${matchData?.lj1_firstname || ''} ${matchData?.lj1_lastname || ''}`.trim()}
                                            </div>
                                            <div className="flex-1 border-b border-black px-2 flex items-center justify-end text-xs font-medium truncate">
                                                {`${matchData?.lj3_firstname || ''} ${matchData?.lj3_lastname || ''}`.trim()}
                                            </div>
                                            <div className="flex-1 relative h-full flex items-center justify-end px-2">
                                                {sigCapA && <img src={sigCapA} alt="Cap A" className="max-h-[20px] max-w-[80%] object-contain" />}
                                            </div>
                                        </div>

                                        {/* โซนกลาง: Labels ตรงกลาง */}
                                        <div className="w-[28%] flex border-r border-black bg-gray-50 print:bg-white">
                                            {/* หมายเลข 1, 3, (A) */}
                                            <div className="w-[35%] flex flex-col border-r border-black">
                                                <div className="flex-1 border-b border-black flex items-center justify-center text-[11px] font-bold">1)</div>
                                                <div className="flex-1 border-b border-black flex items-center justify-center text-[11px] font-bold">3)</div>
                                                <div className="flex-1 flex items-center justify-center text-[12px] font-bold">
                                                    <div className="w-[16px] h-[16px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">A</div>
                                                </div>
                                            </div>
                                            {/* ข้อความ Line Judges & Team Captains */}
                                            <div className="w-[30%] flex flex-col">
                                                <div className="flex-[2] border-b border-black flex items-center justify-center text-[10px] text-center leading-tight font-bold">Line<br />Judges</div>
                                                <div className="flex-[1] flex items-center justify-center text-[9px] text-center leading-tight font-bold pt-1">Team<br />Captains</div>
                                            </div>
                                            {/* หมายเลข 2, 4, (B) */}
                                            <div className="w-[35%] flex flex-col border-l border-black">
                                                <div className="flex-1 border-b border-black flex items-center justify-center text-[11px] font-bold">2)</div>
                                                <div className="flex-1 border-b border-black flex items-center justify-center text-[11px] font-bold">4)</div>
                                                <div className="flex-1 flex items-center justify-center text-[12px] font-bold">
                                                    <div className="w-[16px] h-[16px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">B</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* โซนขวา: ชื่อ Line Judge 2, 4 และช่องเซ็นกัปตันทีม B */}
                                        <div className="w-[40%] flex flex-col bg-white">
                                            <div className="flex-1 border-b border-black px-2 flex items-center justify-start text-xs font-medium truncate">
                                                {`${matchData?.lj2_firstname || ''} ${matchData?.lj2_lastname || ''}`.trim()}
                                            </div>
                                            <div className="flex-1 border-b border-black px-2 flex items-center justify-start text-xs font-medium truncate">
                                                {`${matchData?.lj4_firstname || ''} ${matchData?.lj4_lastname || ''}`.trim()}
                                            </div>
                                            <div className="flex-1 relative h-full flex items-center justify-start px-2">
                                                {sigCapB && <img src={sigCapB} alt="Cap B" className="max-h-[20px] max-w-[80%] object-contain" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. RESULTS */}
                            <div className="w-[30%] border-2 border-black bg-white flex flex-col">
                                <div className="border-b-2 border-black font-bold text-center py-1 text-[16px] tracking-wide">RESULTS</div>
                                <div className="flex border-b-2 border-black font-bold text-[12px] h-[30px] bg-gray-50 print:bg-white">
                                    <div className="w-[50%] flex justify-between px-2 items-center border-r-[1px] border-black">
                                        <span className="text-[10px]">TEAM</span>
                                        <div className={`flex-1 mx-2 border border-black h-[18px] bg-white flex items-center justify-center px-1 truncate ${getTeamFontSize(displayTeamA, 10)}`}>{displayTeamA}</div>
                                        <div className="w-[20px] h-[20px] rounded-full border-2 border-black flex items-center justify-center text-[12px] pb-[1px] bg-white">A</div>
                                    </div>
                                    <div className="w-[50%] flex justify-between px-2 items-center border-l-[1px] border-black">
                                        <div className="w-[20px] h-[20px] rounded-full border-2 border-black flex items-center justify-center text-[12px] pb-[1px] bg-white">B</div>
                                        <div className={`flex-1 mx-2 border border-black h-[18px] bg-white flex items-center justify-center px-1 truncate ${getTeamFontSize(displayTeamB, 10)}`}>{displayTeamB}</div>
                                        <span className="text-[10px]">TEAM</span>
                                    </div>
                                </div>
                                <table className="w-full text-center divide-y border-black table-fixed flex-1 text-[14px]">
                                    <thead className="divide-x border-black bg-gray-50 print:bg-white">
                                        <tr className="divide-x border-black font-bold">
                                            <th>"T"</th><th>S</th><th>W</th><th className="text-[12px] leading-tight">P</th>
                                            <th className="w-[20%] text-[12px] leading-tight">SET <span className="text-[6px] ml-3">Duration</span></th>
                                            <th className="text-[12px] leading-tight">P</th><th>W</th><th>S</th><th>"T"</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-black font-bold">
                                        {results.map((r, idx) => {
                                            let setNumForDb = idx + 1;

                                            const scoreA = isHomeOnLeft ? r.home_score : r.away_score;
                                            const scoreB = isHomeOnLeft ? r.away_score : r.home_score;
                                            const isPlayed = scoreA !== undefined || scoreB !== undefined;
                                            const winA = (Number(scoreA) || 0) > (Number(scoreB) || 0) ? 1 : 0;
                                            const winB = (Number(scoreB) || 0) > (Number(scoreA) || 0) ? 1 : 0;

                                            // คำนวณจำนวนการเปลี่ยนตัวและเวลานอกแต่ละเซตจาก match_events
                                            const getEventsCount = (teamId, type) => {
                                                if (!isPlayed || !scoreData?.events) return '';
                                                const count = scoreData.events.filter(e =>
                                                    String(e.set_id) === String(setNumForDb) &&
                                                    String(e.team_id) === String(teamId) &&
                                                    e.event_type === type
                                                ).length;
                                                return count > 0 ? count : (isPlayed ? '0' : '');
                                            };

                                            const sA = getEventsCount(idA, 'SUBSTITUTION');
                                            const sB = getEventsCount(idB, 'SUBSTITUTION');
                                            const tA = getEventsCount(idA, 'TIMEOUT');
                                            const tB = getEventsCount(idB, 'TIMEOUT');

                                            return (
                                                <tr key={idx} className="divide-x border-black h-[24px]">
                                                    <td>{tA}</td>
                                                    <td>{sA}</td>
                                                    <td>{isPlayed ? winA : ''}</td>
                                                    <td className="text-[14px]">{scoreA ?? ''}</td>
                                                    <td className="bg-gray-100 print:bg-white p-0 h-full">
                                                        <div className="flex justify-between items-center w-full h-full px-2">
                                                            <span className="font-bold text-[13px]">{idx + 1}</span>
                                                            <span className="font-normal text-[10px] text-blue-900 leading-none">
                                                                 {(() => {
                                                                     const start = r.start_time || (idx === 0 ? matchData?.start_time : null);
                                                                     const end = r.end_time;
                                                                     if (start && end) {
                                                                         
                                                                         const dur = getCalculatedSetDuration(r, idx === 0 ? matchData?.start_time : null);
                                                                         return `(${dur}')`;
                                                                     } else {
                                                                         const dur = r.duration_minutes || r.duration;
                                                                         return dur ? `(${dur}')` : '';
                                                                     }
                                                                 })()}
                                                             </span>
                                                        </div>
                                                    </td>
                                                    <td className="text-[14px]">{scoreB ?? ''}</td>
                                                    <td>{isPlayed ? winB : ''}</td>
                                                    <td>{sB}</td>
                                                    <td>{tB}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="divide-x border-black border-t-2 border-black bg-gray-100 print:bg-white">
                                            <td>{totalToA || ''}</td><td>{totalSubsA || ''}</td><td>{totalWonA || ''}</td><td className="text-[14px]">{totalPointsA || ''}</td>
                                            <td className="leading-tight text-[8px] py-1 flex flex-col justify-center items-center h-full">Total Set Duration<br /><span className="font-normal text-[10px]">({totalDuration ? `${totalDuration}'` : '        '} mn)</span></td>
                                            <td className="text-[14px]">{totalPointsB || ''}</td><td>{totalWonB || ''}</td><td>{totalSubsB || ''}</td><td>{totalToB || ''}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="flex border-t-2 border-b-2 border-black text-[9px] font-bold text-center h-[35px] divide-x border-black bg-gray-50 print:bg-white">
                                    <div className="flex-1 flex flex-col justify-center leading-tight">Match Starting Time<br /><span className="font-normal text-[12px]">{formatMatchTime(matchData.start_time)}</span></div>
                                    <div className="flex-1 flex flex-col justify-center leading-tight">Match Ending Time<br /><span className="font-normal text-[12px]">{formatMatchTime(matchEndTime)}</span></div>
                                    <div className="flex-1 flex flex-col justify-center leading-tight">Total Match Duration<br /><span className="font-normal text-[12px]">{totalMatchDuration > 0 ? `${Math.floor(totalMatchDuration / 60)} h ${totalMatchDuration % 60} mn` : '___ h ___ mn'}</span></div>
                                </div>
                                <div className="flex items-center px-4 py-1.5 gap-3 font-semibold text-[18px]">
                                    <span>WINNER</span>
                                    <div className={`flex-1 border-b-2 border-black text-center truncate px-2 ${matchWinner && matchWinner.length > 25 ? 'text-[11px]' :
                                        matchWinner && matchWinner.length > 20 ? 'text-[13px]' :
                                            matchWinner && matchWinner.length > 15 ? 'text-[15px]' : 'text-[18px]'
                                        }`}>{matchWinner}</div>
                                    <span className="whitespace-nowrap">{matchScore}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* โซนขวา: TEAMS (Roster ยาวลงมาเต็มความสูง) กว้าง ~24% */}
                    <div className="flex-[1] border-2 border-black flex flex-col bg-white">
                        {/* Header: TEAMS vs */}
                        <div className="flex items-center justify-between px-2 py-1.5 border-b-2 border-black bg-gray-100 print:bg-white">
                            <div className="flex-1 flex justify-between items-center gap-1">
                                <div className="flex flex-col text-[7px] leading-[7px] text-center font-bold">
                                    <span className="relative">
                                        A
                                        <div className="absolute inset-0 flex items-center justify-center text-[14px] font-normal leading-none -translate-y-[1px]">&times;</div>
                                    </span>
                                    <span>or</span>
                                    <span>B</span>
                                </div>
                                <div className="w-5 h-5 rounded-full border border-black flex items-center justify-center text-[10px] font-bold bg-white shrink-0 ml-0.5">
                                    A
                                </div>
                                <div className={`flex-1 border border-black h-[22px] bg-white flex items-center justify-center font-bold truncate px-1 ml-0.5 ${getTeamFontSize(displayTeamA, 10)}`}>
                                    {displayTeamA}
                                </div>
                            </div>
                            <div className="text-[11px] font-bold text-center leading-[0.8] mx-1 shrink-0">TEAMS<br /><span className="text-[8px]">vs</span></div>
                            <div className="flex-1 flex justify-between items-center gap-1">
                                <div className={`flex-1 border border-black h-[22px] bg-white flex items-center justify-center font-bold truncate px-1 mr-0.5 ${getTeamFontSize(displayTeamB, 10)}`}>
                                    {displayTeamB}
                                </div>
                                <div className="w-5 h-5 rounded-full border border-black flex items-center justify-center text-[10px] font-bold bg-white shrink-0 mr-0.5">
                                    B
                                </div>
                                <div className="flex flex-col text-[7px] leading-[7px] text-center font-bold">
                                    <span>A</span>
                                    <span>or</span>
                                    <span className="relative">
                                        B
                                        <div className="absolute inset-0 flex items-center justify-center text-[14px] font-normal leading-none -translate-y-[1px]">&times;</div>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Player List */}
                        <div className="flex divide-x-2 border-black border-b-2 flex-1">
                            <div className="flex-1 flex flex-col divide-y border-black">
                                <div className="flex text-[10px] font-bold text-center bg-gray-50 print:bg-white"><div className="w-8 border-r border-black py-0.5">N°</div><div className="flex-1 py-0.5">Name of the player</div></div>
                                {[...playersA, ...Array(12 - playersA.length).fill(null)].map((player, i) => (
                                    <div key={`a-${i}`} className="flex flex-1 divide-x border-black min-h-0">
                                        <div className="w-8 text-center font-bold text-[12px] flex items-center justify-center bg-gray-50 print:bg-white">
                                            {player && (player.isCaptain || player.is_captain) && getPlayerNo(player) ? <div className="w-[15px] h-[15px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">{getPlayerNo(player)}</div> : getPlayerNo(player)}
                                        </div>
                                        <div className="flex-1 px-2 flex items-center text-[11px] font-bold uppercase truncate">{getPlayerName(player)}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 flex flex-col divide-y border-black">
                                <div className="flex text-[10px] font-bold text-center bg-gray-50 print:bg-white"><div className="w-8 border-r border-black py-0.5">N°</div><div className="flex-1 py-0.5">Name of the player</div></div>
                                {[...playersB, ...Array(12 - playersB.length).fill(null)].map((player, i) => (
                                    <div key={`b-${i}`} className="flex flex-1 divide-x border-black min-h-0">
                                        <div className="w-8 text-center font-bold text-[12px] flex items-center justify-center bg-gray-50 print:bg-white">
                                            {player && (player.isCaptain || player.is_captain) && getPlayerNo(player) ? <div className="w-[15px] h-[15px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">{getPlayerNo(player)}</div> : getPlayerNo(player)}
                                        </div>
                                        <div className="flex-1 px-2 flex items-center text-[11px] font-bold uppercase truncate">{getPlayerName(player)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* LIBERO */}
                        <div className="border-b-2 border-black text-center font-bold text-[12px] py-1 bg-gray-100 print:bg-white">LIBERO PLAYERS ("L")</div>
                        <div className="flex divide-x-2 border-black border-b-2 h-[40px]">
                            <div className="flex-1 flex flex-col divide-y border-black">
                                {[...liberosA, ...Array(2 - liberosA.length).fill(null)].map((player, i) => (
                                    <div key={`la-${i}`} className="flex-1 flex divide-x border-black"><div className="w-8 bg-gray-50 print:bg-white flex items-center justify-center font-bold text-[12px]">{player && (player.isCaptain || player.is_captain) && getPlayerNo(player) ? <div className="w-[15px] h-[15px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">{getPlayerNo(player)}</div> : getPlayerNo(player)}</div><div className="flex-1 px-2 flex items-center text-[11px] font-bold uppercase truncate">{getPlayerName(player)}</div></div>
                                ))}
                            </div>
                            <div className="flex-1 flex flex-col divide-y border-black">
                                {[...liberosB, ...Array(2 - liberosB.length).fill(null)].map((player, i) => (
                                    <div key={`lb-${i}`} className="flex-1 flex divide-x border-black"><div className="w-8 bg-gray-50 print:bg-white flex items-center justify-center font-bold text-[12px]">{player && (player.isCaptain || player.is_captain) && getPlayerNo(player) ? <div className="w-[15px] h-[15px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">{getPlayerNo(player)}</div> : getPlayerNo(player)}</div><div className="flex-1 px-2 flex items-center text-[11px] font-bold uppercase truncate">{getPlayerName(player)}</div></div>
                                ))}
                            </div>
                        </div>

                        {/* OFFICIALS */}
                        <div className="border-b-2 border-black text-center font-bold text-[12px] py-1 bg-gray-100 print:bg-white">OFFICIALS</div>
                        <div className="flex flex-col border-b-2 border-black h-[90px] divide-y border-black">
                            {[{ r: 'C', nameA: coachA, nameB: coachB }, { r: 'AC¹', nameA: ac1A, nameB: ac1B }, { r: 'AC²', nameA: ac2A, nameB: ac2B }, { r: 'T', nameA: tmA, nameB: tmB }, { r: 'M', nameA: mdA, nameB: mdB }].map(item => (
                                <div key={`off-${item.r}`} className="flex-1 flex divide-x border-black">
                                    <div className="flex-1 px-2 flex items-center justify-center text-xs font-medium truncate">{item.nameA || ''}</div>
                                    <div className="w-12 shrink-0 flex items-center justify-center font-bold text-[12px] bg-gray-50 print:bg-white" dangerouslySetInnerHTML={{ __html: item.r }}></div>
                                    <div className="flex-1 px-2 flex items-center justify-center text-xs font-medium truncate">{item.nameB || ''}</div>
                                </div>
                            ))}
                        </div>

                        {/* SIGNATURES */}
                        <div className="border-b-2 border-black text-center font-bold text-[12px] py-1 bg-gray-100 print:bg-white">SIGNATURES</div>
                        <div className="flex divide-x-2 border-black h-[50px]">
                            <div className="flex-1 flex flex-col divide-y border-black">
                                <div className="flex-1 px-1 text-[9px] font-bold flex flex-col justify-end pb-1 relative">
                                    {sigCapA && <img src={sigCapA} alt="Cap A" className="absolute bottom-1 right-2 max-h-[20px] max-w-[80%] object-contain" />}
                                    <span>Team Captain: </span>
                                </div>
                                <div className="flex-1 px-1 text-[9px] font-bold flex flex-col justify-end pb-1 relative">
                                    {sigCoachA && <img src={sigCoachA} alt="Coach A" className="absolute bottom-1 right-2 max-h-[20px] max-w-[80%] object-contain" />}
                                    <span>Coach: </span>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col divide-y border-black">
                                <div className="flex-1 px-1 text-[9px] font-bold flex flex-col justify-end pb-1 relative">
                                    {sigCapB && <img src={sigCapB} alt="Cap B" className="absolute bottom-1 right-2 max-h-[20px] max-w-[80%] object-contain" />}
                                    <span>Team Captain: </span>
                                </div>
                                <div className="flex-1 px-1 text-[9px] font-bold flex flex-col justify-end pb-1 relative">
                                    {sigCoachB && <img src={sigCoachB} alt="Coach B" className="absolute bottom-1 right-2 max-h-[20px] max-w-[80%] object-contain" />}
                                    <span>Coach: </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Note */}

            </div>
            )}

            {!showO4 && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page { 
                            size: A3 landscape; 
                            margin: 0; 
                        }
                        /* 1. ซ่อนทุกอย่างบนหน้าเว็บ (ป้องกัน Layout อื่นมาดันกระดาษตกขอบ) */
                        body * {
                            visibility: hidden;
                        }
                        /* 2. บังคับให้แสดงผลเฉพาะกล่อง A3 ของเราและลูกๆ ของมัน */
                        .a3-container, .a3-container * {
                            visibility: visible;
                        }
                        /* 3. ล็อกตำแหน่งกระดาษ A3 ให้อยู่มุมซ้ายบนสุดของหน้าต่างปรินท์เสมอ */
                        .a3-container {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 420mm !important;
                            height: 297mm !important;
                            max-width: 420mm !important;
                            max-height: 297mm !important;
                            margin: 0 !important;
                            padding: 6mm !important;
                            border: none !important;
                            box-shadow: none !important;
                            background-color: white !important;
                            -webkit-print-color-adjust: exact !important; 
                            print-color-adjust: exact !important;
                            transform: none !important;
                            overflow: hidden !important;
                            page-break-after: avoid !important;
                            page-break-before: avoid !important;
                        }
                    }
                `}} />
            )}

            {showO4 && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page { 
                            size: A4 portrait; 
                            margin: 0; 
                        }
                        body * {
                            visibility: hidden;
                        }
                        .o4-paper, .o4-paper * {
                            visibility: visible;
                        }
                        .o4-paper {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 210mm !important;
                            height: 297mm !important;
                            max-width: 210mm !important;
                            max-height: 297mm !important;
                            min-height: 297mm !important;
                            margin: 0 !important;
                            padding: 8mm !important;
                            border: none !important;
                            box-shadow: none !important;
                            background-color: white !important;
                            -webkit-print-color-adjust: exact !important; 
                            print-color-adjust: exact !important;
                            transform: none !important;
                            overflow: hidden !important;
                            box-sizing: border-box !important;
                        }
                    }
                `}} />
            )}
        </div>
    );
}

// ---------------------------------------------------------
// คอมโพเนนต์ย่อยสำหรับวาดส่วนหลักของ Score Sheet (FIVB Layout)
// ---------------------------------------------------------

// 1. หัวข้อแถวด้านซ้ายสุด (Row Header)
const RowHeader = () => (
    <div className="w-[8%] flex flex-col border-r-2 border-black text-[10px] font-bold bg-white">
        <div className="flex-[1.5] border-b-2 border-black"></div>

        <div className="flex-[5] flex border-b border-black">
            <div className="w-6 border-r border-black flex items-center justify-center">
                <span className="transform -rotate-90 whitespace-nowrap">Team line-up</span>
            </div>
            <div className="flex-1 flex flex-col divide-y border-black bg-gray-50 print:bg-white">
                <div className="flex-1 flex items-center justify-end pr-1">Service order</div>
                <div className="flex-1 flex items-center justify-end pr-1">N° of Starting players</div>
                <div className="flex-[3] flex">
                    <div className="w-5 border-r border-black flex items-center justify-center">
                        <span className="transform -rotate-90">Substitutes</span>
                    </div>
                    <div className="flex-1 flex flex-col divide-y border-black">
                        <div className="flex-1 flex items-center justify-end pr-1">N° of Player</div>
                        <div className="flex-[2] flex flex-col justify-center items-end pr-1 text-right leading-[1.1]">
                            <span>Score</span><span>at change</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-[4] flex">
            <div className="w-6 border-r border-black flex items-center justify-center">
                <span className="transform -rotate-90 whitespace-nowrap">Service rounds</span>
            </div>
            <div className="flex-1 flex flex-col divide-y border-black bg-gray-50 ">
                <div className="flex-1 flex justify-between items-center px-2"><span>1st</span><span>5th</span></div>
                <div className="flex-1 flex justify-between items-center px-2"><span>2nd</span><span>6th</span></div>
                <div className="flex-1 flex justify-between items-center px-2"><span>3rd</span><span>7th</span></div>
                <div className="flex-1 flex justify-between items-center px-2"><span>4th</span><span>8th</span></div>
            </div>
        </div>
    </div>
);

const CircleSR = ({ type, isCrossed }) => (
    <div className="relative w-[12px] h-[12px] rounded-full border border-black flex items-center justify-center text-[9px] text-black font-bold bg-white">
        {type}
        {isCrossed && (
            <svg className="absolute inset-0 w-full h-full text-black pointer-events-none" viewBox="0 0 12 12">
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
                <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        )}
    </div>
);

// 2. กล่องหลักสำหรับแต่ละ Set
const FivbSetBox = ({ setNum, teamL, teamR, labelL, labelR, isLast, startTime, endTime, lineupL, lineupR, subsL, subsR, toL, toR, scoreL = 0, scoreR = 0, isTeamAServesFirst, serviceScoresL = [], serviceScoresR = [], isGreyedOut }) => {
    const isSetStarted = (lineupL && lineupL.some(p => p !== '')) || (lineupR && lineupR.some(p => p !== '')) || !!startTime || !!endTime;

    // Clear everything if greyed out to prevent duplicate displays in Set 3 / Set 5
    const actualStartTime = isGreyedOut ? '' : startTime;
    const actualEndTime = isGreyedOut ? '' : endTime;
    const displayTeamL = (isSetStarted && !isGreyedOut) ? teamL : '';
    const displayTeamR = (isSetStarted && !isGreyedOut) ? teamR : '';
    const actualLineupL = isGreyedOut ? Array(6).fill('') : lineupL;
    const actualLineupR = isGreyedOut ? Array(6).fill('') : lineupR;
    const actualSubsL = isGreyedOut ? Array(6).fill(null) : subsL;
    const actualSubsR = isGreyedOut ? Array(6).fill(null) : subsR;
    const actualToL = isGreyedOut ? [] : toL;
    const actualToR = isGreyedOut ? [] : toR;
    const actualScoreL = isGreyedOut ? 0 : scoreL;
    const actualScoreR = isGreyedOut ? 0 : scoreR;
    const actualServiceScoresL = isGreyedOut ? [] : serviceScoresL;
    const actualServiceScoresR = isGreyedOut ? [] : serviceScoresR;
    const actualIsTeamAServesFirst = isGreyedOut ? null : isTeamAServesFirst;

    return (
        <div className={`flex w-[46%] ${!isLast ? 'border-r-2 border-black' : ''} ${isGreyedOut ? 'bg-gray-100 opacity-60 pointer-events-none select-none' : ''}`}>


            <div className="w-[5%] flex flex-col items-center justify-center border-r-2 border-black font-semibold text-lg bg-gray-100">
                <span>S</span><span>E</span><span>T</span>
                <span className="text-2xl mt-1">{setNum}</span>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                {/* สัดส่วน Header ต้องเป๊ะกับด้านล่างคือ 42-8-42-8 และใช้ divide-x-2 เพื่อให้เส้นตรงกัน */}
                <div className="flex-[1.5] border-b-2 border-black flex divide-x-2 divide-black text-[10px] font-bold bg-white">

                    {/* 1. TEAM L Header (42%) */}
                    <div className="w-[42%] flex items-center justify-between px-1 min-w-0">
                        <div className="flex items-center gap-1 shrink-0">
                            <div className="flex flex-col items-start leading-[0.9] text-[9px] font-bold">
                                <span>START</span><span>time</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="border border-black w-12 h-[20px] flex items-center justify-center text-[11px] whitespace-nowrap overflow-hidden bg-white tracking-wide">
                                    {actualStartTime ? actualStartTime.replace(/\s+/g, '') : ':'}
                                </div>

                            </div>
                        </div>
                        <div className="flex items-center gap-[2px] flex-1 justify-start min-w-0">
                            <span className="text-[10px] shrink-0 ml-2">TEAM</span>
                            <div className={`relative border border-black  flex-1 max-w-[120px] mx-1 h-[20px] flex items-center justify-center bg-white truncate px-1 ${getTeamFontSize(displayTeamL, 12)}`}>
                                {displayTeamL}
                            </div>
                            <div className="w-[20px] h-[20px] rounded-full border-[1.5px] border-black flex items-center justify-center text-[12px] pb-[1px] shrink-0">{labelL}</div>
                            <div className="flex flex-col gap-[1px] ml-1 shrink-0">
                                <CircleSR type="S" isCrossed={actualIsTeamAServesFirst !== null && actualIsTeamAServesFirst} />
                                <CircleSR type="R" isCrossed={actualIsTeamAServesFirst !== null && !actualIsTeamAServesFirst} />
                            </div>
                        </div>
                    </div>

                    {/* 2. POINTS L (8%) */}
                    <div className="w-[8%] flex items-center justify-center text-black font-bold text-[12px] bg-white shrink-0">
                        POINTS
                    </div>

                    {/* 3. TEAM R Header (42%) */}
                    <div className="w-[42%] flex items-center justify-between px-1 min-w-0">
                        <div className="flex items-center gap-[2px] flex-1 min-w-0">
                            <div className="flex flex-col gap-[1px] mr-1 shrink-0">
                                <CircleSR type="S" isCrossed={actualIsTeamAServesFirst !== null && !actualIsTeamAServesFirst} />
                                <CircleSR type="R" isCrossed={actualIsTeamAServesFirst !== null && actualIsTeamAServesFirst} />
                            </div>
                            <div className="w-[20px] h-[20px] rounded-full border-[1.5px] border-black flex items-center justify-center text-[12px] pb-[1px] shrink-0">{labelR}</div>
                            <div className={`relative border border-black flex-1 max-w-[125px] mx-1 h-[20px] flex items-center justify-center bg-white truncate px-1 ${getTeamFontSize(displayTeamR, 12)}`}>
                                {displayTeamR}
                            </div>
                            <span className="text-[10px] shrink-0">TEAM</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <div className="flex flex-col items-center ">
                                <div className="border border-black w-12 h-[20px] flex items-center justify-center text-[11px] whitespace-nowrap overflow-hidden bg-white tracking-wide">
                                    {actualEndTime ? actualEndTime.replace(/\s+/g, '') : ':'}
                                </div>
                            </div>
                            <div className="flex flex-col items-start leading-[0.9] text-[9px] font-bold">
                                <span>END</span><span>time</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. POINTS R (8%) */}
                    <div className="w-[8%] flex items-center justify-center text-black font-bold text-[12px] bg-white shrink-0">
                        POINTS
                    </div>
                </div>

                <div className="flex-[10] flex divide-x-2 divide-black">
                    <div className="w-[42%] flex flex-col min-w-0"><TeamGrid startingPlayers={actualLineupL} subs={actualSubsL} serviceScores={actualServiceScoresL} /></div>
                    <div className="w-[8%] shrink-0"><PointsColumn minScore={1} maxScore={actualScoreL} timeouts={actualToL} /></div>
                    <div className="w-[42%] flex flex-col min-w-0"><TeamGrid startingPlayers={actualLineupR} subs={actualSubsR} serviceScores={actualServiceScoresR} /></div>
                    <div className="w-[8%] shrink-0"><PointsColumn minScore={1} maxScore={actualScoreR} timeouts={actualToR} /></div>
                </div>
            </div>
        </div>
    );
};

// 3. ตารางบันทึกการเปลี่ยนตัว / การเสิร์ฟ
const TeamGrid = ({ startingPlayers = Array(6).fill(''), subs = Array(6).fill(null), serviceScores = [] }) => (
    <div className="flex-1 flex flex-col bg-white h-full">
        {/* โซน Team line-up (สัดส่วน 5) */}
        <div className="flex-[5] flex flex-col divide-y border-b border-black">
            {/* 1. Service order (I - VI) */}
            <div className="flex-1 flex divide-x border-black text-[14px] font-bold">
                {['I', 'II', 'III', 'IV', 'V', 'VI'].map(col => <div key={col} className="flex-1 flex items-center justify-center bg-gray-50 print:bg-white">{col}</div>)}
            </div>
            {/* 2. N° of Starting players */}
            <div className="flex-1 flex divide-x border-black">
                {startingPlayers.map((playerNo, i) => (
                    <div key={i} className="flex-1 flex items-center justify-center font-bold text-[13px] bg-gray-50 print:bg-white">
                        {playerNo}
                    </div>
                ))}
            </div>
            {/* 3. Substitutes (แบ่งย่อยเป็น N° 1 แถว และ Score at change 2 แถว) */}
            <div className="flex-[3] flex flex-col divide-y border-black">
                {/* N° of Player (1 แถว) */}
                <div className="flex-1 flex divide-x border-black">
                    {subs.map((sub, i) => (
                        <div key={i} className="flex-1 flex items-center justify-center font-bold text-[13px]">
                            {sub?.playerNo ? (
                                sub.isCompleted ? (
                                    <div className="w-[24px] h-[24px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">
                                        {sub.playerNo}
                                    </div>
                                ) : (
                                    sub.playerNo
                                )
                            ) : (
                                ''
                            )}
                        </div>
                    ))}
                </div>
                {/* Score at change แถวที่ 1 */}
                <div className="flex-1 flex divide-x border-black">
                    {subs.map((sub, i) => (
                        <div key={i} className="flex-1 flex items-center justify-center font-bold text-[10px] pb-[1px] leading-none">
                            {sub?.score1 || ''}
                        </div>
                    ))}
                </div>
                {/* Score at change แถวที่ 2 */}
                <div className="flex-1 flex divide-x border-black">
                    {subs.map((sub, i) => (
                        <div key={i} className="flex-1 flex items-center justify-center font-bold text-[10px] pb-[1px] leading-none">
                            {sub?.score2 || ''}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* โซน Service Rounds (สัดส่วน 4) */}
        <div className="flex-[4] flex flex-col divide-y border-black">
            {[
                { l: 1, r: 5 }, { l: 2, r: 6 }, { l: 3, r: 7 }, { l: 4, r: 8 }
            ].map((row, idx) => (
                <div key={idx} className="flex-1 flex divide-x border-black">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex-1 flex divide-x border-black bg-white">
                            <div className="flex-1 relative flex items-center justify-center">
                                <span className="absolute right-[2px] top-[1px] text-[7px] text-black font-bold leading-none">{row.l}</span>
                                <span className="text-[12px] font-bold text-black">{serviceScores[idx * 6 + i] || ''}</span>
                            </div>
                            <div className="flex-1 relative flex items-center justify-center">
                                <span className="absolute right-[2px] top-[1px] text-[7px] text-black font-bold leading-none">{row.r}</span>
                                <span className="text-[12px] font-bold text-black">{serviceScores[idx * 6 + i + 24] || ''}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    </div>
);

// 4. คอลัมน์คะแนน 1-48
const PointsColumn = ({ minScore = 1, maxScore = 0, timeouts = [] }) => (
    <div className="flex flex-col w-full h-full bg-white">
        <div className="flex-[7] flex divide-x border-black overflow-hidden">
            {[0, 12, 24, 36].map((offset) => (
                <div key={offset} className="flex-1 flex flex-col justify-between py-[2px]">
                    {Array.from({ length: 12 }, (_, i) => offset + i + 1).map(num => (
                        <div key={num} className="flex-1 flex items-center justify-center text-[9px]  leading-none text-black relative">
                            <span className="z-10">{num}</span>
                            {/* ขีดเส้นทับคะแนน (SVG Slash) */}
                            {num >= minScore && num <= maxScore && (
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 10 10" preserveAspectRatio="none">
                                    <line x1="8" y1="2" x2="2" y2="8" stroke="black" strokeWidth="1" />
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>

        <div className="flex-[2] flex flex-col divide-y border-t border-black bg-white">
            <div className="flex-1 flex items-center justify-center font-bold text-[14px]">"T"</div>
            <div className="flex-1 flex items-center justify-center font-bold text-[12px] leading-none pb-[2px]">{timeouts[0] || ''}</div>
            <div className="flex-1 flex items-center justify-center font-bold text-[12px] leading-none pb-[2px]">{timeouts[1] || ''}</div>
        </div>
    </div>
);

// ---------------------------------------------------------
// คอมโพเนนต์ย่อยเฉพาะสำหรับ Set 5
// ---------------------------------------------------------

const Set5RowHeader = () => (
    <div className="w-[12%] flex flex-col border-r-2 border-black text-[10px] font-bold bg-white">
        <div className="flex-[1.5] border-b-2 border-black"></div>
        <div className="flex-[5] flex border-b border-black">
            <div className="w-6 border-r border-black flex items-center justify-center">
                <span className="transform -rotate-90 whitespace-nowrap">Team line-up</span>
            </div>
            <div className="flex-1 flex flex-col divide-y border-black bg-gray-50 print:bg-white">
                <div className="flex-1 flex items-center justify-end pr-1">Service order</div>
                <div className="flex-1 flex items-center justify-end pr-1">N° of Starting players</div>
                <div className="flex-[3] flex">
                    <div className="w-5 border-r border-black flex items-center justify-center"><span className="transform -rotate-90">Substitutes</span></div>
                    <div className="flex-1 flex flex-col divide-y border-black">
                        <div className="flex-1 flex items-center justify-end pr-1">N° of Player</div>
                        <div className="flex-[2] flex flex-col justify-center items-end pr-1 text-right leading-[1.1]"><span>Score</span><span>at change</span></div>
                    </div>
                </div>
            </div>
        </div>
        <div className="flex-[3] flex">
            <div className="w-6 border-r border-black flex items-center justify-center">
                <span className="transform -rotate-90 whitespace-nowrap">Service rounds</span>
            </div>
            <div className="flex-1 flex flex-col divide-y border-black bg-gray-50 print:bg-white">
                <div className="flex-1 flex justify-between items-center px-2"><span>1st</span><span>4th</span></div>
                <div className="flex-1 flex justify-between items-center px-2"><span>2nd</span><span>5th</span></div>
                <div className="flex-1 flex justify-between items-center px-2"><span>3rd</span><span>6th</span></div>
            </div>
        </div>
    </div>
);

const Set5Box = ({ setNum, teamL, teamR, labelL, labelR, startTime, endTime, lineupL, lineupR, subsL, subsR, toL, toR, scoreL = 0, scoreR = 0, serviceScoresL = [], serviceScoresR = [], isTeamLServesFirst }) => {
    const isSetStarted = (lineupL && lineupL.some(p => p !== '')) || (lineupR && lineupR.some(p => p !== '')) || !!startTime || !!endTime;

    // Clear everything if the set has not started yet
    const actualStartTime = isSetStarted ? startTime : '';
    const actualEndTime = isSetStarted ? endTime : '';
    const displayTeamL = isSetStarted ? teamL : '';
    const displayTeamR = isSetStarted ? teamR : '';
    const actualLineupL = isSetStarted ? lineupL : Array(6).fill('');
    const actualLineupR = isSetStarted ? lineupR : Array(6).fill('');
    const actualSubsL = isSetStarted ? subsL : Array(6).fill(null);
    const actualSubsR = isSetStarted ? subsR : Array(6).fill(null);
    const actualToL = isSetStarted ? toL : [];
    const actualToR = isSetStarted ? toR : [];
    const actualScoreL = isSetStarted ? scoreL : 0;
    const actualScoreR = isSetStarted ? scoreR : 0;
    const actualServiceScoresL = isSetStarted ? serviceScoresL : [];
    const actualServiceScoresR = isSetStarted ? serviceScoresR : [];

    // Split timeouts for Team L (before/after change of sides at score 8)
    const toLBeforeChange = actualToL.filter(t => {
        const parts = t.split(':');
        const score = parseInt(parts[0]) || 0; // home score is first
        return score <= 8;
    });

    const toLAfterChange = actualToL.filter(t => {
        const parts = t.split(':');
        const score = parseInt(parts[0]) || 0; // home score is first
        return score > 8;
    });

    // Split substitutions for Team L
    const subsLBeforeChange = actualSubsL.map(sub => {
        if (!sub) return null;
        const parts = sub.score1.split(':');
        const score = parseInt(parts[0]) || 0;
        return score <= 8 ? sub : null;
    });

    const subsLAfterChange = actualSubsL.map(sub => {
        if (!sub) return null;
        const parts = sub.score1.split(':');
        const score = parseInt(parts[0]) || 0;
        return score > 8 ? sub : null;
    });

    // Split service scores for Team L
    const serviceScoresLBeforeChange = actualServiceScoresL.map(scoreStr => {
        const scoreVal = parseInt(scoreStr) || 0;
        return (scoreStr !== '' && scoreVal <= 8) ? scoreStr : '';
    });

    // Split service scores for Team L after change
    const serviceScoresLAfterChange = actualServiceScoresL.map(scoreStr => {
        const scoreVal = parseInt(scoreStr) || 0;
        return (scoreStr !== '' && scoreVal > 8) ? scoreStr : '';
    });

    return (
        <div className="w-[88%] flex relative">
            <div className="w-[4%] flex flex-col items-center justify-center border-r-2 border-black font-semibold text-lg bg-gray-100 shrink-0">
                <span>S</span><span>E</span><span>T</span>
                <span className="text-2xl mt-1">{setNum || 5}</span> {/* แสดงหมายเลขเซต 3 หรือ 5 ได้ */}
            </div>

            <div className="w-[96%] flex flex-col min-w-0">
                {/* สัดส่วน Header ต้องเป๊ะ 26-6-26-6-4-26-6 และใช้ border ขวาเพื่อกั้น */}
                <div className="flex-[1.5] border-b-2 border-black flex text-[10px] font-bold bg-white">

                    {/* 1. TEAM L Header (26%) */}
                    <div className="w-[26%] border-r-2 border-black flex items-center justify-between px-1 min-w-0">
                        <div className="flex items-center gap-[2px] shrink-0">
                            <div className="flex flex-col items-end leading-[0.9] text-[9px] font-bold">
                                <span>START</span><span>time</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="border border-black w-12 h-[20px] flex items-center justify-center text-[11px] whitespace-nowrap overflow-hidden bg-white tracking-wide">
                                    {actualStartTime ? actualStartTime.replace(/\s+/g, '') : ':'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-[1px] flex-1 justify-start ml-2 min-w-0">
                            <span className="text-[9px] shrink-0">TEAM</span>
                            <div className={`relative border border-black flex-1 max-w-[120px] mx-[2px] h-[20px] flex items-center justify-center truncate px-1 bg-white ${getTeamFontSize(displayTeamL, 12)}`}>
                                {displayTeamL}
                            </div>
                            <div className="w-[20px] h-[20px] rounded-full border-[1.5px] border-black flex items-center justify-center text-[12px] pb-[1px] shrink-0">{labelL}</div>
                            <div className="flex flex-col gap-[1px] ml-[2px] shrink-0">
                                <CircleSR type="S" isCrossed={isTeamLServesFirst !== null && isTeamLServesFirst} />
                                <CircleSR type="R" isCrossed={isTeamLServesFirst !== null && !isTeamLServesFirst} />
                            </div>
                        </div>
                    </div>

                    {/* P1: 6% */}
                    <div className="w-[6%] border-r-2 border-black flex items-center justify-center bg-white text-[12px] font-bold text-black shrink-0">POINTS</div>

                    {/* R1: 26% */}
                    <div className="w-[26%] border-r-2 border-black flex items-center justify-between px-1 min-w-0">
                        <div className="flex items-center gap-[1px] flex-1 min-w-0">
                            <div className="flex flex-col gap-[1px] mr-[2px] shrink-0">
                                <CircleSR type="S" isCrossed={isTeamLServesFirst !== null && !isTeamLServesFirst} />
                                <CircleSR type="R" isCrossed={isTeamLServesFirst !== null && isTeamLServesFirst} />
                            </div>
                            <div className="w-[20px] h-[20px] rounded-full border-[1.5px] border-black flex items-center justify-center text-[12px] pb-[1px] shrink-0">{labelR}</div>
                            <div className={`relative border border-black flex-1 ml-2 max-w-[125px] mx-[2px] h-[20px] flex items-center justify-center truncate px-1 bg-white ${getTeamFontSize(displayTeamR, 12)}`}>
                                {displayTeamR}
                            </div>
                            <span className="text-[9px] shrink-0">TEAM</span>
                        </div>
                        <div className="flex items-center gap-[2px] shrink-0">
                            <div className="flex flex-col items-center">
                                <div className="border border-black w-12 h-[20px] flex items-center justify-center text-[11px] whitespace-nowrap overflow-hidden bg-white tracking-wide">
                                    {actualEndTime ? actualEndTime.replace(/\s+/g, '') : ':'}
                                </div>
                            </div>
                            <div className="flex flex-col items-start leading-[0.9] text-[9px] font-bold">
                                <span>END</span><span>time</span>
                            </div>
                        </div>
                    </div>

                    {/* P2: 6% */}
                    <div className="w-[6%] border-r-2 border-black flex items-center justify-center bg-white text-[12px] font-bold text-black shrink-0">POINTS</div>

                    {/* C: 4% */}
                    <div className="w-[4%] border-r-2 border-black flex flex-col items-center justify-center text-[10px] font-bold bg-white shrink-0">

                    </div>

                    {/* L2 (Change): 26% */}
                    <div className="w-[26%] border-r-2 border-black flex items-center justify-between px-1 min-w-0">
                        <div className="flex items-center gap-[2px] shrink-0">
                            <span className="text-[9px]">TEAM</span>
                            <div className="w-[20px] h-[20px] rounded-full border-[1.5px] border-black flex items-center justify-center text-[12px] pb-[1px] ml-1">{labelL}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[12px] font-bold tracking-tighter">POINTS AT CHANGE</span>
                            <div className="border border-black w-12 h-[20px] bg-white flex items-center justify-center font-bold text-[12px]">
                                {actualScoreL >= 8 || actualScoreR >= 8 ? '8' : ''}
                            </div>
                        </div>
                    </div>

                    {/* P3: 6% */}
                    <div className="w-[6%] flex items-center justify-center bg-white text-[12px] font-bold text-black shrink-0">POINTS</div>
                </div>

                {/* พื้นที่ Grid ของ Set 5 ด้านล่าง */}
                <div className="flex-[8] flex">
                    {/* ฝั่งซ้ายสุด (ทีม L ก่อนเปลี่ยนแดน) */}
                    <div className="w-[26%] border-r-2 border-black min-w-0"><Set5TeamGrid startingPlayers={actualLineupL} subs={subsLBeforeChange} serviceScores={serviceScoresLBeforeChange} /></div>
                    <div className="w-[6%] border-r-2 border-black shrink-0">
                        {/* เปลี่ยนจาก scoreHome เป็น scoreL */}
                        <Set5PointsColumn minScore={1} maxScore={Math.min(actualScoreL, 8)} timeouts={toLBeforeChange} />
                    </div>

                    {/* ตรงกลาง (ทีม R) */}
                    <div className="w-[26%] border-r-2 border-black min-w-0"><Set5TeamGrid startingPlayers={actualLineupR} subs={actualSubsR} serviceScores={actualServiceScoresR} /></div>
                    <div className="w-[6%] border-r-2 border-black shrink-0">
                        {/* เปลี่ยนจาก scoreAway เป็น scoreR */}
                        <Set5PointsColumn minScore={1} maxScore={actualScoreR} timeouts={actualToR} />
                    </div>

                    {/* แถบ Change Side */}
                    <div className="w-[4%] border-r-2 border-black flex flex-col items-center justify-center text-[11px] font-bold leading-[1.2] bg-white text-gray-800 shrink-0">
                        <span>c</span><span>h</span><span>a</span><span>n</span><span>g</span><span>e</span>
                        <div className="h-1"></div>
                        <span>s</span><span>i</span><span>d</span><span>e</span>
                    </div>

                    {/* ฝั่งขวาสุด (ทีม L หลังเปลี่ยนแดนที่แต้ม 8) */}
                    <div className="w-[26%] border-r-2 border-black min-w-0"><Set5TeamGrid startingPlayers={actualLineupL} subs={subsLAfterChange} serviceScores={serviceScoresLAfterChange} /></div>
                    <div className="w-[6%] shrink-0">
                        {/* เปลี่ยนจาก scoreHome เป็น scoreL */}
                        <Set5PointsColumn minScore={9} maxScore={actualScoreL} timeouts={toLAfterChange} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const Set5TeamGrid = ({ startingPlayers = Array(6).fill(''), subs = Array(6).fill(null), serviceScores = [] }) => (
    <div className="flex flex-col bg-white h-full">
        {/* โซน Team line-up (สัดส่วน 5) */}
        <div className="flex-[5] flex flex-col divide-y border-b border-black">
            {/* 1. Service order (I - VI) */}
            <div className="flex-1 flex divide-x border-black text-[14px] font-bold">
                {['I', 'II', 'III', 'IV', 'V', 'VI'].map(col => <div key={col} className="flex-1 flex items-center justify-center bg-gray-50 print:bg-white">{col}</div>)}
            </div>
            {/* 2. N° of Starting players */}
            <div className="flex-1 flex divide-x border-black">
                {startingPlayers.map((playerNo, i) => (
                    <div key={i} className="flex-1 flex items-center justify-center font-bold text-[13px] bg-gray-50 print:bg-white">
                        {playerNo}
                    </div>
                ))}
            </div>
            {/* 3. Substitutes block (3 แถว) */}
            <div className="flex-[3] flex flex-col divide-y border-black">
                {/* N° of Player */}
                <div className="flex-1 flex divide-x border-black">
                    {subs.map((sub, i) => (
                        <div key={i} className="flex-1 flex items-center justify-center font-bold text-[12px]">
                            {sub?.playerNo ? (
                                sub.isCompleted ? (
                                    <div className="w-[22px] h-[22px] rounded-full border-[1.5px] border-black flex items-center justify-center pb-[1px]">
                                        {sub.playerNo}
                                    </div>
                                ) : (
                                    sub.playerNo
                                )
                            ) : (
                                ''
                            )}
                        </div>
                    ))}
                </div>
                {/* Score at change แถวที่ 1 */}
                <div className="flex-1 flex divide-x border-black">
                    {subs.map((sub, i) => (
                        <div key={i} className="flex-1 flex items-center justify-center font-bold text-[10px] pb-[1px] leading-none">
                            {sub?.score1 || ''}
                        </div>
                    ))}
                </div>
                {/* Score at change แถวที่ 2 */}
                <div className="flex-1 flex divide-x border-black">
                    {subs.map((sub, i) => (
                        <div key={i} className="flex-1 flex items-center justify-center font-bold text-[10px] pb-[1px] leading-none">
                            {sub?.score2 || ''}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* โซน Service Rounds (สัดส่วน 3) */}
        <div className="flex-[3] flex flex-col divide-y border-black">
            {[
                { l: 1, r: 4 }, { l: 2, r: 5 }, { l: 3, r: 6 }
            ].map((row, idx) => (
                <div key={idx} className="flex-1 flex divide-x border-black">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex-1 flex divide-x border-black bg-white">
                            <div className="flex-1 relative flex items-center justify-center">
                                <span className="absolute right-[2px] top-[1px] text-[7px] text-black font-bold leading-none">{row.l}</span>
                                <span className="text-[12px] font-bold text-black">{serviceScores[idx * 6 + i] || ''}</span>
                            </div>
                            <div className="flex-1 relative flex items-center justify-center">
                                <span className="absolute right-[2px] top-[1px] text-[7px] text-black font-bold leading-none">{row.r}</span>
                                <span className="text-[12px] font-bold text-black">{serviceScores[idx * 6 + i + 18] || ''}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    </div>
);

const Set5PointsColumn = ({ minScore = 1, maxScore = 0, timeouts = [] }) => (
    <div className="flex flex-col w-full h-full bg-white">
        <div className="flex-[6] flex divide-x border-black overflow-hidden">
            {[0, 10, 20].map((offset) => (
                <div key={offset} className="flex-1 flex flex-col justify-between py-[1px]">
                    {Array.from({ length: 10 }, (_, i) => offset + i + 1).map(num => (
                        <div key={num} className="flex-1 flex items-center justify-center text-[9px] font-bold leading-none text-black relative">
                            <span className="z-10">{num}</span>
                            {/* ขีดเส้นทับคะแนน (SVG Slash) สำหรับ Set 5 */}
                            {num >= minScore && num <= maxScore && (
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 10 10" preserveAspectRatio="none">
                                    <line x1="8" y1="2" x2="2" y2="8" stroke="black" strokeWidth="1" />
                                </svg>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>

        <div className="flex-[2] flex flex-col divide-y border-t border-black bg-white">
            <div className="flex-1 flex items-center justify-center font-bold text-[14px]">"T"</div>
            <div className="flex-1 flex items-center justify-center font-bold text-[12px] leading-none pb-[2px]">{timeouts[0] || ''}</div>
            <div className="flex-1 flex items-center justify-center font-bold text-[12px] leading-none pb-[2px]">{timeouts[1] || ''}</div>
        </div>
    </div>
);