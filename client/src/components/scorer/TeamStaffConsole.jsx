import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Clock, Flag, Users, ChevronLeft, RefreshCcw, Loader2, Check, X } from 'lucide-react';
import client, { api } from '../../api';
import Swal from 'sweetalert2';
import { isPlayerLibero, filterActivePlayers } from '../../utils/playerFilters';

// Normalize and compare gender values for roster filtering
const normalizeGender = (g) => String(g || '').trim().toLowerCase();
const isMaleGender = (g) => ['male', 'm', 'men', 'ชาย'].includes(normalizeGender(g));
const isFemaleGender = (g) => ['female', 'f', 'women', 'หญิง'].includes(normalizeGender(g));
const matchesMatchGender = (player, matchGender) => {
    if (!matchGender) return true; // no restriction
    const mg = normalizeGender(matchGender);
    if (mg === 'all' || mg === 'mix' || mg === '') return true;
    const pg = normalizeGender(player?.gender || '');
    if (!pg) return true; // unknown player gender — keep visible
    if (isMaleGender(mg)) return isMaleGender(pg);
    if (isFemaleGender(mg)) return isFemaleGender(pg);
    return true;
};
const filterByMatchGender = (roster, matchGender) => Array.isArray(roster) ? roster.filter(p => matchesMatchGender(p, matchGender)) : [];
const getSocketServerUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return `${window.location.protocol}//${window.location.hostname}:3000`;
    return apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

const getLiberoTag = (p) => {
    if (!p) return 'L';
    const role = String(p.role || '').toUpperCase();
    const pos = String(p.position || '').toUpperCase();
    if (pos === 'L1' || role === 'L1' || role === 'L1+C') return 'L1';
    if (pos === 'L2' || role === 'L2' || role === 'L2+C') return 'L2';
    return 'L';
};

const getPlayerId = (player) => {
    if (player === undefined || player === null) return null;
    if (typeof player !== 'object') return player;
    return player.id ?? player.player_id ?? player.playerId ?? null;
};

const getPlayerNumber = (player) => {
    if (!player || typeof player !== 'object') return '';
    return player.number ?? player.entry_number ?? player.shirt_number ?? player.jersey_number ?? '';
};

const samePlayer = (a, b) => {
    const aId = getPlayerId(a);
    const bId = getPlayerId(b);
    return aId !== null && bId !== null && String(aId) === String(bId);
};

const normalizePlayerForDisplay = (player, rosterList = []) => {
    const playerId = getPlayerId(player);
    if (playerId === null) return player;
    const basePlayer = rosterList.find((candidate) => String(getPlayerId(candidate)) === String(playerId));
    const rawPlayer = typeof player === 'object' ? player : { id: playerId };
    return {
        ...(basePlayer || {}),
        ...rawPlayer,
        id: rawPlayer.id ?? rawPlayer.player_id ?? basePlayer?.id ?? playerId,
        player_id: rawPlayer.player_id ?? rawPlayer.id ?? basePlayer?.player_id ?? basePlayer?.id ?? playerId,
        number: getPlayerNumber(rawPlayer) || getPlayerNumber(basePlayer) || ''
    };
};

const hydrateLineupPlayers = (lineupList = [], rosterList = []) => (
    Array.isArray(lineupList)
        ? lineupList.map((player) => player ? normalizePlayerForDisplay(player, rosterList) : player)
        : []
);

const hydratePlayerMap = (playerMap = {}, rosterList = []) => (
    Object.fromEntries(
        Object.entries(playerMap || {}).map(([key, player]) => [
            key,
            player ? normalizePlayerForDisplay(player, rosterList) : player
        ])
    )
);

export default function TeamStaffConsole() {
    const { matchId } = useParams();
    const navigate = useNavigate();

    const [matchData, setMatchData] = useState(null);
    const [teamInfo, setTeamInfo] = useState(null);
    const [lineup, setLineup] = useState([]);
    const [liberoSwaps, setLiberoSwaps] = useState({});
    const [stats, setStats] = useState({ timeouts: 0, challenges: 2, substitutions: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const activeRequestIdRef = useRef(null);

    // Lineup edit states
    const [roster, setRoster] = useState([]);
    const [isSettingLineup, setIsSettingLineup] = useState(false);
    const [tempLineup, setTempLineup] = useState(Array(6).fill(null));
    const [selectedPlayerForLineup, setSelectedPlayerForLineup] = useState(null);
    const [isSubmittingLineup, setIsSubmittingLineup] = useState(false);
    const [hasPendingLineup, setHasPendingLineup] = useState(false);

    // Substitution states
    const [isSubstitutionMode, setIsSubstitutionMode] = useState(false);
    const [pendingSubstitutions, setPendingSubstitutions] = useState([]);
    const [selectedOutPlayer, setSelectedOutPlayer] = useState(null);
    const [hasPendingSubstitution, setHasPendingSubstitution] = useState(false);
    const [workflowStep, setWorkflowStep] = useState('LINEUP');
    const [subTracker, setSubTracker] = useState({ count: 0, positions: {}, usedPlayers: [] });
    const [isConnected, setIsConnected] = useState(false);
    const [isScorerConnected, setIsScorerConnected] = useState(false);

    // Video Challenge states
    const [showChallengeModal, setShowChallengeModal] = useState(false);
    const [isLastActionChallenge, setIsLastActionChallenge] = useState(null);
    const [selectedChallengeReason, setSelectedChallengeReason] = useState(null);
    const [challengeTimer, setChallengeTimer] = useState(7);
    const [hasPendingChallenge, setHasPendingChallenge] = useState(false);
    const [activeChallengeRequestId, setActiveChallengeRequestId] = useState(null);

    const teamId = teamInfo?.id;
    const teamSide = teamInfo?.side;

    const teamInfoRef = useRef(null);
    const matchDataRef = useRef(null);
    const rosterRef = useRef([]);
    const substitutionDraftRef = useRef({ isEditing: false, pendingCount: 0 });
    const lastPromptedSetRef = useRef(0);

    const getCompletedSubstitutions = useCallback(() => {
        const list = [];
        if (subTracker && subTracker.positions) {
            Object.keys(subTracker.positions).forEach(pos => {
                const posData = subTracker.positions[pos];
                if (posData) {
                    // 1. First sub (Starter -> Sub)
                    list.push({
                        outPlayer: { number: posData.starterNumber || '?', id: posData.starterId },
                        inPlayer: { number: posData.subNumber || '?', id: posData.subId },
                        score: posData.subScore || '0-0',
                        order: 1
                    });
                    // 2. Second sub (Sub -> Starter)
                    if (posData.returned) {
                        list.push({
                            outPlayer: { number: posData.subNumber || '?', id: posData.subId },
                            inPlayer: { number: posData.starterNumber || '?', id: posData.starterId },
                            score: posData.returnScore || '0-0',
                            order: 2
                        });
                    }
                }
            });
        }
        return list;
    }, [subTracker]);

    useEffect(() => {
        teamInfoRef.current = teamInfo;
    }, [teamInfo]);

    const checkAndPromptLineup = useCallback((live) => {
        if (!live) return;
        const step = live.workflowStep;
        const currentTeamInfo = teamInfoRef.current;
        if (!currentTeamInfo) return;
        const side = currentTeamInfo.side;
        
        const currentSetNum = live.matchData?.currentSet || live.matchData?.current_set || 1;
        const myLineup = side === 'home' ? live.homeLineup : live.awayLineup;
        const isLineupSet = myLineup && myLineup.length === 6 && myLineup.every(p => p !== null);

        if (step === 'LINEUP' && !isLineupSet && lastPromptedSetRef.current < currentSetNum) {
            lastPromptedSetRef.current = currentSetNum;
            setTempLineup(Array(6).fill(null));
            setSelectedPlayerForLineup(null);
        }
    }, []);

    useEffect(() => {
        matchDataRef.current = matchData;
    }, [matchData]);

    useEffect(() => {
        rosterRef.current = roster;
    }, [roster]);

    useEffect(() => {
        substitutionDraftRef.current = {
            isEditing: isSubstitutionMode,
            pendingCount: pendingSubstitutions.length
        };
    }, [isSubstitutionMode, pendingSubstitutions.length]);

    const fetchData = useCallback(async () => {
        try {
            // 1. Fetch both Match and Live state in parallel to avoid multiple renders & stale data flash
            const [matchRes, liveRes] = await Promise.all([
                api.getMatchById(matchId),
                api.getLiveState(matchId)
            ]);
            const m = matchRes.data;
            const live = liveRes.data;

            const user = JSON.parse(localStorage.getItem('user'));
            const isHome = String(m.home_team_id) === String(user?.team_id);
            const isAway = String(m.away_team_id) === String(user?.team_id);

            if (!isHome && !isAway) {
                Swal.fire('ไม่อนุญาตให้เข้าถึง', 'ทีมของคุณไม่มีส่วนเกี่ยวข้องกับการแข่งขันนี้', 'error');
                navigate('/team-dashboard');
                return;
            }

            if (String(m.status || '').toLowerCase() === 'finished' || String(m.status || '').toLowerCase() === 'completed') {
                Swal.fire('การแข่งขันจบลงแล้ว', 'ไม่สามารถใช้งาน Staff Console สำหรับแมตช์ที่จบแล้วได้', 'info');
                navigate('/team-dashboard');
                return;
            }

            // 2. Construct merged match data with live scores/sets to prevent visual flashing/stuttering
            const mergedMatchData = {
                ...m,
                current_set: live?.matchData?.currentSet || live?.matchData?.current_set || m.current_set,
                currentSet: live?.matchData?.currentSet || live?.matchData?.current_set || m.currentSet || m.current_set || 1,
                score_home: live?.score ? live.score.home : (live?.matchData?.score_home !== undefined ? live.matchData.score_home : m.score_home),
                score_away: live?.score ? live.score.away : (live?.matchData?.score_away !== undefined ? live.matchData.score_away : m.score_away),
                status: live?.matchData?.status || m.status
            };
            setMatchData(mergedMatchData);

            setTeamInfo({
                id: user.team_id,
                name: isHome ? m.home_team_name : m.away_team_name,
                side: isHome ? 'home' : 'away'
            });

            let currentRoster = [];
            try {
                const rosterRes = await api.getMatchRosterData(matchId);
                if (rosterRes.data) {
                    const r = isHome ? (rosterRes.data.home?.players || rosterRes.data.homeRoster) : (rosterRes.data.away?.players || rosterRes.data.awayRoster);
                    currentRoster = filterByMatchGender(filterActivePlayers(r || []), mergedMatchData?.gender || m?.gender);
                } else {
                    const teamPlayers = await api.getPlayersByTeam(user.team_id);
                    currentRoster = filterByMatchGender(filterActivePlayers(teamPlayers.data || []), mergedMatchData?.gender || m?.gender);
                }
            } catch {
                const teamPlayers = await api.getPlayersByTeam(user.team_id);
                currentRoster = filterByMatchGender(filterActivePlayers(teamPlayers.data || []), mergedMatchData?.gender || m?.gender);
            }
            setRoster(currentRoster);

            const side = isHome ? 'home' : 'away';

            if (live && live.workflowStep) {
                setWorkflowStep(live.workflowStep);
            }

            if (live) {
                const mySwaps = side === 'home' ? live.homeLiberoSwaps : live.awayLiberoSwaps;
                setLiberoSwaps(hydratePlayerMap(mySwaps || {}, currentRoster));
                checkAndPromptLineup(live);
            }

            // Sync rotated live lineup, fallback to DB starting lineup if not initialized yet
            const myLineup = side === 'home' ? live?.homeLineup : live?.awayLineup;
            if (myLineup && myLineup.length > 0) {
                setLineup(hydrateLineupPlayers(myLineup, currentRoster));
            } else {
                try {
                    const lineupRes = await client.get(`/scorer/match/${matchId}/lineup`);
                    const allLineups = lineupRes.data || [];
                    const teamLineupObj = allLineups.find(l => String(l.team_id) === String(user.team_id));
                    setLineup(teamLineupObj ? hydrateLineupPlayers(teamLineupObj.lineup, currentRoster) : []);
                } catch (err) {
                    console.error("Failed to load starting lineup fallback:", err);
                }
            }

            try {
                const reqRes = await client.get(`/match/${matchId}/requests/pending`);
                const myPendingLineup = reqRes.data.find(r => String(r.team_id) === String(user.team_id) && r.request_type === 'LINEUP');
                setHasPendingLineup(!!myPendingLineup);

                const myPendingSub = reqRes.data.find(r => String(r.team_id) === String(user.team_id) && r.request_type === 'SUBSTITUTION');
                setHasPendingSubstitution(!!myPendingSub);

                const myPendingChallenge = reqRes.data.find(r => String(r.team_id) === String(user.team_id) && r.request_type === 'CHALLENGE');
                setHasPendingChallenge(!!myPendingChallenge);

                if (myPendingLineup) {
                    activeRequestIdRef.current = myPendingLineup.id;
                } else if (myPendingSub) {
                    activeRequestIdRef.current = myPendingSub.id;
                    let pendingSubDetails = myPendingSub.details || {};
                    if (typeof pendingSubDetails === 'string') {
                        try {
                            pendingSubDetails = JSON.parse(pendingSubDetails || '{}');
                        } catch {
                            pendingSubDetails = {};
                        }
                    }
                    setPendingSubstitutions(pendingSubDetails.pairs || []);
                } else if (myPendingChallenge) {
                    activeRequestIdRef.current = myPendingChallenge.id;
                    setActiveChallengeRequestId(myPendingChallenge.id);
                } else {
                    activeRequestIdRef.current = null;
                    const hasLocalSubstitutionDraft = substitutionDraftRef.current.isEditing
                        || substitutionDraftRef.current.pendingCount > 0;
                    if (!hasLocalSubstitutionDraft) {
                        setPendingSubstitutions([]);
                    }
                    setActiveChallengeRequestId(null);
                }
            } catch {
                // ignore
            }

            if (live) {
                setStats({
                    timeouts: live.timeouts ? live.timeouts[side] : 0,
                    challenges: live.challenges ? live.challenges[side] : 2,
                    substitutions: live.substitutions ? live.substitutions[side] : 0
                });
                if (live.subTracker && live.subTracker[side]) {
                    setSubTracker(live.subTracker[side]);
                } else {
                    setSubTracker({ count: 0, positions: {}, usedPlayers: [] });
                }
            }

        } catch (err) {
            console.error("Error fetching staff data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [matchId, navigate, checkAndPromptLineup]);

    // --- EFFECT: SOCKET.IO FOR REAL-TIME UPDATES ---
    useEffect(() => {
        if (!teamId || !teamSide) return;

        const socketUrl = getSocketServerUrl();
        const socket = io(socketUrl);

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('join_match', {
                matchId,
                role: 'staff',
                teamId,
                side: teamSide
            });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            setIsScorerConnected(false);
        });

        if (socket.connected) {
            setIsConnected(true);
            socket.emit('join_match', {
                matchId,
                role: 'staff',
                teamId,
                side: teamSide
            });
        }

        socket.on('connection_status_update', (statuses) => {
            setIsScorerConnected(statuses.scorer || false);
        });

        socket.on('request_processed', (data) => {
            if (activeRequestIdRef.current && data.id === activeRequestIdRef.current) {
                if (data.status === 'APPROVED') {
                    Swal.fire({
                        icon: 'success',
                        title: 'คำขอได้รับการอนุมัติ',
                        text: 'เจ้าหน้าที่โต๊ะบันทึกดำเนินการตามคำขอของคุณแล้ว',
                        timer: 3000,
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false
                    });
                    fetchData();
                } else if (data.status === 'REJECTED') {
                    Swal.fire({
                        icon: 'error',
                        title: 'คำขอถูกปฏิเสธ',
                        text: 'กรุณาติดต่อเจ้าหน้าที่โต๊ะบันทึกโดยตรง',
                        timer: 4000,
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false
                    });
                }
                activeRequestIdRef.current = null;
                setHasPendingLineup(false);
                setHasPendingSubstitution(false);
                setPendingSubstitutions([]);
                setHasPendingChallenge(false);
                setActiveChallengeRequestId(null);
                setShowChallengeModal(false);
            }
        });

        socket.on('live_state_updated', (live) => {
            if (live) {
                if (live.matchData) {
                    setMatchData(prev => prev ? ({
                        ...prev,
                        current_set: live.matchData.currentSet || live.matchData.current_set || prev.current_set,
                        currentSet: live.matchData.currentSet || live.matchData.current_set || prev.currentSet,
                        score_home: live.score ? live.score.home : (live.matchData.score_home !== undefined ? live.matchData.score_home : prev.score_home),
                        score_away: live.score ? live.score.away : (live.matchData.score_away !== undefined ? live.matchData.score_away : prev.score_away),
                        status: live.matchData.status || prev.status
                    }) : null);
                }
                if (live.workflowStep) {
                    setWorkflowStep(live.workflowStep);
                }
                const currentTeamInfo = teamInfoRef.current;
                if (currentTeamInfo) {
                    const side = currentTeamInfo.side;
                    setStats({
                        timeouts: live.timeouts ? live.timeouts[side] : 0,
                        challenges: live.challenges ? live.challenges[side] : 2,
                        substitutions: live.substitutions ? live.substitutions[side] : 0
                    });
                    if (live.subTracker && live.subTracker[side]) {
                        const newTracker = live.subTracker[side];
                        setSubTracker(prev => {
                            if (prev && newTracker.count > prev.count) {
                                setPendingSubstitutions([]);
                                setHasPendingSubstitution(false);
                                activeRequestIdRef.current = null;
                            }
                            return newTracker;
                        });
                    } else {
                        setSubTracker({ count: 0, positions: {}, usedPlayers: [] });
                    }
                    const myLineup = side === 'home' ? live.homeLineup : live.awayLineup;
                    if (myLineup) {
                        setLineup(hydrateLineupPlayers(myLineup, rosterRef.current));
                    }
                    const mySwaps = side === 'home' ? live.homeLiberoSwaps : live.awayLiberoSwaps;
                    setLiberoSwaps(hydratePlayerMap(mySwaps || {}, rosterRef.current));
                    checkAndPromptLineup(live);
                }
            }
        });

        socket.on('lineup_cleared', (data) => {
            const currentTeamInfo = teamInfoRef.current;
            if (currentTeamInfo && String(data.team_id) === String(currentTeamInfo.id)) {
                setLineup([]);
                setTempLineup(Array(6).fill(null));
                setSelectedPlayerForLineup(null);
                setLiberoSwaps({});
                setHasPendingLineup(false);
            }
        });

        socket.on('roster_updated', (data) => {
            const currentTeamInfo = teamInfoRef.current;
            if (currentTeamInfo && String(data.team_id) === String(currentTeamInfo.id)) {
                fetchData();
            }
        });

        socket.on('match_updated', () => {
            fetchData();
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connection_status_update');
            socket.off('request_processed');
            socket.off('live_state_updated');
            socket.off('lineup_cleared');
            socket.off('roster_updated');
            socket.off('match_updated');
            socket.disconnect();
        };
    }, [matchId, teamId, teamSide, fetchData, checkAndPromptLineup]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleRequest = async (type) => {
        const typeThai = type === 'TIMEOUT' ? 'เวลานอก' : 'ชาเลนจ์';

        const result = await Swal.fire({
            title: `ยืนยันการขอ ${typeThai}?`,
            text: `คำขอจะถูกส่งไปยังเจ้าหน้าที่โต๊ะบันทึกเพื่อตรวจสอบ`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'ส่งคำขอ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#2563eb'
        });

        if (result.isConfirmed) {
            try {
                const res = await client.post(`/match/${matchId}/request`, {
                    team_id: teamInfo.id,
                    request_type: type
                });

                // เก็บ ID คำขอที่ได้จาก Backend ไว้ตรวจสอบสถานะผ่าน Socket
                activeRequestIdRef.current = res.data.requestId;

                Swal.fire({
                    icon: 'success',
                    title: 'ส่งคำขอเรียบร้อยแล้ว',
                    text: 'กรุณารอการตอบรับจากเจ้าหน้าที่',
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire('Error', 'ไม่สามารถส่งคำขอได้: ' + (error.response?.data?.error || error.message), 'error');
            }
        }
    };

    const handleCancelSubstitutionRequest = async () => {
        if (activeRequestIdRef.current && hasPendingSubstitution) {
            try {
                // We'll just call the delete endpoint if available, or just ignore and reset locally. Let's send a DELETE or PUT CANCELLED.
                // Assuming the backend has a way to reject/delete, we'll try DELETE or just PUT status: REJECTED
                await client.put(`/match/${matchId}/requests/${activeRequestIdRef.current}`, { status: 'REJECTED' });
                setHasPendingSubstitution(false);
                setPendingSubstitutions([]);
                activeRequestIdRef.current = null;
            } catch (err) {
                console.error('Failed to cancel request', err);
            }
        }
    };

    const handleChallengeTimeout = useCallback(async () => {
        setShowChallengeModal(false);
        if (activeChallengeRequestId) {
            try {
                await client.put(`/match/${matchId}/requests/${activeChallengeRequestId}`, { status: 'REJECTED' });
            } catch (err) {
                console.error('Failed to cancel request on timeout', err);
            }
        }
        activeRequestIdRef.current = null;
        setActiveChallengeRequestId(null);
        setHasPendingChallenge(false);
        Swal.fire({
            icon: 'warning',
            title: 'หมดเวลาการเลือกข้อมูลชาเลนจ์',
            text: 'หมดเวลา 7 วินาทีตามกฎ FIVB คำขอชาเลนจ์ถูกยกเลิก',
            timer: 3000,
            toast: true,
            position: 'top-end',
            showConfirmButton: false
        });
    }, [activeChallengeRequestId, matchId]);

    // Video Challenge Effects & Handlers
    useEffect(() => {
        let interval = null;
        if (showChallengeModal && challengeTimer > 0) {
            interval = setInterval(() => {
                setChallengeTimer(prev => prev - 1);
            }, 1000);
        } else if (showChallengeModal && challengeTimer === 0) {
            handleChallengeTimeout();
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [showChallengeModal, challengeTimer, handleChallengeTimeout]);

    const handleVideoChallengeClick = async () => {
        if (stats.challenges <= 0 || workflowStep === 'RALLY') return;
        
        try {
            const res = await client.post(`/match/${matchId}/request`, {
                team_id: teamInfo.id,
                request_type: 'CHALLENGE',
                details: { lastAction: null, reason: null }
            });
            
            const reqId = res.data.requestId;
            activeRequestIdRef.current = reqId;
            setActiveChallengeRequestId(reqId);
            setHasPendingChallenge(true);
            
            setIsLastActionChallenge(null);
            setSelectedChallengeReason(null);
            setChallengeTimer(7);
            setShowChallengeModal(true);
        } catch (error) {
            Swal.fire('Error', 'ไม่สามารถส่งคำขอชาเลนจ์ได้: ' + (error.response?.data?.error || error.message), 'error');
        }
    };

    const handleCancelChallengeRequest = async () => {
        if (activeChallengeRequestId && hasPendingChallenge) {
            try {
                await client.put(`/match/${matchId}/requests/${activeChallengeRequestId}`, { status: 'REJECTED' });
                setHasPendingChallenge(false);
                setActiveChallengeRequestId(null);
                setShowChallengeModal(false);
            } catch (err) {
                console.error('Failed to cancel challenge request', err);
            }
        }
    };

    const handleLastActionChoice = async (choice) => {
        setIsLastActionChallenge(choice);
        if (activeChallengeRequestId) {
            try {
                await client.put(`/match/${matchId}/requests/${activeChallengeRequestId}`, {
                    details: { lastAction: choice, reason: selectedChallengeReason, submittedAt: new Date().toISOString() }
                });
            } catch (err) {
                console.error("Failed to update challenge details:", err);
            }
        }
    };

    const handleChallengeReasonSelect = async (reason) => {
        setSelectedChallengeReason(reason);
        setShowChallengeModal(false);
        
        if (activeChallengeRequestId) {
            try {
                await client.put(`/match/${matchId}/requests/${activeChallengeRequestId}`, {
                    details: { lastAction: isLastActionChallenge, reason: reason, submittedAt: new Date().toISOString() }
                });
                Swal.fire({
                    icon: 'success',
                    title: 'ส่งรายละเอียดชาเลนจ์แล้ว',
                    text: 'เริ่มกระบวนการตรวจสอบวิดีโอชาเลนจ์',
                    timer: 2000,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false
                });
            } catch (err) {
                console.error("Failed to submit challenge reason:", err);
            }
        }
    };

    const handleConfirmSubMode = async () => {
        if (pendingSubstitutions.length === 0) return;
        
        setIsSubmittingLineup(true);
        try {
            const res = await client.post(`/match/${matchId}/request`, {
                team_id: teamInfo.id,
                request_type: 'SUBSTITUTION',
                details: { pairs: pendingSubstitutions }
            });
            activeRequestIdRef.current = res.data.requestId;
            setHasPendingSubstitution(true);
            setIsSubstitutionMode(false);
            Swal.fire({
                icon: 'success',
                title: 'ส่งคำขอเปลี่ยนตัวเรียบร้อยแล้ว',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('Error', 'ไม่สามารถส่งคำขอเปลี่ยนตัวได้: ' + (error.response?.data?.error || error.message), 'error');
        } finally {
            setIsSubmittingLineup(false);
        }
    };

    const getPlayerSubStatus = (player, idx) => {
        if (!player) return { eligible: false };
        
        // Fallback: if player has no originalPos, use idx
        const originalPos = player.originalPos !== undefined ? player.originalPos : idx;
        
        // Check if team sub limit reached (FIVB allows max 6 substitutions per set)
        const totalSubs = (stats.substitutions || 0) + pendingSubstitutions.length;
        if (totalSubs >= 6) {
            return { eligible: false, reason: 'ทีมเปลี่ยนตัวครบ 6 ครั้งในเซตนี้แล้วตามกฎ FIVB' };
        }
        
        // Check if player is a Libero (Liberos cannot be formally substituted)
        const isLibero = isPlayerLibero(player);
        if (isLibero) {
            return { eligible: false, reason: 'ผู้เล่นตำแหน่งลิเบอโร่ไม่สามารถเปลี่ยนตัวในระบบปกติได้' };
        }

        // Check if this position has history in subTracker
        if (subTracker && subTracker.positions) {
            const posData = subTracker.positions[originalPos];
            if (posData) {
                if (posData.returned) {
                    return { eligible: false, reason: 'ตำแหน่งนี้เปลี่ยนตัวครบตามโควต้าแล้ว (เข้า-ออกตำแหน่งเดิมได้คนละ 1 ครั้งต่อเซต)' };
                }
                
                // If posData.returned is false, the current player on court is the substitute.
                // The only person who can replace them is the starter.
                // Let's check if the starter is in roster (bench) and not on court.
                const starter = roster.find(p => String(getPlayerId(p)) === String(posData.starterId));
                if (!starter) {
                    return { eligible: false, reason: 'ไม่พบผู้เล่นตัวจริงเพื่อเปลี่ยนตัวกลับเข้าสู่สนาม' };
                }
                // Is starter already on court? (Should not be, but let's check)
                const isStarterOnCourt = lineup.some(p => p && String(getPlayerId(p)) === String(posData.starterId));
                if (isStarterOnCourt) {
                    return { eligible: false, reason: 'ผู้เล่นตัวจริงอยู่ในสนามแล้ว' };
                }
                return { eligible: true, mustBeStarterId: posData.starterId, starterNumber: posData.starterNumber };
            }
        }
        
        // If no prior subs for this position, any bench player who hasn't been used in another position can come in
        return { eligible: true };
    };

    const getEligibleBenchPlayersForSelectedOut = () => {
        if (!selectedOutPlayer) return [];
        let posIndex = lineup.findIndex(p => p && samePlayer(p, selectedOutPlayer));
        if (posIndex === -1) {
            const swapIndexStr = Object.keys(liberoSwaps).find(k => samePlayer(liberoSwaps[k], selectedOutPlayer));
            if (swapIndexStr !== undefined) {
                posIndex = parseInt(swapIndexStr, 10);
            }
        }
        if (posIndex === -1) return [];
        const originalPos = selectedOutPlayer.originalPos !== undefined ? selectedOutPlayer.originalPos : posIndex;
        const posData = subTracker?.positions?.[originalPos];
        
        const courtIds = lineup.filter(p => p).map(getPlayerId).filter(id => id !== null);
        const swappedIds = Object.values(liberoSwaps).filter(p => p).map(getPlayerId).filter(id => id !== null);
        const activeIds = [...courtIds, ...swappedIds];

        const availableBench = roster.filter(p => {
            const isLib = isPlayerLibero(p);
            const playerId = getPlayerId(p);
            return !isLib
                && !activeIds.some(id => String(id) === String(playerId))
                && !pendingSubstitutions.some(sub => samePlayer(sub.inPlayer, p));
        });
        
        if (posData) {
            return availableBench.filter(p => String(getPlayerId(p)) === String(posData.starterId));
        } else {
            const usedIds = subTracker?.usedPlayers || [];
            return availableBench.filter(p => !usedIds.some(id => String(id) === String(getPlayerId(p))));
        }
    };

    const getBenchPlayersForSubstitution = () => {
        const activeIds = [
            ...lineup.filter(Boolean).map(getPlayerId),
            ...Object.values(liberoSwaps).filter(Boolean).map(getPlayerId)
        ].filter(id => id !== null);

        const regularBenchPlayers = roster.filter(p => {
            const playerId = getPlayerId(p);
            return !isPlayerLibero(p)
                && !activeIds.some(id => String(id) === String(playerId))
                && !pendingSubstitutions.some(sub => samePlayer(sub.inPlayer, p));
        });

        if (!selectedOutPlayer) return regularBenchPlayers;

        const eligibleBench = getEligibleBenchPlayersForSelectedOut();
        return regularBenchPlayers.filter(p => eligibleBench.some(ep => samePlayer(ep, p)));
    };

    const handleSlotSubClick = (posIndex) => {
        if (!isSubstitutionMode) return;
        const liberoSwappedPlayer = liberoSwaps[posIndex];
        const player = liberoSwappedPlayer || lineup[posIndex];
        if (!player) return;
        
        // Disable selecting if already in pending outPlayers
        if (pendingSubstitutions.some(sub => samePlayer(sub.outPlayer, player))) {
            return;
        }
        
        const status = getPlayerSubStatus(player, posIndex);
        if (!status.eligible) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่สามารถเปลี่ยนตัวได้',
                text: status.reason,
                confirmButtonColor: '#2563eb',
                confirmButtonText: 'ตกลง'
            });
            return;
        }
        
        if (samePlayer(selectedOutPlayer, player)) {
            setSelectedOutPlayer(null);
        } else {
            setSelectedOutPlayer(player);
        }
    };

    const handleBenchSubClick = (player) => {
        if (!isSubstitutionMode || !selectedOutPlayer) return;
        
        // Check if bench player is already in pendingSubstitutions
        if (pendingSubstitutions.some(sub => samePlayer(sub.inPlayer, player))) return;
        
        // Check if bench player is a Libero
        const isLib = isPlayerLibero(player);
        if (isLib) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่สามารถเลือกได้',
                text: 'ผู้เล่นตำแหน่งลิเบอโร่ไม่สามารถเปลี่ยนตัวในระบบปกติได้',
                confirmButtonColor: '#2563eb',
                confirmButtonText: 'ตกลง'
            });
            return;
        }

        // Get the status of the selectedOutPlayer
        let posIndex = lineup.findIndex(p => p && samePlayer(p, selectedOutPlayer));
        if (posIndex === -1) {
            const swapIndexStr = Object.keys(liberoSwaps).find(k => samePlayer(liberoSwaps[k], selectedOutPlayer));
            if (swapIndexStr !== undefined) {
                posIndex = parseInt(swapIndexStr, 10);
            }
        }
        if (posIndex === -1) return;
        
        const originalPos = selectedOutPlayer.originalPos !== undefined ? selectedOutPlayer.originalPos : posIndex;
        const posData = subTracker?.positions?.[originalPos];
        
        if (posData) {
            // The only person who can replace the substitute is the starter
            if (String(getPlayerId(player)) !== String(posData.starterId)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ไม่สามารถเปลี่ยนตัวได้',
                    text: `ตามกฎ FIVB ผู้เล่นที่เปลี่ยนตัวกลับเข้าสนามต้องเป็นตัวจริงของตำแหน่งนี้เดิม (หมายเลข ${posData.starterNumber}) เท่านั้น`,
                    confirmButtonColor: '#2563eb',
                    confirmButtonText: 'ตกลง'
                });
                return;
            }
        } else {
            // This is the first substitution for this position.
            // Rule: The bench player must NOT have been used in any other position in this set.
            const usedIds = subTracker?.usedPlayers || [];
            if (usedIds.some(id => String(id) === String(getPlayerId(player)))) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ไม่สามารถเปลี่ยนตัวได้',
                    text: `ตามกฎ FIVB ผู้เล่นสำรอง (หมายเลข ${getPlayerNumber(player)}) เคยลงสนามในตำแหน่งอื่นในเซตนี้ไปแล้ว`,
                    confirmButtonColor: '#2563eb',
                    confirmButtonText: 'ตกลง'
                });
                return;
            }
        }
        
        setPendingSubstitutions([...pendingSubstitutions, { outPlayer: selectedOutPlayer, inPlayer: player }]);
        setSelectedOutPlayer(null);
    };

    const handleRotate = () => {
        setTempLineup(prev => {
            const newArr = [...prev];
            // Rotate 1 zone clockwise on the court: 1->6->5->4->3->2->1
            const p1 = newArr[0];
            newArr[0] = newArr[1];
            newArr[1] = newArr[2];
            newArr[2] = newArr[3];
            newArr[3] = newArr[4];
            newArr[4] = newArr[5];
            newArr[5] = p1;
            return newArr;
        });
    };

    const handleSlotClick = (idx) => {
        if (!isSettingLineup) return;
        if (selectedPlayerForLineup) {
            const isLib = isPlayerLibero(selectedPlayerForLineup);
            if (isLib) {
                Swal.fire({
                    icon: 'warning',
                    title: 'ไม่อนุญาตให้ดำเนินการ',
                    text: 'ไม่สามารถเลือกผู้เล่นตำแหน่ง Libero เป็นผู้เล่นตัวจริง 6 คนในสนามได้',
                    confirmButtonColor: '#2563eb',
                    confirmButtonText: 'ตกลง'
                });
                setSelectedPlayerForLineup(null);
                return;
            }

            const existingIdx = tempLineup.findIndex(p => p && p.id === selectedPlayerForLineup.id);
            const newLineup = [...tempLineup];
            if (existingIdx !== -1) {
                newLineup[existingIdx] = null;
            }
            newLineup[idx] = selectedPlayerForLineup;
            setTempLineup(newLineup);
            setSelectedPlayerForLineup(null);
        } else {
            const newLineup = [...tempLineup];
            newLineup[idx] = null;
            setTempLineup(newLineup);
        }
    };

    const handlePlayerSelect = (player) => {
        if (selectedPlayerForLineup && selectedPlayerForLineup.id === player.id) {
            setSelectedPlayerForLineup(null);
        } else {
            setSelectedPlayerForLineup(player);
        }
    };

    const handleStartLineup = () => {
        setIsSettingLineup(true);
        // Fill tempLineup with existing lineup if any
        const initialTemp = Array(6).fill(null);
        lineup.forEach((p, i) => {
            if (p && i < 6) initialTemp[i] = p;
        });
        setTempLineup(initialTemp);
    };

    const handleClearLineup = () => {
        setTempLineup(Array(6).fill(null));
        setSelectedPlayerForLineup(null);
    };

    const handleClearConfirmedLineup = async () => {
        const result = await Swal.fire({
            title: 'ยืนยันการล้างข้อมูล Lineup?',
            text: 'ระบบจะลบรายชื่อผู้เล่นตัวจริงที่บันทึกไว้ในเซตนี้ และจะไม่ส่งคำขอไปยังโต๊ะบันทึก',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ล้างข้อมูล',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#f43f5e',
            cancelButtonColor: '#64748b'
        });

        if (result.isConfirmed) {
            try {
                const currentSetNum = matchData.current_set || matchData.currentSet || 1;
                await client.delete(`/match/${matchId}/lineup/${teamInfo.id}?set=${currentSetNum}`);
                
                // Clear state locally
                setLineup([]);
                setTempLineup(Array(6).fill(null));
                setSelectedPlayerForLineup(null);

                // Cancel pending LINEUP request if exists
                if (activeRequestIdRef.current && hasPendingLineup) {
                    try {
                        await client.put(`/match/${matchId}/requests/${activeRequestIdRef.current}`, { status: 'REJECTED' });
                    } catch {
                        // ignore
                    }
                    activeRequestIdRef.current = null;
                }
                setHasPendingLineup(false);

                Swal.fire({
                    icon: 'success',
                    title: 'ล้างข้อมูล Lineup เรียบร้อยแล้ว',
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (error) {
                Swal.fire('Error', 'ไม่สามารถล้างข้อมูล Lineup ได้: ' + (error.response?.data?.error || error.message), 'error');
            }
        }
    };

    const handleConfirmLineup = async () => {
        const targetSetNumber = Number(matchData.current_set || matchData.currentSet || 1);

        if (workflowStep !== 'LINEUP') {
            Swal.fire(
                'Wait for next set',
                'Please wait for the scorer to press START NEXT SET. Lineup sheets can be submitted only during the lineup workflow.',
                'info'
            );
            return;
        }

        if (tempLineup.some(p => !p || !(p.id || p.player_id))) {
            Swal.fire('Error', 'กรุณาจัดผู้เล่นให้ครบทั้ง 6 ตำแหน่ง', 'warning');
            return;
        }

        const hasLibero = tempLineup.some(p => p && isPlayerLibero(p));
        if (hasLibero) {
            Swal.fire('Error', 'ไม่สามารถส่งรายชื่อที่มีผู้เล่นตำแหน่ง Libero อยู่ในสนามได้', 'warning');
            return;
        }

        setIsSubmittingLineup(true);
        try {
            const players = tempLineup.map((p, i) => ({
                position: i + 1,
                player_id: p.id,
                is_captain: p.is_captain || p.role === 'C' || false,
                is_libero: isPlayerLibero(p)
            }));

            await api.saveLineup(matchId, {
                team_id: teamInfo.id,
                set_number: targetSetNumber,
                player_positions: tempLineup,
                players
            });

            const res = await client.post(`/match/${matchId}/request`, {
                team_id: teamInfo.id,
                request_type: 'LINEUP',
                details: {
                    setNumber: targetSetNumber,
                    lineup: players.map(player => ({
                        position: player.position,
                        player_id: player.player_id
                    }))
                }
            });
            activeRequestIdRef.current = res.data.requestId;
            setHasPendingLineup(true);
            
            setIsSettingLineup(false);
            setLineup(tempLineup);
            
            Swal.fire({
                icon: 'success',
                title: 'ส่ง Lineup เรียบร้อยแล้ว',
                text: 'กำลังรอการอนุมัติจากเจ้าหน้าที่',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire('Error', 'ไม่สามารถส่งคำขอได้: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setIsSubmittingLineup(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin mb-4 text-blue-500" size={40} />กำลังโหลดข้อมูล...</div>;
    if (!matchData) return <div className="p-10 text-center text-red-500">ไม่พบข้อมูลการแข่งขัน</div>;

    const isLineupComplete = tempLineup.length === 6 && tempLineup.every(p => p && (p.id || p.player_id));
    const hasConfirmedLineup = lineup.length === 6 && lineup.every(p => p && (p.id || p.player_id));
    const currentSetNumber = Number(matchData?.current_set || matchData?.currentSet || 1);
    const lineupTargetSet = currentSetNumber;
    const shouldShowLineupCard = !hasPendingLineup && workflowStep === 'LINEUP' && !hasConfirmedLineup;
    const shouldShowActionCards = !hasPendingLineup && !shouldShowLineupCard &&
        ['SERVING', 'READY', 'RALLY', 'CHALLENGE_REVIEW'].includes(workflowStep);
    const hasChallengeSystem = matchData?.has_challenge === true || matchData?.has_challenge === 'true' || matchData?.has_challenge === 1 || matchData?.has_challenge === '1' || matchData?.hasChallenge === true || matchData?.hasChallenge === 'true' || matchData?.hasChallenge === 1 || matchData?.hasChallenge === '1';
    const mainClassName = isSettingLineup
        ? 'flex-1 min-h-0 p-3 md:p-5 xl:p-6 grid grid-cols-1 gap-4 md:gap-5 w-full max-w-[1040px] mx-auto items-stretch overflow-y-auto'
        : 'flex-1 min-h-0 p-3 md:p-5 xl:p-6 grid grid-cols-1 gap-4 md:gap-5 w-full max-w-[680px] mx-auto items-center overflow-y-auto';

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none text-slate-900">
            <header className="bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 md:px-6 shadow-sm flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center active:scale-95 transition" aria-label="Back"><ChevronLeft /></button>
                    <div>
                        <h1 className="font-semibold text-base md:text-lg leading-tight truncate max-w-[220px] md:max-w-[360px] text-slate-950">{teamInfo?.name}</h1>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-[11px] text-slate-500 uppercase tracking-[0.18em] font-semibold">Staff Console</p>
                        </div>
                    </div>
                </div>
                <div className="text-right rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 min-w-[116px]">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">SET {matchData?.current_set || matchData?.currentSet || 1}</div>
                    <div className="text-2xl font-black tabular-nums text-slate-950 leading-tight">
                        {matchData?.score_home ?? matchData?.scoreHome ?? 0} - {matchData?.score_away ?? matchData?.scoreAway ?? 0}
                    </div>
                </div>
            </header>

            <main className={mainClassName}>
                {/* LEFT SIDE: Court & Lineup */}
                {isSettingLineup && (
                <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col relative overflow-hidden justify-center min-h-[560px] md:min-h-0">
                    <div className="flex items-center justify-between mb-6 z-10">
                        {isSettingLineup && (
                            <button onClick={handleRotate} className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-white text-slate-700 rounded-xl text-sm font-bold transition-colors shadow-sm active:scale-95 backdrop-blur-md">
                                <RefreshCcw size={16} />
                                Rotate
                            </button>
                        )}
                    </div>
                    
                    {!isSettingLineup ? (
                        <div className="flex flex-col items-center justify-center flex-1 z-10">
                            <div className="bg-[#1b4fc6] p-4 pb-8 pt-0 relative aspect-[4/3] w-full max-w-[500px] flex flex-col justify-between  overflow-hidden shadow-xl">
                                <div className="flex-1 bg-[#f2a167] border-[4px] border-white relative p-4 flex flex-col justify-between">
                                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/50 -translate-y-1/2 border-dashed border-t-[3px] border-white/50 bg-transparent" />
                                    
                                    {!hasPendingLineup && lineup.length === 0 ? (
                                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/10 backdrop-blur-[2px]">
                                            <button onClick={handleStartLineup} className="bg-[#4ade80] hover:bg-[#22c55e] text-white font-bold py-4 px-10 rounded-xl shadow-xl border-[3px] border-white transition-all hover:scale-105 active:scale-95 flex items-center gap-3 text-xl">
                                                Set lineup
                                            </button>
                                        </div>
                                    ) : hasPendingLineup ? (
                                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/10 backdrop-blur-[2px]">
                                            <div className="bg-white/95 backdrop-blur-sm text-slate-800 font-bold py-4 px-8 rounded-xl shadow-xl border-2 border-amber-400 flex flex-col items-center gap-3 text-lg">
                                                <div className="flex items-center gap-3">
                                                    <Loader2 size={24} className="animate-spin text-amber-500" />
                                                    Waiting for Scorer...
                                                </div>
                                                <button onClick={handleClearConfirmedLineup} className="mt-2 text-xs bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition-colors">
                                                    Cancel & Clear Lineup
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Display Lineup if it exists */}
                                    <div className="grid grid-cols-3 gap-4 relative z-10">
                                        {[3, 2, 1].map((idx, i) => {
                                            const player = lineup[idx];
                                            const liberoSwappedPlayer = liberoSwaps[idx];
                                            const isLiberoOnCourt = !!liberoSwappedPlayer;
                                            const activePlayerForSub = liberoSwappedPlayer || player;

                                            const isSelected = samePlayer(selectedOutPlayer, activePlayerForSub);
                                            const isPendingOut = pendingSubstitutions.some(sub => samePlayer(sub.outPlayer, activePlayerForSub));
                                            const isCaptain = activePlayerForSub && (activePlayerForSub.is_captain || activePlayerForSub.isCaptain || activePlayerForSub.role === 'C');
                                            
                                            let starterNumber = null;
                                            if (activePlayerForSub && subTracker && subTracker.positions) {
                                                const originalPos = activePlayerForSub.originalPos !== undefined ? activePlayerForSub.originalPos : idx;
                                                const posData = subTracker.positions[originalPos];
                                                if (posData && !posData.returned && String(posData.starterId) !== String(getPlayerId(activePlayerForSub))) {
                                                    starterNumber = posData.starterNumber;
                                                }
                                            }

                                            return (
                                                <button key={i} 
                                                    onClick={() => isSubstitutionMode && handleSlotSubClick(idx)}
                                                    disabled={!isSubstitutionMode || isPendingOut && !isSelected}
                                                    className={`relative aspect-square rounded-full border-4 flex items-center justify-center text-3xl md:text-4xl font-black shadow-sm mx-auto w-[60px] h-[60px] md:w-[80px] md:h-[80px] transition-all
                                                        ${player ? (isLiberoOnCourt ? 'bg-[#ffff99] text-slate-900 border-yellow-400' : 'bg-[#ffdbb2] text-slate-800 border-white') : 'bg-transparent'}
                                                        ${isSubstitutionMode && player ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}
                                                        ${isSelected ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/50 ring-4 ring-blue-300' : isPendingOut ? 'border-rose-500 opacity-50 bg-rose-200' : isLiberoOnCourt ? 'border-yellow-400 opacity-90' : 'border-white opacity-90'}
                                                    `}>
                                                    {player ? (
                                                        <>
                                                            {getPlayerNumber(activePlayerForSub) || getPlayerNumber(player)}
                                                            {isCaptain && (
                                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border border-white shadow-sm">
                                                                    C
                                                                </span>
                                                            )}
                                                            {(isLiberoOnCourt && !player.replacedLiberoNumber) ? (
                                                                <span className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md" title={`ผู้เล่นจริงหมายเลข ${getPlayerNumber(liberoSwappedPlayer)}`}>
                                                                    {getPlayerNumber(liberoSwappedPlayer)}
                                                                </span>
                                                            ) : starterNumber ? (
                                                                <span className="absolute bottom-0 right-0 bg-[#2563eb] text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md" title={`เปลี่ยนตัวกับหมายเลข ${starterNumber}`}>
                                                                    {starterNumber}
                                                                </span>
                                                            ) : null}
                                                            {player.replacedLiberoNumber && (
                                                                <span className="absolute bottom-0 left-0 bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md" title={`ตัวรับอิสระที่ถูกเปลี่ยนตัวออกหมายเลข ${player.replacedLiberoNumber}`}>
                                                                    {player.replacedLiberoNumber}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : ''}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 relative z-10 mt-4">
                                        {[4, 5, 0].map((idx, i) => {
                                            const player = lineup[idx];
                                            const liberoSwappedPlayer = liberoSwaps[idx];
                                            const isLiberoOnCourt = !!liberoSwappedPlayer;
                                            const activePlayerForSub = liberoSwappedPlayer || player;

                                            const isSelected = samePlayer(selectedOutPlayer, activePlayerForSub);
                                            const isPendingOut = pendingSubstitutions.some(sub => samePlayer(sub.outPlayer, activePlayerForSub));
                                            const isCaptain = activePlayerForSub && (activePlayerForSub.is_captain || activePlayerForSub.isCaptain || activePlayerForSub.role === 'C');
                                            
                                            let starterNumber = null;
                                            if (activePlayerForSub && subTracker && subTracker.positions) {
                                                const originalPos = activePlayerForSub.originalPos !== undefined ? activePlayerForSub.originalPos : idx;
                                                const posData = subTracker.positions[originalPos];
                                                if (posData && !posData.returned && String(posData.starterId) !== String(getPlayerId(activePlayerForSub))) {
                                                    starterNumber = posData.starterNumber;
                                                }
                                            }

                                            return (
                                                <button key={i} 
                                                    onClick={() => isSubstitutionMode && handleSlotSubClick(idx)}
                                                    disabled={!isSubstitutionMode || isPendingOut && !isSelected}
                                                    className={`relative aspect-square rounded-full border-4 flex items-center justify-center text-3xl md:text-4xl font-black shadow-sm mx-auto w-[60px] h-[60px] md:w-[80px] md:h-[80px] transition-all
                                                        ${player ? (isLiberoOnCourt ? 'bg-[#ffff99] text-slate-900 border-yellow-400' : 'bg-[#ffdbb2] text-slate-800 border-white') : 'bg-transparent'}
                                                        ${isSubstitutionMode && player ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}
                                                        ${isSelected ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/50 ring-4 ring-blue-300' : isPendingOut ? 'border-rose-500 opacity-50 bg-rose-200' : isLiberoOnCourt ? 'border-yellow-400 opacity-90' : 'border-white opacity-90'}
                                                    `}>
                                                    {player ? (
                                                        <>
                                                            {getPlayerNumber(activePlayerForSub) || getPlayerNumber(player)}
                                                            {isCaptain && (
                                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border border-white shadow-sm">
                                                                    C
                                                                </span>
                                                            )}
                                                            {(isLiberoOnCourt && !player.replacedLiberoNumber) ? (
                                                                <span className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md" title={`ผู้เล่นจริงหมายเลข ${getPlayerNumber(liberoSwappedPlayer)}`}>
                                                                    {getPlayerNumber(liberoSwappedPlayer)}
                                                                </span>
                                                            ) : starterNumber ? (
                                                                <span className="absolute bottom-0 right-0 bg-[#2563eb] text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md" title={`เปลี่ยนตัวกับหมายเลข ${starterNumber}`}>
                                                                    {starterNumber}
                                                                </span>
                                                            ) : null}
                                                            {player.replacedLiberoNumber && (
                                                                <span className="absolute bottom-0 left-0 bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md" title={`ตัวรับอิสระที่ถูกเปลี่ยนตัวออกหมายเลข ${player.replacedLiberoNumber}`}>
                                                                    {player.replacedLiberoNumber}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : ''}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* Libero row */}
                                {(() => {
                                    const liberos = roster.filter(isPlayerLibero);
                                    if (liberos.length === 0) return null;
                                    return (
                                        <div className="flex justify-center gap-4 mt-3 mb-1 z-10">
                                            {liberos.map(libero => (
                                                <div 
                                                    key={libero.id}
                                                    className="relative bg-[#ffff99] text-black border-2 border-white rounded-full flex items-center justify-center text-xl font-bold w-[45px] h-[45px] md:w-[55px] md:h-[55px] shadow-md"
                                                    title={`${libero.first_name || ''} ${libero.last_name || ''} (Libero)`}
                                                >
                                                    {libero.number}
                                                    {(libero.is_captain || libero.isCaptain || libero.role === 'C') && (
                                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold border border-white">
                                                            C
                                                        </span>
                                                    )}
                                                    <span className="absolute -bottom-1 bg-orange-500 text-white text-[8px] px-1.5 rounded font-bold uppercase border border-white">
                                                        {getLiberoTag(libero)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                            
                            {lineup.length > 0 && !hasPendingLineup && workflowStep === 'LINEUP' && (
                                <div className="flex gap-4 mt-6">
                                    <button onClick={handleStartLineup} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-colors text-sm">
                                        Edit Lineup
                                    </button>
                                    <button onClick={handleClearConfirmedLineup} className="px-6 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl border border-rose-200 shadow-sm transition-colors text-sm">
                                        Clear Lineup
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6 flex-1 z-10">
                            {/* Player Selection Roster */}
                            <div className="flex flex-col gap-4 w-full">
                                {/* Regular Players */}
                                <div>
                                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Regular Players (ผู้เล่นปกติ)</div>
                                    <div className="bg-white/80 backdrop-blur-md border border-white rounded-2xl p-4 max-h-[150px] overflow-y-auto custom-scrollbar flex flex-wrap gap-3 shadow-sm">
                                        {roster.filter(p => !isPlayerLibero(p)).length === 0 ? (
                                            <div className="w-full text-center text-slate-400 py-4 text-sm font-bold italic">ไม่พบรายชื่อผู้เล่นปกติ</div>
                                        ) : (
                                            roster.filter(p => !isPlayerLibero(p)).map(player => {
                                                const isSelected = selectedPlayerForLineup?.id === player.id;
                                                const isPlaced = tempLineup.some(p => p && p.id === player.id);
                                                const isCaptain = player && (player.is_captain || player.isCaptain || player.role === 'C');
                                                
                                                return (
                                                    <button
                                                        key={player.id}
                                                        onClick={() => handlePlayerSelect(player)}
                                                        disabled={isPlaced && !isSelected}
                                                        className={`w-[55px] h-[55px] rounded-xl font-bold text-xl flex items-center justify-center transition-all border-2 relative
                                                            ${isSelected ? 'bg-blue-600 text-white border-blue-700 scale-110 shadow-lg z-10' 
                                                            : isPlaced ? 'bg-slate-200 text-slate-400 border-slate-300 opacity-50' 
                                                            : 'bg-white text-slate-700 border-white hover:border-blue-400 shadow-sm active:scale-95'}
                                                        `}
                                                    >
                                                                {getPlayerNumber(player)}
                                                        {isCaptain && (
                                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold border border-white">
                                                                C
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Libero Players */}
                                <div>
                                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Libero (ผู้เล่นลิเบอโร่)</div>
                                    <div className="bg-yellow-50/50 backdrop-blur-md border border-yellow-200 rounded-2xl p-4 flex flex-wrap gap-3 shadow-sm">
                                        {roster.filter(isPlayerLibero).length === 0 ? (
                                            <div className="w-full text-center text-slate-400 py-2 text-sm font-bold italic">ไม่พบรายชื่อลิเบอโร่</div>
                                        ) : (
                                            roster.filter(isPlayerLibero).map(player => (
                                                <div
                                                    key={player.id}
                                                    className="w-[55px] h-[55px] rounded-xl font-bold text-xl flex items-center justify-center bg-yellow-100 text-yellow-800 border-2 border-yellow-300 shadow-sm cursor-not-allowed opacity-85 relative"
                                                    title={`${player.first_name || ''} ${player.last_name || ''} (Libero - ไม่สามารถเริ่มเป็นตัวจริงได้)`}
                                                >
                                                    {getPlayerNumber(player)}
                                                    <span className="absolute -bottom-1 -right-1 bg-yellow-500 text-white text-[8px] px-1 rounded font-bold uppercase border border-white">
                                                        {getLiberoTag(player)}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Court Layout during setting */}
                            <div className="bg-[#1b4fc6] p-4 pb-8 pt-0 relative aspect-[4/3] w-full max-w-[400px] mx-auto flex flex-col justify-between rounded-xl overflow-hidden shadow-xl">
                                <div className="flex-1 bg-[#f2a167] border-[4px] border-white relative p-4 flex flex-col justify-between">
                                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/50 -translate-y-1/2 border-dashed border-t-[3px] border-white/50 bg-transparent" />
                                    
                                    <div className="grid grid-cols-3 gap-4 relative z-10">
                                        {[3, 2, 1].map((posIndex) => {
                                            const player = tempLineup[posIndex];
                                            const isCaptain = player && (player.is_captain || player.isCaptain || player.role === 'C');
                                            return (
                                                <button 
                                                    key={posIndex}
                                                    onClick={() => handleSlotClick(posIndex)}
                                                    className={`relative aspect-square rounded-full border-4 mx-auto w-[60px] h-[60px] md:w-[70px] md:h-[70px] flex items-center justify-center text-2xl font-black transition-all active:scale-95
                                                        ${player ? 'bg-[#ffdbb2] text-slate-800 border-white shadow-sm' : 'bg-white/20 border-white/60 text-white/80 border-dashed hover:bg-white/40'}
                                                        ${selectedPlayerForLineup && !player ? 'animate-pulse bg-white/50 border-white shadow-[0_0_20px_rgba(255,255,255,0.6)]' : ''}
                                                    `}
                                                >
                                                    {player ? (
                                                        <>
                                                            {getPlayerNumber(player)}
                                                            {isCaptain && (
                                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border border-white shadow-sm">
                                                                    C
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : '+'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4 relative z-10">
                                        {[4, 5, 0].map((posIndex) => {
                                            const player = tempLineup[posIndex];
                                            const isCaptain = player && (player.is_captain || player.isCaptain || player.role === 'C');
                                            return (
                                                <button 
                                                    key={posIndex}
                                                    onClick={() => handleSlotClick(posIndex)}
                                                    className={`relative aspect-square rounded-full border-4 mx-auto w-[60px] h-[60px] md:w-[70px] md:h-[70px] flex items-center justify-center text-2xl font-black transition-all active:scale-95
                                                        ${player ? 'bg-[#ffdbb2] text-slate-800 border-white shadow-sm' : 'bg-white/20 border-white/60 text-white/80 border-dashed hover:bg-white/40'}
                                                        ${selectedPlayerForLineup && !player ? 'animate-pulse bg-white/50 border-white shadow-[0_0_20px_rgba(255,255,255,0.6)]' : ''}
                                                    `}
                                                >
                                                    {player ? (
                                                        <>
                                                            {getPlayerNumber(player)}
                                                            {isCaptain && (
                                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold border border-white shadow-sm">
                                                                    C
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : '+'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* Libero row */}
                                {(() => {
                                    const liberos = roster.filter(isPlayerLibero);
                                    if (liberos.length === 0) return null;
                                    return (
                                        <div className="flex justify-center gap-4 mt-3 mb-1 z-10">
                                            {liberos.map(libero => (
                                                <div 
                                                    key={libero.id}
                                                    className="relative bg-[#ffff99] text-black border-2 border-white rounded-full flex items-center justify-center text-xl font-bold w-[45px] h-[45px] md:w-[55px] md:h-[55px] shadow-md"
                                                    title={`${libero.first_name || ''} ${libero.last_name || ''} (Libero)`}
                                                >
                                                    {libero.number}
                                                    {(libero.is_captain || libero.isCaptain || libero.role === 'C') && (
                                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold border border-white">
                                                            C
                                                        </span>
                                                    )}
                                                    <span className="absolute -bottom-1 bg-orange-500 text-white text-[8px] px-1.5 rounded font-bold uppercase border border-white">
                                                        {getLiberoTag(libero)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                            
                            <div className="flex gap-4 mt-auto">
                                <button 
                                    onClick={() => { setIsSettingLineup(false); setSelectedPlayerForLineup(null); }} 
                                    className="flex-1 py-4 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl transition-colors active:scale-95 shadow-sm text-lg"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleClearLineup} 
                                    className="flex-1 py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-2xl transition-colors active:scale-95 shadow-sm text-lg border border-rose-200"
                                >
                                    Clear
                                </button>
                                <button 
                                    onClick={handleConfirmLineup} 
                                    disabled={!isLineupComplete || isSubmittingLineup}
                                    className={`flex-[2] py-4 flex items-center justify-center gap-3 font-bold rounded-2xl transition-all shadow-md active:scale-95 text-lg
                                        ${isLineupComplete && !isSubmittingLineup ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-[#22c55e]/30' : 'bg-white/50 text-slate-400 cursor-not-allowed border border-slate-200'}
                                    `}
                                >
                                    {isSubmittingLineup ? <Loader2 size={24} className="animate-spin" /> : <Check size={24} strokeWidth={3} />}
                                    Confirm Lineup
                                </button>
                            </div>
                        </div>
                    )}
                </section>
                )}

                {/* RIGHT SIDE: Action Buttons or Substitution Mode */}
                {!isSettingLineup && (
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col gap-4 justify-center min-h-[360px] lg:min-h-0">
                        {hasPendingLineup ? (
                            <div className="w-full min-h-48 rounded-xl border border-amber-200 bg-amber-50/70 p-6 flex flex-col items-center justify-center text-center gap-4">
                                <Loader2 size={44} className="animate-spin text-amber-600" />
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-semibold text-slate-950">Waiting for scorer</h2>
                                    <p className="mt-2 text-sm md:text-base text-slate-600">LineUp has been sent. The action cards will appear after the scorer accepts it.</p>
                                </div>
                                <button onClick={handleClearConfirmedLineup} className="mt-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 active:scale-95 transition">
                                    Cancel & Clear LineUp
                                </button>
                            </div>
                        ) : shouldShowLineupCard ? (
                            <button onClick={handleStartLineup} className="w-full min-h-48 rounded-xl flex overflow-hidden border border-emerald-200 bg-white shadow-sm active:scale-[0.99] transition-all hover:shadow-md hover:-translate-y-0.5 group">
                                <div className="flex-1 p-6 flex flex-col justify-center gap-2 border-l-4 border-emerald-500">
                                    <span className="text-slate-950 text-3xl md:text-4xl font-semibold tracking-tight">Set LineUp</span>
                                    <span className="text-slate-500 text-sm md:text-base">Prepare starting six for Set {lineupTargetSet}</span>
                                </div>
                                <div className="w-24 bg-emerald-50 p-6 flex items-center justify-center border-l border-emerald-100">
                                    <Users size={44} className="text-emerald-700" />
                                </div>
                            </button>
                        ) : !shouldShowActionCards ? (
                            <div className="w-full min-h-48 rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center text-center gap-3">
                                <Flag size={38} className="text-slate-400" />
                                <h2 className="text-2xl font-semibold text-slate-950">Waiting for match workflow</h2>
                                <p className="text-sm md:text-base text-slate-600">Current status: {workflowStep || 'READY'}</p>
                            </div>
                        ) : isSubstitutionMode ? (
                            <div className="flex flex-col h-full">
                                {/* Player Selection Roster */}
                                <div className="flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar">
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">On Court - Select OUT (ผู้เล่นในสนาม)</div>
                                        <div className="bg-blue-50/60 backdrop-blur-md border border-blue-100 rounded-2xl p-4 flex flex-wrap gap-3 shadow-sm content-start">
                                            {[3, 2, 1, 4, 5, 0].map((posIndex) => {
                                                const activePlayer = liberoSwaps[posIndex] || lineup[posIndex];
                                                if (!activePlayer) return null;

                                                const activeNumber = getPlayerNumber(activePlayer);
                                                const isSelectedOut = samePlayer(selectedOutPlayer, activePlayer);
                                                const isPendingOut = pendingSubstitutions.some(sub => samePlayer(sub.outPlayer, activePlayer));
                                                const subStatus = getPlayerSubStatus(activePlayer, posIndex);
                                                const disabled = isPendingOut || !subStatus.eligible;

                                                return (
                                                    <button
                                                        key={`court-${posIndex}-${getPlayerId(activePlayer) || posIndex}`}
                                                        onClick={() => handleSlotSubClick(posIndex)}
                                                        disabled={disabled}
                                                        title={disabled ? subStatus.reason : `OUT #${activeNumber}`}
                                                        className={`w-[60px] h-[60px] rounded-full font-bold text-2xl flex items-center justify-center transition-all border-4 shadow-sm active:scale-95 relative
                                                            ${isSelectedOut ? 'bg-blue-600 text-white border-blue-700 scale-105 shadow-blue-200'
                                                            : disabled ? 'bg-slate-100 text-slate-300 border-slate-200 opacity-50 cursor-not-allowed'
                                                            : 'bg-white text-slate-800 border-blue-200 hover:border-blue-500 hover:scale-105'}
                                                        `}
                                                    >
                                                        {activeNumber}
                                                        <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[8px] px-1 rounded font-bold border border-white">
                                                            OUT
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            {lineup.filter(Boolean).length === 0 && (
                                                <div className="w-full text-center text-slate-400 py-4 text-sm font-bold italic">No on-court players</div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Bench Players */}
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Bench Players - Select IN</div>
                                        <div className="bg-white/80 backdrop-blur-md border border-white rounded-2xl p-4 flex flex-wrap gap-3 shadow-sm content-start">
                                            {getBenchPlayersForSubstitution().length === 0 ? (
                                                <div className="w-full text-center text-slate-400 py-6 text-base font-bold italic">
                                                    {selectedOutPlayer ? 'No eligible bench players' : 'No bench players'}
                                                </div>
                                            ) : (
                                                getBenchPlayersForSubstitution().map(player => {
                                                    const isSelected = pendingSubstitutions.some(sub => samePlayer(sub.inPlayer, player));
                                                    const disabled = isSelected || !selectedOutPlayer;

                                                    return (
                                                            <button
                                                                key={getPlayerId(player) || getPlayerNumber(player)}
                                                                onClick={() => handleBenchSubClick(player)}
                                                                disabled={disabled}
                                                                className={`w-[60px] h-[60px] rounded-full font-bold text-2xl flex items-center justify-center transition-all border-4 shadow-sm active:scale-95 relative
                                                                    ${isSelected ? 'bg-blue-600 text-white border-blue-700 opacity-50'
                                                                    : !selectedOutPlayer ? 'bg-slate-100 text-slate-300 border-slate-200 opacity-50 cursor-not-allowed'
                                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'}
                                                                `}
                                                            >
                                                                {getPlayerNumber(player)}
                                                                {(player.is_captain || player.isCaptain || player.role === 'C') && (
                                                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold border border-white">
                                                                        C
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Libero Players */}
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Libero (ผู้เล่นลิเบอโร่)</div>
                                        <div className="bg-yellow-50/50 backdrop-blur-md border border-yellow-200 rounded-2xl p-4 flex flex-wrap gap-3 shadow-sm">
                                            {roster.filter(isPlayerLibero).length === 0 ? (
                                                <div className="w-full text-center text-slate-400 py-2 text-sm font-bold italic">ไม่พบรายชื่อลิเบอโร่</div>
                                            ) : (
                                                roster.filter(isPlayerLibero).map(player => (
                                                    <div
                                                        key={player.id}
                                                        className="w-[60px] h-[60px] rounded-full font-bold text-2xl flex items-center justify-center bg-yellow-100 text-yellow-800 border-4 border-yellow-300 shadow-sm cursor-not-allowed opacity-85 relative"
                                                        title={`${player.first_name || ''} ${player.last_name || ''} (Libero - ไม่สามารถเปลี่ยนตัวในโหมดปกติได้)`}
                                                    >
                                                        {getPlayerNumber(player)}
                                                        <span className="absolute -bottom-1 -right-1 bg-yellow-500 text-white text-[8px] px-1 rounded font-bold uppercase border border-white">
                                                            {getLiberoTag(player)}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Selected Pairs preview */}
                                {pendingSubstitutions.length > 0 && (
                                    <div className="bg-white rounded-xl p-3 my-4 flex gap-2 flex-wrap shadow-sm">
                                        {pendingSubstitutions.map((sub, i) => (
                                            <div key={i} className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg flex items-center gap-2 font-black text-blue-800 text-lg">
                                                <span>{getPlayerNumber(sub.outPlayer)}</span>
                                                <span className="text-rose-500 font-bold px-1">&gt;&lt;</span>
                                                <span>{getPlayerNumber(sub.inPlayer)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <div className="flex gap-4 mt-auto pt-4">
                                    <button 
                                        onClick={() => { setIsSubstitutionMode(false); setPendingSubstitutions([]); setSelectedOutPlayer(null); }} 
                                        className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl transition-colors active:scale-95 shadow-sm text-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleConfirmSubMode} 
                                        disabled={pendingSubstitutions.length === 0 || isSubmittingLineup}
                                        className={`flex-1 py-4 font-bold rounded-2xl transition-colors active:scale-95 shadow-sm text-xl flex items-center justify-center gap-2
                                            ${pendingSubstitutions.length > 0 && !isSubmittingLineup ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}
                                        `}
                                    >
                                        {isSubmittingLineup ? <Loader2 size={24} className="animate-spin" /> : null}
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        ) : hasPendingSubstitution ? (
                            <button onClick={handleCancelSubstitutionRequest} className="w-full min-h-32 rounded-xl flex overflow-hidden border border-rose-200 bg-white shadow-sm active:scale-[0.99] transition-all group">
                                <div className="flex-1 p-6 flex flex-col justify-center gap-2 relative">
                                    <div className="flex gap-2 z-10 overflow-x-auto custom-scrollbar pb-1">
                                        {pendingSubstitutions.map((sub, i) => (
                                            <div key={i} className="bg-white/90 px-2 py-1 rounded text-rose-600 text-sm font-black flex gap-1 shadow-sm whitespace-nowrap">
                                                <span>{getPlayerNumber(sub.outPlayer)}</span>
                                                <span className="text-rose-400 font-bold">&gt;&lt;</span>
                                                <span>{getPlayerNumber(sub.inPlayer)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-slate-950 text-2xl md:text-3xl font-semibold tracking-tight z-10">Substitution</span>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                                        <Loader2 size={72} className="animate-spin text-rose-500" />
                                    </div>
                                </div>
                                <div className="w-24 bg-rose-600 hover:bg-rose-700 p-6 flex items-center justify-center transition-colors">
                                    <X size={48} className="text-white" />
                                </div>
                            </button>
                        ) : (
                            <>
                                <button onClick={() => setIsSubstitutionMode(true)} disabled={stats.substitutions >= 6 || workflowStep === 'RALLY'} className={`w-full min-h-32 rounded-xl flex overflow-hidden border border-amber-200 bg-white shadow-sm active:scale-[0.99] transition-all group ${stats.substitutions >= 6 || workflowStep === 'RALLY' ? 'opacity-50 grayscale' : 'hover:shadow-md hover:-translate-y-0.5'}`}>
                                    <div className="flex-1 p-6 flex items-center border-l-4 border-amber-500">
                                        <span className="text-slate-950 text-2xl md:text-3xl font-semibold tracking-tight">Substitution</span>
                                    </div>
                                    <div className="w-24 bg-amber-50 p-6 flex flex-col items-center justify-center border-l border-amber-100">
                                        <span className="text-amber-700 text-4xl md:text-5xl font-black leading-none">{6 - (stats.substitutions || 0)}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mt-1">left</span>
                                    </div>
                                </button>
                                
                                <button onClick={() => handleRequest('TIMEOUT')} disabled={stats.timeouts >= 2 || workflowStep === 'RALLY'} className={`w-full min-h-32 rounded-xl flex overflow-hidden border border-violet-200 bg-white shadow-sm active:scale-[0.99] transition-all group ${stats.timeouts >= 2 || workflowStep === 'RALLY' ? 'opacity-50 grayscale' : 'hover:shadow-md hover:-translate-y-0.5'}`}>
                                    <div className="flex-1 p-6 flex items-center border-l-4 border-violet-500">
                                        <span className="text-slate-950 text-2xl md:text-3xl font-semibold tracking-tight">Timeout</span>
                                    </div>
                                    <div className="w-24 bg-violet-50 p-6 flex flex-col items-center justify-center border-l border-violet-100">
                                        <span className="text-violet-700 text-4xl md:text-5xl font-black leading-none">{2 - (stats.timeouts || 0)}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mt-1">left</span>
                                    </div>
                                </button>
                                
                                {hasChallengeSystem && (
                                    hasPendingChallenge ? (
                                        <button onClick={handleCancelChallengeRequest} className="w-full min-h-32 rounded-xl flex overflow-hidden border border-rose-200 bg-white shadow-sm active:scale-[0.99] transition-all group">
                                            <div className="flex-1 p-6 flex flex-col justify-center gap-2 relative">
                                                <span className="text-slate-950 text-2xl md:text-3xl font-semibold tracking-tight z-10">Challenge Requesting</span>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">
                                                    <Loader2 size={72} className="animate-spin text-rose-500" />
                                                </div>
                                            </div>
                                            <div className="w-24 bg-rose-600 hover:bg-rose-700 p-6 flex items-center justify-center transition-colors">
                                                <X size={48} className="text-white" />
                                            </div>
                                        </button>
                                    ) : (
                                        <button onClick={handleVideoChallengeClick} disabled={stats.challenges <= 0 || workflowStep === 'RALLY'} className={`w-full min-h-32 rounded-xl flex overflow-hidden border border-blue-200 bg-white shadow-sm active:scale-[0.99] transition-all group ${stats.challenges <= 0 || workflowStep === 'RALLY' ? 'opacity-50 grayscale' : 'hover:shadow-md hover:-translate-y-0.5'}`}>
                                            <div className="flex-1 p-6 flex items-center border-l-4 border-blue-500">
                                                <span className="text-slate-950 text-2xl md:text-3xl font-semibold tracking-tight">Video challenge</span>
                                            </div>
                                            <div className="w-24 bg-blue-50 p-6 flex flex-col items-center justify-center border-l border-blue-100">
                                                <span className="text-blue-700 text-4xl md:text-5xl font-black leading-none">{stats.challenges || 0}</span>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mt-1">left</span>
                                            </div>
                                        </button>
                                    )
                                )}
                            </>
                        )}

                        {/* Completed Substitutions List (ดึงข้อมูลแสดงไว้จนกว่าจะจบเซต) */}
                        {shouldShowActionCards && (() => {
                            const completedSubs = getCompletedSubstitutions();
                            if (completedSubs.length === 0) return null;
                            return (
                                <div className="bg-white/80 border border-slate-200 rounded-2xl p-4 shadow-sm mt-4">
                                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                                        ประวัติการเปลี่ยนตัวเซตนี้ (Substitutions in this set)
                                    </div>
                                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                        {completedSubs.map((sub, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-2 font-bold text-slate-700">
                                                    <span className="text-rose-500">#{getPlayerNumber(sub.outPlayer)}</span>
                                                    <span className="text-slate-400">➡️</span>
                                                    <span className="text-emerald-600">#{getPlayerNumber(sub.inPlayer)}</span>
                                                </div>
                                                <span className="text-[11px] text-slate-400 font-mono">
                                                    Score: {sub.score}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </section>
                )}
            </main>

            <footer className="bg-white/95 border-t border-slate-200 px-4 py-2.5 md:px-6 shadow-[0_-1px_8px_rgba(15,23,42,0.04)]">
                <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                    <span className="truncate">Match staff console</span>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1" title="สถานะเชื่อมต่อกับเซิร์ฟเวอร์">
                            <span className="relative flex h-1.5 w-1.5">
                                {!isConnected && (
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                                )}
                                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                            </span>
                            <span className={`uppercase tracking-wider ${isConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
                                System: {isConnected ? 'Online' : 'Syncing'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1" title="สถานะการเชื่อมต่อกับเจ้าหน้าที่โต๊ะบันทึกสกอร์">
                            <span className="relative flex h-1.5 w-1.5">
                                {isScorerConnected && (
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                )}
                                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isScorerConnected ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                            </span>
                            <span className={`uppercase tracking-wider ${isScorerConnected ? 'text-emerald-700' : 'text-rose-600'}`}>
                                Scorer: {isScorerConnected ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
            </footer>

            {showChallengeModal && (
                <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 p-8 relative flex flex-col">
                        
                        {/* Header with Timer */}
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-slate-800 tracking-wide uppercase">Video Challenge</h2>
                            <div className="flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-full font-black text-base border border-amber-200 shadow-sm animate-pulse">
                                <Clock size={18} />
                                {challengeTimer}s LEFT
                            </div>
                        </div>

                        {/* Top Question */}
                        <div className="text-center mb-8">
                            <p className="text-xl font-bold text-slate-700 mb-4">Are you challenging the last action?</p>
                            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                <button
                                    onClick={() => handleLastActionChoice(false)}
                                    className={`py-4 px-6 rounded-2xl text-lg font-black transition-all shadow-md active:scale-95 border-2 ${
                                        isLastActionChallenge === false
                                            ? 'bg-[#7ecd76] text-white border-[#6bb864] ring-4 ring-[#7ecd76]/30'
                                            : 'bg-white text-slate-700 border-slate-200 hover:border-[#7ecd76]/50'
                                    }`}
                                >
                                    No
                                </button>
                                <button
                                    onClick={() => handleLastActionChoice(true)}
                                    className={`py-4 px-6 rounded-2xl text-lg font-black transition-all shadow-md active:scale-95 border-2 ${
                                        isLastActionChallenge === true
                                            ? 'bg-[#f3b562] text-white border-[#e0a24e] ring-4 ring-[#f3b562]/30'
                                            : 'bg-white text-slate-700 border-slate-200 hover:border-[#f3b562]/50'
                                    }`}
                                >
                                    Yes
                                </button>
                            </div>
                        </div>

                        <hr className="border-slate-100 my-2" />

                        {/* Bottom Options */}
                        <div className="mt-4">
                            <p className="text-base font-bold text-slate-500 uppercase tracking-widest text-center mb-6">Select Type of Request</p>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'Antenna touch', label: 'Antenna touch' },
                                    { id: 'Block touch', label: 'Block touch' },
                                    { id: 'Net touch', label: 'Net touch' },
                                    { id: 'Floor touch', label: 'Floor touch' },
                                    { id: 'Foot fault', label: 'Foot fault' },
                                    { id: 'Reaching beyond the net', label: 'Reaching beyond the net' },
                                    { id: 'Last touch', label: 'Last touch' }
                                ].map((reason) => {
                                    const isSelected = selectedChallengeReason === reason.id;
                                    const isDisabled = isLastActionChallenge === null;
                                    
                                    return (
                                        <button
                                            key={reason.id}
                                            disabled={isDisabled}
                                            onClick={() => handleChallengeReasonSelect(reason.id)}
                                            className={`py-4 px-6 rounded-2xl text-[15px] font-black transition-all shadow-sm select-none truncate ${
                                                isDisabled
                                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200/50'
                                                    : isSelected
                                                        ? 'bg-[#f25e5e] text-white border-2 border-[#d94e4e] ring-4 ring-[#f25e5e]/30'
                                                        : 'bg-[#479bf2] hover:bg-[#398be3] text-white border-2 border-[#398be3] hover:shadow-md active:scale-95'
                                            }`}
                                        >
                                            {reason.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
