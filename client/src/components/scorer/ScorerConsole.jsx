import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
    ListChecks, CheckCircle, X,  Loader,
    Trophy, RotateCcw, Flag, Clock, RefreshCcw, History, FileText, AlertTriangle, Repeat,
    Moon, Sun, Timer, ArrowUpDown, ArrowDown, ArrowUp, Pause, Megaphone as Whistle, PenTool, Settings
} from 'lucide-react';
import Swal from 'sweetalert2';

import CourtView from '../CourtView';
import client, { api } from '../../api';
import { formatThaiFullDateTime } from '../../utils';
import EventQueue from '../../utils/eventQueue';

// --- Imported Modals ---
import ChallengeModal from './modals/ChallengeModal';
import SanctionModal from './modals/SanctionModal';
import PreMatchSetupModal from './modals/PreMatchSetupModal';
import SubstitutionModal from './modals/SubstitutionModal';
import PlayerPicker from './modals/PlayerPickerModal';
import TeamInfoPanel from './partials/TeamInfoPanel';
import LineupModal from './modals/LineupModal';
import MatchLogModal from './modals/MatchLogModal';
// CoinTossModal replaced by SweetAlert sequence
import SignatureModal from './modals/SignatureModal';
import ManualEditModal from './modals/ManualEditModal';
import MatchInfoModal from './modals/MatchInfoModal';
import StaffRequestModal from './modals/StaffRequestModal';
import StaffChallengeRequestModal from './modals/StaffChallengeRequestModal';

// --- Modular Components ---
import ChallengeConfirmModal from './modals/ChallengeConfirmModal';
import ControlActionsPanel from './partials/ControlActionsPanel';
import MatchHistorySidebar from './partials/MatchHistorySidebar';
import TeamQuickControls from './partials/TeamQuickControls';
import MobileTeamDrawer from './partials/MobileTeamDrawer';
import CoinTossModal from './modals/CoinTossModal';
import LiberoSwapModal from './modals/LiberoSwapModal';

import Buzzer from '../../assets/sound/buzzer.mp3';

// Helper to extract 3-letter code from team name
const getTeamCode = (teamName) => {
    if (!teamName) return '';
    if (teamName.includes('-')) {
        return teamName.split('-')[0].trim().toUpperCase();
    }
    return teamName.substring(0, 3).toUpperCase();
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT (ScorerConsole)
// -----------------------------------------------------------------------------
export default function ScorerConsole() {
    const { matchId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // --- LIBERO HELPER FUNCTION ---
    const isPlayerLibero = (p) => {
        if (!p) return false;
        const role = String(p.role || '').toUpperCase();
        const pos = String(p.position || '').toUpperCase();
        return !!(
            p.isLibero ||
            p.is_libero ||
            p.is_libero1 ||
            p.is_libero2 ||
            role === 'L1' ||
            role === 'L2' ||
            role === 'L1+C' ||
            role === 'L2+C' ||
            role === 'L' ||
            pos === 'L' ||
            pos === 'L1' ||
            pos === 'L2'
        );
    };

    // --- LOCAL STORAGE HELPER ---
    const loadState = (key, defaultValue) => {
        try {
            const saved = localStorage.getItem(`match_${matchId}_${key}`);
            return saved !== null ? JSON.parse(saved) : defaultValue;
        } catch {
            return defaultValue;
        }
    };

    // --- INITIAL DATA ---
    const [matchData, setMatchData] = useState(() => {
        const saved = loadState('matchData', {});
        const stateData = location.state?.matchData || {};

        return {
            teamHome: stateData.teamHome || saved.teamHome || "HOME",
            teamAway: stateData.teamAway || saved.teamAway || "AWAY",
            teamHomeId: stateData.teamHomeId || saved.teamHomeId || null,
            teamAwayId: stateData.teamAwayId || saved.teamAwayId || null,
            currentSet: stateData.currentSet || saved.currentSet || 1,
            competitionName: stateData.title || stateData.competitionName || saved.competitionName || null,
            matchNo: stateData.matchNumber || stateData.matchNo || saved.matchNo || null,
            gender: stateData.division || stateData.gender || saved.gender || null,
            category: stateData.category || saved.category || null,
            round: stateData.phase || stateData.round || saved.round || null,
            pool: stateData.pool || saved.pool || null,
            matchId: matchId || saved.matchId || null
        };
    });
    // ==========================================
    const matchDataRef = useRef(null);
    useEffect(() => {
        matchDataRef.current = matchData;
    }, [matchData]);
    // LOCAL STORAGE STATES (ป้องกันข้อมูลหายเมื่อ Refresh)
    // ==========================================

    // --- STATES ---
    const [isLoading, setIsLoading] = useState(true);
    const isFinishingSetRef = useRef(false);

    // 1. คะแนนปัจจุบัน (Score)
    const [score, setScore] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_score`);
        return saved ? JSON.parse(saved) : { home: 0, away: 0 };
    });
    // 2. ขั้นตอนการทำงาน (Workflow Step) เพื่อไม่ให้เด้งกลับไปหน้า Roster ใหม่
    const [workflowStep, setWorkflowStep] = useState(() => {
        // ดึง workflowStep จาก localStorage เพื่อรักษาสถานะเมื่อรีเฟรช
        const saved = localStorage.getItem(`match_${matchId}_workflowStep`);
        return saved ? JSON.parse(saved) : 'LINEUP';
    });
    // 3. ทีมที่ได้สิทธิ์เสิร์ฟ และ ฝั่งสนาม (ซ้าย-ขวา)
    const [servingTeam, setServingTeam] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_servingTeam`);
        return saved ? JSON.parse(saved) : null;
    });
    const [isHomeLeft, setIsHomeLeft] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_isHomeLeft`);
        return saved ? JSON.parse(saved) : true;
    });
    // 4. โควต้าการขอเวลานอก (Timeouts)
    const [timeouts, setTimeouts] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_timeouts`);
        return saved ? JSON.parse(saved) : { home: 0, away: 0 };
    });
    // 5. โควต้าชาเลนจ์ (Challenges) (ปกติได้เซตละ 2 ครั้ง)
    const [challenges, setChallenges] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_challenges`);
        return saved ? JSON.parse(saved) : { home: 2, away: 2 };
    });
    // 6. ลิเบอโร่ (Liberos)
    const [homeLiberos, setHomeLiberos] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_homeLiberos`);
        return saved ? JSON.parse(saved) : { l1: null, l2: null };
    });
    const [awayLiberos, setAwayLiberos] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_awayLiberos`);
        return saved ? JSON.parse(saved) : { l1: null, l2: null };
    });
    // 7. ประวัติเหตุการณ์ (Match Events Log)
    const [matchEvents, setMatchEvents] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_matchEvents`);
        return saved ? JSON.parse(saved) : [];
    });
    // 8. ประวัติการเปลี่ยนตัว Libero (แยกจากโควต้าเปลี่ยนตัวปกติ)
    const [liberoTracker, setLiberoTracker] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_liberoTracker`);
        return saved ? JSON.parse(saved) : {
            home: { onCourt: false, activeLibero: null, replacedPlayer: null, posIndex: null },
            away: { onCourt: false, activeLibero: null, replacedPlayer: null, posIndex: null }
        };
    });

    const [setsWon, setSetsWon] = useState(() => loadState('setsWon', { home: 0, away: 0 }));
    const [completedSets, setCompletedSets] = useState(() => loadState('completedSets', []));
    const [substitutions, setSubstitutions] = useState(() => loadState('substitutions', { home: 0, away: 0 }));

    // Lineup State
    const [homeLineup, setHomeLineup] = useState(() => loadState('homeLineup', Array(6).fill(null)));
    const [awayLineup, setAwayLineup] = useState(() => loadState('awayLineup', Array(6).fill(null)));
    const [lastSetHomeLineup, setLastSetHomeLineup] = useState(() => loadState('lastSetHomeLineup', null));
    const [lastSetAwayLineup, setLastSetAwayLineup] = useState(() => loadState('lastSetAwayLineup', null));

    // Libero State
    const [lastSetHomeLiberos, setLastSetHomeLiberos] = useState(() => loadState('lastSetHomeLiberos', null));
    const [lastSetAwayLiberos, setLastSetAwayLiberos] = useState(() => loadState('lastSetAwayLiberos', null));
    const [teamColors, setTeamColors] = useState(() => loadState('teamColors', { home: '#d6d6d8ff', away: '#d6d6d8ff' }));

    // Signatures
    const [matchSignatures, setMatchSignatures] = useState(() => loadState('matchSignatures', {
        homeCoach: null, homeCaptain: null, awayCoach: null, awayCaptain: null,
        referee2: null, referee1: null
    }));

    // Referees Info
    const [referees, setReferees] = useState(() => loadState('referees', {
        firstReferee: '',
        secondReferee: '',
        scorer: '',
        asstScorer: '',
        lineJudges: ['', '', '', '']
    }));

    // New State: Track Libero Swaps (Index -> Original Player)
    const [homeLiberoSwaps, setHomeLiberoSwaps] = useState(() => loadState('homeLiberoSwaps', {}));
    const [awayLiberoSwaps, setAwayLiberoSwaps] = useState(() => loadState('awayLiberoSwaps', {}));
    const [firstServeSet1, setFirstServeSet1] = useState(() => loadState('firstServeSet1', null));

    // History & Logs
    const [history, setHistory] = useState(() => loadState('history', []));
    const [pendingRequests, setPendingRequests] = useState([]);
    // Video Challenge states for custom popup & review
    const [activeChallengeRequest, setActiveChallengeRequest] = useState(null);
    const [showChallengeRequestPopup, setShowChallengeRequestPopup] = useState(false);
    const [postponedChallengeIds, setPostponedChallengeIds] = useState(() => loadState('postponedChallengeIds', []));
    const [challengeConfirmMode, setChallengeConfirmMode] = useState(false);
    const [currentChallengeReview, setCurrentChallengeReview] = useState(() => loadState('currentChallengeReview', null));
    const [isEditingChallengeReason, setIsEditingChallengeReason] = useState(false);

    const [popupTimeLeft, setPopupTimeLeft] = useState(7);
    const [isChallengeExpired, setIsChallengeExpired] = useState(false);

    // Limits & Quotas

    // Modals Control State
    const [showLineupModal, setShowLineupModal] = useState(false);
    const [showMatchLogModal, setShowMatchLogModal] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [mobilePanelTeam, setMobilePanelTeam] = useState(null);
    const [showPostMatchSignatures, setShowPostMatchSignatures] = useState(false);
    const [showPostMatchVerify, setShowPostMatchVerify] = useState(false);
    const [showCoinTossModal, setShowCoinTossModal] = useState(false);
    const [showLiberoSwapModal, setShowLiberoSwapModal] = useState(false);
    const [liberoSwapTeam, setLiberoSwapTeam] = useState(null);

    const [showPlayerPicker, setShowPlayerPicker] = useState(false);
    const [pickerContext, setPickerContext] = useState({ team: 'home', posIndex: null });

    const [showSanctionModal, setShowSanctionModal] = useState(false);
    const [sanctionTeam, setSanctionTeam] = useState(null);

    const [showChallengeModal, setShowChallengeModal] = useState(false);
    const [challengeData, setChallengeData] = useState({ team: null });

    const [showTimeoutTimer, setShowTimeoutTimer] = useState(false);
    const [timeoutStartTime, setTimeoutStartTime] = useState(null);

    const [pendingSetWinner, setPendingSetWinner] = useState(null);
    const [showManualEditModal, setShowManualEditModal] = useState(false);

    // Settings
    const [setsToWin, setSetsToWin] = useState(() => loadState('setsToWin', 3));

    // Roster Data
    const [masterHomeRoster, setMasterHomeRoster] = useState([]);
    const [masterAwayRoster, setMasterAwayRoster] = useState([]);
    const [homeRoster, setHomeRoster] = useState(() => loadState('homeRoster', []));
    const [awayRoster, setAwayRoster] = useState(() => loadState('awayRoster', []));
    // ป้องกัน PreMatchSetupModal เปิดก่อน roster โหลดเสร็จ
    const [isRosterReady, setIsRosterReady] = useState(false);

    // --- REFRESH ROSTER FROM BACKEND ---
    const refreshRoster = useCallback(async (hId, aId) => {
        const homeId = hId || matchDataRef.current?.teamHomeId;
        const awayId = aId || matchDataRef.current?.teamAwayId;
        if (!homeId && !awayId) return;

        try {
            const [resHome, resAway] = await Promise.all([
                homeId ? api.getPlayersByTeam(homeId) : Promise.resolve({ data: [] }),
                awayId ? api.getPlayersByTeam(awayId) : Promise.resolve({ data: [] })
            ]);

            // Helper to map DB player format to components' expected format
            const mapPlayerFields = (p) => {
                const isCap = p.is_captain === true || p.isCaptain === true || p.role === 'C' || p.role === 'L1+C' || p.role === 'L2+C';
                const isLib = isPlayerLibero(p);
                let role = p.role || '';
                if (!role) {
                    if (p.is_libero1) role = isCap ? 'L1+C' : 'L1';
                    else if (p.is_libero2) role = isCap ? 'L2+C' : 'L2';
                    else if (isLib) role = isCap ? 'L1+C' : 'L1';
                    else if (isCap) role = 'C';
                }
                return {
                    ...p,
                    isCaptain: isCap,
                    isLibero: isLib,
                    role: role
                };
            };

            const mappedHomeMaster = (resHome.data || []).map(mapPlayerFields);
            const mappedAwayMaster = (resAway.data || []).map(mapPlayerFields);

            setMasterHomeRoster(mappedHomeMaster);
            setMasterAwayRoster(mappedAwayMaster);

            let activeHomeRoster = [];
            let activeAwayRoster = [];
            let matchRosterData = null;

            try {
                const rosterRes = await api.getMatchRosterData(matchId);
                matchRosterData = rosterRes.data;
            } catch (err) {
                console.warn("Failed to fetch match roster data:", err);
            }

            if (matchRosterData) {
                const homePlayers = matchRosterData.home?.players || matchRosterData.homeRoster || [];
                const awayPlayers = matchRosterData.away?.players || matchRosterData.awayRoster || [];

                activeHomeRoster = homePlayers
                    .filter(p => p.is_playing !== false)
                    .map(mapPlayerFields);

                activeAwayRoster = awayPlayers
                    .filter(p => p.is_playing !== false)
                    .map(mapPlayerFields);
            } else {
                activeHomeRoster = mappedHomeMaster.filter(p => p.is_playing !== false);
                activeAwayRoster = mappedAwayMaster.filter(p => p.is_playing !== false);
            }

            setHomeRoster(activeHomeRoster);
            setAwayRoster(activeAwayRoster);

            localStorage.setItem(`match_${matchId}_homeRoster`, JSON.stringify(activeHomeRoster));
            localStorage.setItem(`match_${matchId}_awayRoster`, JSON.stringify(activeAwayRoster));
        } catch (err) {
            console.error("Error refreshing roster:", err);
        }
    }, [matchId]);

    // Timer
    const [matchDuration, setMatchDuration] = useState(() => loadState('matchDuration', 0));
    const [isTimerRunning, setIsTimerRunning] = useState(() => loadState('isTimerRunning', false));

    // Substitution Context
    const [subData, setSubData] = useState({
        isOpen: false,
        team: null,
        posIndex: null,
        playerOut: null,
        isExceptional: false
    });

    const [subTracker, setSubTracker] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_subTracker`);
        return saved ? JSON.parse(saved) : {
            home: { count: 0, positions: {}, usedPlayers: [] },
            away: { count: 0, positions: {}, usedPlayers: [] }
        };
    });
    const [lastLiberoSwap, setLastLiberoSwap] = useState(() => loadState('lastLiberoSwap', null));

    const [activeHistoryTab, setActiveHistoryTab] = useState(1);
    const [isSyncing, setIsSyncing] = useState(false);
    const [queueCount, setQueueCount] = useState(EventQueue.getQueue().length);

    // --- BUTTON CLASS HELPER ---

    // --- EFFECT: TIMER ---
    useEffect(() => {
        let interval;
        if (isTimerRunning) {
            interval = setInterval(() => setMatchDuration(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    // --- EFFECT: SYNC HISTORY TAB ---
    useEffect(() => {
        setActiveHistoryTab(matchData.currentSet);
    }, [matchData.currentSet]);

    // --- EFFECT: SOCKET.IO FOR STAFF REQUESTS ---
    useEffect(() => {
        // เชื่อมต่อกับ Socket Server (ใช้ URL เดียวกับ API)
        const socketUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        const socket = io(socketUrl);

        // เข้าร่วม Room ของแมตช์นี้เมื่อเชื่อมต่อหรือเชื่อมต่อใหม่
        socket.on('connect', () => {
            socket.emit('join_match', { matchId, role: 'scorer' });
        });

        if (socket.connected) {
            socket.emit('join_match', { matchId, role: 'scorer' });
        }

        // ดึงข้อมูลเริ่มต้น (Initial Fetch) เพื่อกันกรณีตกหล่น
        client.get(`/match/${matchId}/requests/pending`).then(res => {
            setPendingRequests(res.data || []);
        });

        // ฟังเหตุการณ์อัปเดตสถานะการเชื่อมต่อของทีม
        socket.on('connection_status_update', (statuses) => {
            setStaffConnections(statuses.staff || { home: false, away: false });
        });

        // ฟังเหตุการณ์เมื่อมีคำขอใหม่
        socket.on('new_staff_request', (request) => {
            setPendingRequests(prev => {
                // ตรวจสอบว่าไม่มี ID ซ้ำใน List
                if (prev.find(r => r.id === request.id)) return prev;

                // เล่นเสียงแจ้งเตือน
                const audio = new Audio('/sounds/notification.mp3');
                audio.play().catch(() => { });

                return [...prev, request];
            });
        });

        // ฟังเหตุการณ์เมื่อทีมสตาฟฟ์อัปเดตรายละเอียดคำขอชาเลนจ์
        socket.on('request_updated', (updatedReq) => {
            setPendingRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
        });

        // ฟังเหตุการณ์เมื่อคำขอถูกจัดการแล้ว (จากเครื่องอื่น)
        socket.on('request_processed', (data) => {
            setPendingRequests(prev => prev.filter(r => r.id !== data.id));
        });

        // ฟังเหตุการณ์เมื่อทีมสตาฟฟ์อัปเดต Roster ในแมตช์
        socket.on('roster_updated', () => {
            refreshRoster();
        });

        return () => {
            socket.off('new_staff_request');
            socket.off('request_updated');
            socket.off('request_processed');
            socket.off('roster_updated');
            socket.off('connection_status_update');
            socket.disconnect();
        };
    }, [matchId, refreshRoster]);



    // --- EFFECT: BACKGROUND SYNC WORKER ---
    useEffect(() => {
        let isWorkerActive = true;

        const syncQueue = async () => {
            const nextEvent = EventQueue.peek();
            if (!nextEvent || isSyncing) {
                setQueueCount(EventQueue.getQueue().length);
                return;
            }

            setIsSyncing(true);
            try {
                EventQueue.markSyncing(nextEvent.localId);

                // Try to send to backend
                await client.post(`/scorer/match/${nextEvent.matchId}/event`, {
                    set_number: nextEvent.details.set_number,
                    event_type: nextEvent.type,
                    team_id: nextEvent.details.team_id,
                    score_home: nextEvent.details.score_home,
                    score_away: nextEvent.details.score_away,
                    ...nextEvent.details
                });

                // Success -> Remove from queue
                EventQueue.remove(nextEvent.localId);
            } catch (error) {
                console.error("Sync failed for event:", nextEvent.localId, error);
                EventQueue.fail(nextEvent.localId);
            } finally {
                setIsSyncing(false);
                setQueueCount(EventQueue.getQueue().length);
            }
        };

        const interval = setInterval(() => {
            if (isWorkerActive) syncQueue();
        }, 3000); // Check every 3 seconds

        return () => {
            isWorkerActive = false;
            clearInterval(interval);
        };
    }, [isSyncing, matchId]);

    const debounceTimeoutRef = useRef(null);

    // --- EFFECT: SAVE STATE ---
    useEffect(() => {
        // ถ้าแมตช์จบแล้ว ไม่ควรเขียนข้อมูลทับอีกเพื่อป้องกันการสูญหายของลายเซ็นและข้อมูลอื่น
        if (matchData?.status === 'completed') {
            return;
        }

        // Debounce to prevent spamming the server on rapid state changes
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            const stateForLocalStorage = {
                matchData, workflowStep, score, setsWon, completedSets,
                timeouts, challenges, substitutions, matchEvents, servingTeam, isHomeLeft,
                homeRoster, awayRoster, homeLineup, awayLineup, homeLiberos, awayLiberos,
                history, setsToWin, matchDuration, isTimerRunning, lastLiberoSwap, teamColors,
                homeLiberoSwaps, awayLiberoSwaps, showTimeoutTimer, timeoutStartTime, subTracker,
                matchSignatures, referees, postponedChallengeIds, currentChallengeReview, firstServeSet1
            };

            // 1. Save to localStorage for local persistence on refresh
            Object.entries(stateForLocalStorage).forEach(([key, value]) => {
                localStorage.setItem(`match_${matchId}_${key}`, JSON.stringify(value));
            });

            // 2. Save to backend for real-time sync with other devices
            // Create a smaller object for the live state to avoid sending large data like 'history'
            const liveStateForServer = {
                matchData,
                workflowStep,
                score,
                setsWon,
                timeouts,
                challenges,
                substitutions,
                servingTeam,
                isHomeLeft,
                homeRoster,
                awayRoster,
                homeLineup,
                awayLineup,
                homeLiberos,
                awayLiberos,
                homeLiberoSwaps,
                awayLiberoSwaps,
                teamColors,
                showTimeoutTimer,
                timeoutStartTime,
                matchDuration,
                isTimerRunning,
                subTracker,
                referees,
                matchSignatures,
                currentChallengeReview,
                firstServeSet1
            };
            api.updateLiveState(matchId, liveStateForServer).catch(err => {
                console.error("Failed to sync state to server:", err);
            });
        }, 500); // 500ms debounce delay

        return () => {
            clearTimeout(debounceTimeoutRef.current);
        };
    }, [matchId, matchData, workflowStep, score, setsWon, completedSets, timeouts, challenges, substitutions, matchEvents, servingTeam, isHomeLeft, homeRoster, awayRoster, homeLineup, awayLineup, homeLiberos, awayLiberos, history, setsToWin, matchDuration, isTimerRunning, homeLiberoSwaps, awayLiberoSwaps, lastLiberoSwap, teamColors, showTimeoutTimer, timeoutStartTime, subTracker, matchSignatures, referees, postponedChallengeIds, currentChallengeReview, firstServeSet1]);

    // เก็บ ID ผู้เล่นที่ถูกเปลี่ยนตัวออกด้วยกรณีพิเศษ (บาดเจ็บ/ให้ออก) ห้ามลงเล่นทั้งนัด
    const [disqualifiedPlayers, setDisqualifiedPlayers] = useState(() => {
        const saved = localStorage.getItem(`match_${matchId}_disqualified`);
        return saved ? JSON.parse(saved) : { home: [], away: [] };
    });

    const [staffConnections, setStaffConnections] = useState({ home: false, away: false });

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_matchData`, JSON.stringify(matchData));
    }, [matchData, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_disqualified`, JSON.stringify(disqualifiedPlayers));
    }, [disqualifiedPlayers, matchId]);
    // ==========================================
    // AUTO-SAVE TO LOCAL STORAGE
    // ==========================================

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_score`, JSON.stringify(score));
    }, [score, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_workflowStep`, JSON.stringify(workflowStep));
    }, [workflowStep, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_servingTeam`, JSON.stringify(servingTeam));
        localStorage.setItem(`match_${matchId}_isHomeLeft`, JSON.stringify(isHomeLeft));
    }, [servingTeam, isHomeLeft, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_firstServeSet1`, JSON.stringify(firstServeSet1));
    }, [firstServeSet1, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_timeouts`, JSON.stringify(timeouts));
        localStorage.setItem(`match_${matchId}_challenges`, JSON.stringify(challenges));
    }, [timeouts, challenges, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_homeLiberos`, JSON.stringify(homeLiberos));
        localStorage.setItem(`match_${matchId}_awayLiberos`, JSON.stringify(awayLiberos));
    }, [homeLiberos, awayLiberos, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_matchEvents`, JSON.stringify(matchEvents));
    }, [matchEvents, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_liberoTracker`, JSON.stringify(liberoTracker));
    }, [liberoTracker, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_matchSignatures`, JSON.stringify(matchSignatures));
    }, [matchSignatures, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_subTracker`, JSON.stringify(subTracker));
    }, [subTracker, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_homeRoster`, JSON.stringify(homeRoster));
        localStorage.setItem(`match_${matchId}_awayRoster`, JSON.stringify(awayRoster));
    }, [homeRoster, awayRoster, matchId]);

    useEffect(() => {
        localStorage.setItem(`match_${matchId}_lastSetHomeLineup`, JSON.stringify(lastSetHomeLineup));
        localStorage.setItem(`match_${matchId}_lastSetAwayLineup`, JSON.stringify(lastSetAwayLineup));
        localStorage.setItem(`match_${matchId}_lastSetHomeLiberos`, JSON.stringify(lastSetHomeLiberos));
        localStorage.setItem(`match_${matchId}_lastSetAwayLiberos`, JSON.stringify(lastSetAwayLiberos));
    }, [lastSetHomeLineup, lastSetAwayLineup, lastSetHomeLiberos, lastSetAwayLiberos, matchId]);



    // --- LOAD DATA ---
    useEffect(() => {
        const fetchMatchData = async () => {
            try {
                setIsLoading(true);
                let currentMatch = matchDataRef.current;

                // 1. ยิง API ดึงข้อมูลแมตช์เสมอ เพื่อเอา max_sets ที่ถูกต้องชัวร์ๆ
                const resMatch = await api.getMatchById(matchId);
                const m = resMatch.data;

                // คำนวณระบบการแข่งขัน (เช่น 3/2 = 2, 5/2 = 3)
                const maxSets = m.max_sets || 5;
                const calculatedSetsToWin = Math.ceil(maxSets / 2);

                // 1. ดึงชื่อรายการแข่งขัน (พยายามหาจากหลายๆ ฟิลด์)
                let competitionName = m.competition_title || m.competition?.title || m.competition_name || m.title || matchDataRef.current?.competitionName;

                // 2. ถ้ายังไม่มีชื่อรายการ แต่มี competition_id ให้ลองไปดึงจากรายการทั้งหมด
                if (!competitionName && m.competition_id) {
                    try {
                        const compsRes = await api.getOpenCompetitions();
                        const targetComp = compsRes.data.find(c => c.id === m.competition_id);
                        if (targetComp) {
                            competitionName = targetComp.competition_title || targetComp.title;
                        }
                    } catch (err) {
                        console.warn("Failed to fetch competition details from ID:", err);
                    }
                }

                currentMatch = {
                    ...matchDataRef.current,
                    teamHome: m.home_team_name || m.home_team || matchDataRef.current?.teamHome,
                    teamAway: m.away_team_name || m.away_team || matchDataRef.current?.teamAway,
                    teamHomeCode: m.home_team_code || matchDataRef.current?.teamHomeCode || null,
                    teamAwayCode: m.away_team_code || matchDataRef.current?.teamAwayCode || null,
                    teamHomeId: m.home_team_id || matchDataRef.current?.teamHomeId,
                    teamAwayId: m.away_team_id || matchDataRef.current?.teamAwayId,
                    currentSet: m.current_set || matchDataRef.current?.currentSet || 1,
                    maxSets: maxSets,
                    matchId: matchId,
                    competitionName: competitionName,
                    matchNo: m.match_number || m.matchNo || matchDataRef.current?.matchNo,
                    gender: m.gender || matchDataRef.current?.gender,
                    category: m.category_name || m.category || matchDataRef.current?.category,
                    round: m.round_name || m.round || matchDataRef.current?.round,
                    pool: m.pool_name || m.pool || matchDataRef.current?.pool,
                    city: m.city,
                    hall: m.location || m.stadium_name,
                    countryCode: m.country,
                    startTime: m.start_time,
                    matchDate: m.match_date || m.start_date,
                    status: m.status || matchDataRef.current?.status
                };

                setMatchData(currentMatch);
                setSetsToWin(calculatedSetsToWin);

                if (m.first_serve_team_id) {
                    const firstServeCode = String(m.first_serve_team_id) === String(m.home_team_id) ? 'home' : 'away';
                    setFirstServeSet1(firstServeCode);
                }

                // 2. ดึงรายชื่อผู้เล่นและแมตช์ Roster เมื่อได้ ID ทีมมาแล้ว
                await refreshRoster(currentMatch.teamHomeId, currentMatch.teamAwayId);

                // 1.5 ดึงข้อมูลผู้ตัดสินและบันทึก
                const fetchedReferees = {
                    referee_1_id: m.referee_1_id || '',
                    referee_2_id: m.referee_2_id || '',
                    scorer_id: m.scorer_id || '',
                    line_judge_1_id: m.line_judge_1_id || '',
                    line_judge_2_id: m.line_judge_2_id || '',
                    line_judge_3_id: m.line_judge_3_id || '',
                    line_judge_4_id: m.line_judge_4_id || '',
                    rr_name: m.rr_name || '',
                    rr_country: m.rr_country || '',
                    rr_code: m.rr_code || '',
                    rc_name: m.rc_name || '',
                    rc_country: m.rc_country || '',
                    rc_code: m.rc_code || '',
                    assistant_scorer_name: m.assistant_scorer_name || '',
                    assistant_scorer_country: m.assistant_scorer_country || '',
                    assistant_scorer_code: m.assistant_scorer_code || '',
                    td_name: m.td_name || '',
                    td_country: m.td_country || '',
                    td_code: m.td_code || '',
                    rd_name: m.rd_name || '',
                    rd_country: m.rd_country || '',
                    rd_code: m.rd_code || '',

                    firstReferee: m.r1_firstname ? `${m.r1_firstname} ${m.r1_lastname}` : '',
                    firstRefereeCountry: m.r1_country || '',
                    secondReferee: m.r2_firstname ? `${m.r2_firstname} ${m.r2_lastname}` : '',
                    secondRefereeCountry: m.r2_country || '',
                    scorer: m.scorer_firstname ? `${m.scorer_firstname} ${m.scorer_lastname}` : '',
                    scorerCountry: m.scorer_country || '',
                    asstScorer: m.assistant_scorer_name || '',
                    asstScorerCountry: m.assistant_scorer_country || '',
                    lineJudges: [
                        m.lj1_firstname ? `${m.lj1_firstname} ${m.lj1_lastname}` : '',
                        m.lj2_firstname ? `${m.lj2_firstname} ${m.lj2_lastname}` : '',
                        m.lj3_firstname ? `${m.lj3_firstname} ${m.lj3_lastname}` : '',
                        m.lj4_firstname ? `${m.lj4_firstname} ${m.lj4_lastname}` : ''
                    ],
                    lineJudgesCountry: [
                        m.lj1_country || '',
                        m.lj2_country || '',
                        m.lj3_country || '',
                        m.lj4_country || ''
                    ]
                };
                setReferees(fetchedReferees);

                // ✅ roster พร้อมแล้ว อนุญาตให้ PreMatchSetupModal แสดงได้
                setIsRosterReady(true);

                // ✅ ดึง Live State จาก Server เพื่อ Restore หลังรีเฟรช
                try {
                    const liveRes = await api.getLiveState(matchId);
                    const live = liveRes.data;
                    if (live && live.workflowStep && live.workflowStep !== 'LINEUP') {
                        // Restore ค่าสำคัญจาก server (server state มีความน่าเชื่อถือกว่า localStorage)
                        if (live.workflowStep) setWorkflowStep(live.workflowStep);
                        if (live.score) setScore(live.score);
                        if (live.setsWon) setSetsWon(live.setsWon);
                        if (live.servingTeam !== undefined) setServingTeam(live.servingTeam);
                        if (typeof live.isHomeLeft === 'boolean') setIsHomeLeft(live.isHomeLeft);
                        if (live.timeouts) setTimeouts(live.timeouts);
                        if (live.challenges) setChallenges(live.challenges);
                        if (live.substitutions) setSubstitutions(live.substitutions);
                        if (live.teamColors) setTeamColors(live.teamColors);
                        if (live.subTracker) setSubTracker(live.subTracker);
                        if (live.showTimeoutTimer !== undefined) setShowTimeoutTimer(live.showTimeoutTimer);
                        if (live.currentChallengeReview !== undefined) setCurrentChallengeReview(live.currentChallengeReview);
                        if (live.matchSignatures) setMatchSignatures(live.matchSignatures);
                        if (live.matchDuration) setMatchDuration(live.matchDuration);
                        if (live.firstServeSet1) setFirstServeSet1(live.firstServeSet1);

                        // Restore Lineups จาก server (สำคัญที่สุด — ป้องกัน CourtView ว่าง)
                        if (live.homeLineup && Array.isArray(live.homeLineup)) {
                            // map player objects ให้สมบูรณ์จาก roster ที่เพิ่งโหลด
                            const rosterHome = (await api.getPlayersByTeam(currentMatch.teamHomeId).catch(() => ({ data: [] }))).data || [];
                            const mapPlayerFields = (p) => {
                                if (!p) return null;
                                // ถ้ามีข้อมูลครบอยู่แล้ว ใช้เลย
                                if (p.number) return p;
                                // ถ้าเป็นแค่ ID ให้ไปหาจาก roster
                                const pid = p.id || p.player_id || p;
                                return rosterHome.find(r => String(r.id) === String(pid) || String(r.player_id) === String(pid)) || p;
                            };
                            const restoredHome = live.homeLineup.map(mapPlayerFields);
                            if (restoredHome.some(p => p && p.number)) setHomeLineup(restoredHome);
                        }
                        if (live.awayLineup && Array.isArray(live.awayLineup)) {
                            const rosterAway = (await api.getPlayersByTeam(currentMatch.teamAwayId).catch(() => ({ data: [] }))).data || [];
                            const mapPlayerFields = (p) => {
                                if (!p) return null;
                                if (p.number) return p;
                                const pid = p.id || p.player_id || p;
                                return rosterAway.find(r => String(r.id) === String(pid) || String(r.player_id) === String(pid)) || p;
                            };
                            const restoredAway = live.awayLineup.map(mapPlayerFields);
                            if (restoredAway.some(p => p && p.number)) setAwayLineup(restoredAway);
                        }

                        // Restore homeLiberos / awayLiberos
                        let restoredHomeLiberos = live.homeLiberos;
                        let restoredAwayLiberos = live.awayLiberos;

                        const savedHomeRosterStr = localStorage.getItem(`match_${matchId}_homeRoster`);
                        const savedAwayRosterStr = localStorage.getItem(`match_${matchId}_awayRoster`);

                        if (savedHomeRosterStr) {
                            try {
                                const savedHomeRoster = JSON.parse(savedHomeRosterStr);
                                if (!restoredHomeLiberos || (!restoredHomeLiberos.l1 && !restoredHomeLiberos.l2)) {
                                    const libs = savedHomeRoster.filter(isPlayerLibero);
                                    restoredHomeLiberos = { l1: libs[0] || null, l2: libs[1] || null };
                                }
                            } catch { /* ignore JSON parse errors from corrupted localStorage */ }
                        }

                        if (savedAwayRosterStr) {
                            try {
                                const savedAwayRoster = JSON.parse(savedAwayRosterStr);
                                if (!restoredAwayLiberos || (!restoredAwayLiberos.l1 && !restoredAwayLiberos.l2)) {
                                    const libs = savedAwayRoster.filter(isPlayerLibero);
                                    restoredAwayLiberos = { l1: libs[0] || null, l2: libs[1] || null };
                                }
                            } catch { /* ignore JSON parse errors from corrupted localStorage */ }
                        }

                        setHomeLiberos(restoredHomeLiberos || { l1: null, l2: null });
                        setAwayLiberos(restoredAwayLiberos || { l1: null, l2: null });
                        if (live.homeLiberoSwaps) setHomeLiberoSwaps(live.homeLiberoSwaps);
                        if (live.awayLiberoSwaps) setAwayLiberoSwaps(live.awayLiberoSwaps);

                        console.log('[ScorerConsole] ✅ Restored live state from server:', live.workflowStep);
                    }
                } catch (liveErr) {
                    console.warn('[ScorerConsole] ⚠️ Could not restore live state from server (using localStorage fallback):', liveErr.message);
                }

            } catch (error) {
                console.error("Error fetching match data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMatchData();
    }, [matchId, refreshRoster]);


    // --- API HELPER: SAVE EVENT (OFFLINE-FIRST) ---
    const saveEventToBackend = async (eventType, teamCode, details = {}, setNumberOverride = null) => {
        const currentScore = details.newScore || score;
        const teamId = teamCode === 'home' ? matchData.teamHomeId : matchData.teamAwayId;
        const currentSetNum = setNumberOverride !== null ? setNumberOverride : matchData.currentSet;

        // Push to local queue instead of direct API call
        const eventData = {
            matchId,
            type: eventType,
            details: {
                ...details,
                set_number: currentSetNum,
                team_id: teamId,
                score_home: currentScore.home,
                score_away: currentScore.away,
            },
            timestamp: new Date().toISOString()
        };

        EventQueue.push(eventData);
        setQueueCount(EventQueue.getQueue().length);

        let description = eventType;
        let metadata = null;
        const teamName = teamCode === 'home' ? matchData.teamHome : (teamCode === 'away' ? matchData.teamAway : '');

        if (eventType === 'POINT') {
            description = `Point ${teamName}`;
            metadata = { type: 'POINT', team: teamName, color: teamColors[teamCode] };
        }
        else if (eventType === 'TIMEOUT') {
            description = `Timeout ${teamName}`;
            metadata = { type: 'TIMEOUT', team: teamName, color: teamColors[teamCode] };
        }
        else if (eventType === 'CHALLENGE') {
            description = `Challenge ${teamName}`;
            metadata = { type: 'CHALLENGE', team: teamName, color: teamColors[teamCode] };
        }
        else if (eventType === 'SUBSTITUTION') {
            const roster = teamCode === 'home' ? homeRoster : awayRoster;
            const pIn = roster.find(p => p.id === details.player_id);
            const pOut = roster.find(p => p.id === details.details?.out);
            description = `Sub: IN #${pIn?.number || '?'} / OUT #${pOut?.number || '?'} (${teamName})`;
            metadata = {
                type: 'SUBSTITUTION',
                in: pIn?.number || '?',
                out: pOut?.number || '?',
                inName: pIn?.last_name || pIn?.name || '',
                outName: pOut?.last_name || pOut?.name || '',
                team: teamName,
                color: teamColors[teamCode]
            };
        } else if (eventType === 'SANCTION') {
            const roster = teamCode === 'home' ? homeRoster : awayRoster;
            const p = roster.find(p => p.id === details.player_id);
            const card = details.details?.card || 'Card';
            description = `${card} CARD for #${p?.number || '?'} (${teamName})`;
            metadata = {
                type: 'SANCTION',
                player: p?.number || '?',
                card,
                team: teamName,
                color: teamColors[teamCode]
            };
        } else if (eventType === 'LIBERO_REPLACEMENT') {
            const roster = teamCode === 'home' ? homeRoster : awayRoster;
            const pIn = roster.find(p => p.id === details.player_id);
            const pOut = roster.find(p => p.id === details.details?.out);
            description = `Libero: IN #${pIn?.number || '?'} / OUT #${pOut?.number || '?'} (${teamName})`;
            metadata = {
                type: 'LIBERO',
                in: pIn?.number || '?',
                out: pOut?.number || '?',
                inName: pIn?.last_name || pIn?.name || '',
                outName: pOut?.last_name || pOut?.name || '',
                team: teamName,
                color: teamColors[teamCode]
            };
        } else if (eventType === 'REPLAY_RALLY') {
            description = `Replay Rally (${teamName} served)`;
            metadata = { type: 'REPLAY_RALLY', team: teamName, color: teamColors[teamCode] };
        } else if (eventType === 'LIBERO_SWAP') {
            const d = details.details || {};
            const pIn = d.type === 'IN' ? d.libero : d.player;
            const pOut = d.type === 'IN' ? d.player : d.libero;
            description = `Libero Swap: IN #${pIn} / OUT #${pOut} (${teamName})`;
            metadata = {
                type: 'LIBERO',
                in: pIn,
                out: pOut,
                team: teamName
            };
        } else if (eventType === 'COIN_TOSS_WINNER') {
            description = `Coin Toss Winner: ${getTeamCode(teamName)}`;
            metadata = { type: 'COIN_TOSS_WINNER', team: teamName, color: teamColors[teamCode] };
        } else if (eventType === 'COURT_SIDE_LEFT') {
            description = `Court Side A (Left): ${getTeamCode(teamName)}`;
            metadata = { type: 'COURT_SIDE_LEFT', team: teamName, color: teamColors[teamCode] };
        } else if (eventType === 'FIRST_SERVE') {
            description = `First Serve: ${getTeamCode(teamName)}`;
            metadata = { type: 'FIRST_SERVE', team: teamName, color: teamColors[teamCode] };
        }

        const eventScore = teamCode === 'away'
            ? `${currentScore.away}-${currentScore.home}`
            : `${currentScore.home}-${currentScore.away}`;

        setMatchEvents(prev => [{
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            set: currentSetNum,
            score: eventScore,
            description,
            metadata,
            time: formatThaiFullDateTime(new Date()) // ใช้ระบบเวลาพ.ศ.ตามที่ผู้ใช้ต้องการ
        }, ...prev]);
    };

    const saveStateToHistory = () => {
        const currentState = {
            score: { ...score },
            setsWon: { ...setsWon },
            servingTeam,
            homeLineup: [...homeLineup],
            awayLineup: [...awayLineup],
            isHomeLeft,
            workflowStep,
            timeouts: { ...timeouts },
            challenges: { ...challenges },
            substitutions: { ...substitutions },
            matchEvents: [...matchEvents],
            homeLiberoSwaps: { ...homeLiberoSwaps },
            awayLiberoSwaps: { ...awayLiberoSwaps },
            subTracker: JSON.parse(JSON.stringify(subTracker)),
            liberoTracker: JSON.parse(JSON.stringify(liberoTracker))
        };
        setHistory(prev => [...prev, currentState]);
    };

    // --- CORE GAME LOGIC ---
    const rotateLineup = (currentLineup, teamCode) => {
        // Check P5 (index 4) moving to P4 (index 3)
        const p5 = currentLineup[4];

        // ดึงข้อมูลประวัติว่าใครคือตัวจริงที่ Libero ลงไปแทน (เพื่อเอาเบอร์มาโชว์ในป้าย IN)
        const currentSwaps = teamCode === 'home' ? homeLiberoSwaps : awayLiberoSwaps;
        const setSwaps = teamCode === 'home' ? setHomeLiberoSwaps : setAwayLiberoSwaps;

        let isLiberoExit = false;
        let originalPlayer = null;

        if (p5) {
            const liberos = teamCode === 'home' ? homeLiberos : awayLiberos;
            const isLibero = (p5.id === liberos.l1?.id || p5.id === liberos.l2?.id);

            if (isLibero) {
                originalPlayer = currentSwaps[4];
                const teamName = teamCode === 'home' ? matchData.teamHome : matchData.teamAway;

                if (originalPlayer) {
                    isLiberoExit = true;
                    // แสดงหน้าต่างกราฟิก Data Volley Style: "Libero exit the court"
                    Swal.fire({
                        html: `
                            <div style="text-align: left; font-size: 13px; color: #000; margin-top: -20px; margin-bottom: 15px;"></div>
                            <h2 style="color: #000080; font-size: 26px; font-weight: 900; margin: 0 0 30px 0;">${teamName}</h2>

                            <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
                                
                                <div style="display: flex; align-items: flex-start;">
                                    <div style="display: flex; align-items: center; margin-right: 10px; margin-top: 25px;">
                                        <svg width="24" height="45" viewBox="0 0 24 45">
                                            <path d="M12 0 L24 15 L16 15 L16 45 L8 45 L8 15 L0 15 Z" fill="#00b050" stroke="#000" stroke-width="1.5"/>
                                        </svg>
                                        <span style="font-size: 24px; font-weight: 900; color: #000; margin-left: 5px;">IN</span>
                                    </div>
                                    
                                    <div style="display: flex; flex-direction: column; align-items: center; margin-top: 35px;">
                                        <div style="background-color: #f58231; width: 170px; height: 25px; display: flex; align-items: center; justify-content: center;">
                                            <span style="color: #fff; font-size: 13px;">Player in Zone 4</span>
                                        </div>
                                        <div style="background-color: #f58231; width: 120px; height: 85px; display: flex; align-items: center; justify-content: center;">
                                            <span style="color: #fff; font-size: 60px; font-weight: 900; line-height: 1;">${originalPlayer.number}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style="margin: 0 5px; padding-top: 40px;">
                                    <svg width="45" height="24" viewBox="0 0 45 24">
                                        <path d="M0 8 L30 8 L30 0 L45 12 L30 24 L30 16 L0 16 Z" fill="#00b050" stroke="#000" stroke-width="1.5"/>
                                    </svg>
                                </div>

                                <div style="display: flex; align-items: flex-start;">
                                    <div style="display: flex; flex-direction: column; align-items: center; margin-top: 35px;">
                                        <div style="background-color: #ffff99; width: 170px; height: 25px; display: flex; align-items: center; justify-content: center;">
                                            <span style="color: #000080; font-size: 13px;">Libero</span>
                                        </div>
                                        <div style="background-color: #ffff99; width: 120px; height: 85px; display: flex; align-items: center; justify-content: center;">
                                            <span style="color: #000; font-size: 60px; font-weight: 900; line-height: 1;">${p5.number}</span>
                                        </div>
                                    </div>

                                    <div style="display: flex; align-items: center; margin-left: 10px; margin-top: 25px;">
                                        <span style="font-size: 24px; font-weight: 900; color: #000; margin-right: 5px;">OUT</span>
                                        <svg width="24" height="45" viewBox="0 0 24 45">
                                            <path d="M8 0 L16 0 L16 30 L24 30 L12 45 L0 30 L8 30 Z" fill="#ff0000" stroke="#000" stroke-width="1.5"/>
                                        </svg>
                                    </div>
                                </div>

                            </div>

                            <div style="margin-top: 40px; font-size: 16px; color: #000;">
                                Player n. ${originalPlayer.number} must replace the libero on the court
                            </div>
                        `,
                        width: 700,
                        showCloseButton: false,
                        showConfirmButton: true,
                        confirmButtonText: 'Ok',
                        confirmButtonColor: '#1d4ed8',
                        customClass: {
                            popup: 'rounded-sm border border-slate-300 shadow-xl',
                            confirmButton: 'w-64 font-bold text-lg rounded-sm',
                        }
                    });

                    // Auto-replace: Log the LIBERO_REPLACEMENT event
                    saveEventToBackend('LIBERO_REPLACEMENT', teamCode, {
                        player_id: originalPlayer.id,
                        details: { out: p5.id, isLiberoAction: true }
                    });

                    // Auto-replace: Update libero tracker
                    setLiberoTracker(prev => ({
                        ...prev,
                        [teamCode]: { onCourt: false, activeLibero: null, replacedPlayer: null, posIndex: null }
                    }));
                } else {
                    // (กรณีฉุกเฉิน) หาตัวผู้เล่นเดิมไม่เจอ จะโชว์แจ้งเตือนสั้นๆ แทน
                    Swal.fire({
                        title: 'Libero Rotation Warning',
                        text: `Libero #${p5.number} is rotating to the front row (P4). They must be replaced!`,
                        icon: 'warning',
                        timer: 5000,
                        toast: true,
                        position: 'top-end'
                    });
                }
            }
        }

        const newLineup = [...currentLineup];
        const p1 = newLineup.shift();
        newLineup.push(p1);

        if (isLiberoExit && originalPlayer) {
            // Replace Libero in Zone 4 (index 3 after rotation) with the original player
            newLineup[3] = originalPlayer;
        }

        if (Object.keys(currentSwaps).length > 0) {
            const newSwaps = {};
            Object.keys(currentSwaps).forEach(idx => {
                const i = parseInt(idx);
                // If Libero has exited from index 4 (now index 3), remove the swap
                if (isLiberoExit && originalPlayer && i === 4) {
                    return;
                }
                const newIdx = i === 0 ? 5 : i - 1;
                newSwaps[newIdx] = currentSwaps[i];
            });
            setSwaps(newSwaps);
        }

        // NOTE: subTracker and liberoTracker positions are now "STABLE" 
        // linked to player.originalPos, so we NO LONGER rotate their keys/indices.

        return newLineup;
    };

    const handlePoint = (winnerTeamCode) => {
        saveStateToHistory();
        const newScore = { ...score, [winnerTeamCode]: score[winnerTeamCode] + 1 };
        setScore(newScore);

        if (winnerTeamCode !== servingTeam) {
            setServingTeam(winnerTeamCode);
            if (winnerTeamCode === 'home') setHomeLineup(prev => rotateLineup(prev, 'home'));
            else setAwayLineup(prev => rotateLineup(prev, 'away'));
        }

        saveEventToBackend('POINT', winnerTeamCode, { newScore });

        // Check Set Winner
        const tieBreakSet = (setsToWin * 2) - 1;
        const isTieBreak = matchData.currentSet === tieBreakSet;
        const pointsToWin = isTieBreak ? 15 : 25;
        const winnerScore = newScore[winnerTeamCode];
        const loserScore = newScore[winnerTeamCode === 'home' ? 'away' : 'home'];

        // Check for court side switch in deciding set (when either team reaches 8 points first)
        if (isTieBreak && winnerScore === 8 && loserScore < 8) {
            setIsHomeLeft(prev => !prev);
            const teamName = winnerTeamCode === 'home' ? matchData.teamHome : matchData.teamAway;
            Swal.fire({
                title: 'เปลี่ยนแดน (Switch Sides)',
                html: `
                    <div style="font-size: 16px; margin-bottom: 10px;">
                        ทีม <strong>${teamName}</strong> ทำคะแนนถึง 8 แต้มก่อนในเซตตัดสิน
                    </div>
                    <div style="font-size: 20px; font-weight: bold; color: #0d54c7ff;">
                        เปลี่ยนฝั่งแดนการเล่น!
                    </div>
                    <div style="font-size: 14px; color: #64748b; margin-top: 10px;">
                        คะแนนปัจจุบัน: ${newScore.home} - ${newScore.away}
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#0d54c7ff',
                timer: 5000,
                timerProgressBar: true
            });
        }

        if (winnerScore >= pointsToWin && (winnerScore - loserScore) >= 2) {
            setPendingSetWinner({ winnerCode: winnerTeamCode, finalScore: newScore });
            setWorkflowStep('SET_ENDING');
        } else {
            setWorkflowStep('SERVING');
        }
    };

    const handleReplayRally = () => {
        saveEventToBackend('REPLAY_RALLY', servingTeam);
        setWorkflowStep('SERVING');
        Swal.fire({
            title: 'REPLAY RALLY',
            text: 'ผู้ตัดสินให้เล่นคะแนนใหม่ (Replay)',
            icon: 'info',
            timer: 2000,
            toast: true,
            position: 'top'
        });
    };

    const finishSet = async (winnerCode, finalScore) => {
        if (isFinishingSetRef.current) return;
        isFinishingSetRef.current = true;

        const payload = {
            setNumber: matchData.currentSet,
            homeScore: finalScore.home,
            awayScore: finalScore.away,
            duration: Math.ceil(matchDuration / 60)
        };

        try {
            const response = await api.endSet(matchId, payload);

            if (response.data.success) {
                // 1. ดึงข้อมูลจาก backend (แก้ชื่อให้ตรงเผื่อไว้ด้วย)

                // 2. คำนวณจำนวนเซตล่าสุดจากฝั่ง Frontend เอง (ปลอดภัยที่สุด)
                const newSetsWon = {
                    home: winnerCode === 'home' ? setsWon.home + 1 : setsWon.home,
                    away: winnerCode === 'away' ? setsWon.away + 1 : setsWon.away
                };

                setSetsWon(newSetsWon);
                setCompletedSets(prev => [...prev, {
                    set: matchData.currentSet,
                    home: finalScore.home,
                    away: finalScore.away,
                    winner: winnerCode
                }]);

                // Notify the winner
                const winnerName = winnerCode === 'home' ? matchData.teamHome : matchData.teamAway;
                Swal.fire({
                    title: `SET ${matchData.currentSet} FINISHED`,
                    html: `<div class="py-4"><span class="text-3xl font-black text-indigo-600 block mb-2">${winnerName}</span> <span class="text-slate-400 font-bold uppercase tracking-widest text-sm">WINS THE SET</span></div>`,
                    icon: 'success',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#0d54c7ff',
                    customClass: {
                        popup: 'rounded-3xl border-none shadow-2xl',
                        title: 'text-slate-400 font-black tracking-[0.2em] text-xs pt-8',
                        confirmButton: 'px-12 py-3 rounded-xl font-bold uppercase tracking-wider text-xs mb-4'
                    }
                });

                // 3. เช็คการจบแมตช์จาก setsToWin ของ Frontend เลย (ชัวร์ 100%)
                // ถ้าฝ่ายใดฝ่ายหนึ่งได้เซต >= ที่กำหนดไว้ (เช่น ได้ 2 เซต) ให้จบแมตช์ทันที
                if (newSetsWon.home >= setsToWin || newSetsWon.away >= setsToWin) {
                    setWorkflowStep('MATCH_FINISHED');
                    setIsTimerRunning(false);
                    // ถ้าคุณมีฟังก์ชันเรียกหน้าต่างสรุปผล ก็สามารถใส่ไว้ตรงนี้ได้ครับ
                } else {
                    // ถ้าเซตยังไม่ครบ ถึงให้เริ่มตั้งค่าเซตถัดไป
                    setWorkflowStep('SET_FINISHED');
                }
            }
        } catch (error) {
            console.error("Error ending set:", error);
            const errorMsg = error.response?.data?.error || 'ไม่สามารถบันทึกผลเซตลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
            Swal.fire('Error', errorMsg, 'error');
        } finally {
            isFinishingSetRef.current = false;
        }
    };

    const startNextSet = () => {
        // Reset scores and quotas for the new set
        setScore({ home: 0, away: 0 });
        setTimeouts({ home: 0, away: 0 });
        setChallenges({ home: 2, away: 2 });
        setSubstitutions({ home: 0, away: 0 });
        setSubTracker({ // Reset substitution tracker
            home: { count: 0, positions: {}, usedPlayers: [] },
            away: { count: 0, positions: {}, usedPlayers: [] }
        });
        setHomeLiberoSwaps({});
        setAwayLiberoSwaps({});
        setHistory([]);

        const nextSetNumber = matchData.currentSet + 1;

        // Add "Set Started" event to the cumulative match history
        setMatchEvents(prev => [{
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            set: nextSetNumber,
            score: `0-0`,
            description: `Set ${nextSetNumber} Started`,
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }, ...prev]);

        const isTieBreak = (setsWon?.home === setsToWin - 1) && (setsWon.away === setsToWin - 1);
        setMatchData(prev => ({ ...prev, currentSet: nextSetNumber }));

        if (!isTieBreak) setIsHomeLeft(prev => !prev);

        // Auto-fill from last set if available, otherwise clear
        setHomeLineup(lastSetHomeLineup ? [...lastSetHomeLineup] : Array(6).fill(null));
        setHomeLiberos(lastSetHomeLiberos ? { ...lastSetHomeLiberos } : { l1: null, l2: null });

        setAwayLineup(lastSetAwayLineup ? [...lastSetAwayLineup] : Array(6).fill(null));
        setAwayLiberos(lastSetAwayLiberos ? { ...lastSetAwayLiberos } : { l1: null, l2: null });

        if (isTieBreak) {
            setServingTeam(null);
            setWorkflowStep('COIN_TOSS');
        } else {
            setWorkflowStep('LINEUP');
            if (firstServeSet1) {
                const nextServingTeam = (nextSetNumber % 2 === 1) ? firstServeSet1 : (firstServeSet1 === 'home' ? 'away' : 'home');
                setServingTeam(nextServingTeam);
                saveEventToBackend('FIRST_SERVE', nextServingTeam, {}, nextSetNumber);
            } else if (servingTeam) {
                const nextServingTeam = servingTeam === 'home' ? 'away' : 'home';
                setServingTeam(nextServingTeam);
                saveEventToBackend('FIRST_SERVE', nextServingTeam, {}, nextSetNumber);
            }
            // Removed auto-popup as requested: setShowLineupModal(true);
        }
    };

    const handleUndo = () => {
        if (history.length === 0) return;

        Swal.fire({
            title: 'Confirm Undo?',
            text: "You want to undo the last action?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0d54c7ff',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, Undo',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                const lastState = history[history.length - 1];

                setScore(lastState.score);
                setSetsWon(lastState.setsWon);
                setServingTeam(lastState.servingTeam);
                setHomeLineup(lastState.homeLineup);
                setAwayLineup(lastState.awayLineup);
                setIsHomeLeft(lastState.isHomeLeft);

                if (lastState.workflowStep) setWorkflowStep(lastState.workflowStep);
                if (lastState.timeouts) setTimeouts(lastState.timeouts);
                if (lastState.challenges) setChallenges(lastState.challenges);
                if (lastState.substitutions) setSubstitutions(lastState.substitutions);
                if (lastState.matchEvents) setMatchEvents(lastState.matchEvents);
                if (lastState.homeLiberoSwaps) setHomeLiberoSwaps(lastState.homeLiberoSwaps);
                if (lastState.awayLiberoSwaps) setAwayLiberoSwaps(lastState.awayLiberoSwaps);

                if (lastState.subTracker) setSubTracker(lastState.subTracker);
                if (lastState.liberoTracker) setLiberoTracker(lastState.liberoTracker);

                setHistory(prev => prev.slice(0, -1));

                Swal.fire({
                    icon: 'success',
                    title: 'Undone',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        });
    };

    const handleStartMatch = async () => {
        const setNum = matchData.currentSet;
        try {
            await api.startSet(matchId, { setNumber: setNum });
        } catch (error) {
            console.error("Failed to save set start time:", error);
        }

        const startEvent = {
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            set: setNum,
            score: `0-0`,
            description: setNum === 1 ? `Match Started (Set 1)` : `Set ${setNum} Started`,
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        };

        setMatchEvents(prev => {
            const filtered = prev.filter(e => !(e.set === setNum && e.description.includes('Started')));
            return [startEvent, ...filtered];
        });

        setWorkflowStep('SERVING');
        setIsTimerRunning(true);
    };

    const handleFinishMatch = () => {
        setShowPostMatchVerify(true);
    };

    const handlePostMatchVerifyConfirm = async (data) => {
        setReferees(data.referees);
        setHomeRoster(data.confirmedHome);
        setAwayRoster(data.confirmedAway);
        setSetsToWin(data.setsToWin >= 2 ? data.setsToWin : 3);

        if (data.matchDetails) {
            setMatchData(prev => ({
                ...prev,
                matchNo: data.matchDetails.matchNo,
                round: data.matchDetails.round,
                pool: data.matchDetails.pool,
                city: data.matchDetails.city,
                hall: data.matchDetails.hall,
                countryCode: data.matchDetails.countryCode,
                maxSets: data.setsToWin ? data.setsToWin * 2 - 1 : 5
            }));
        }

        setShowPostMatchVerify(false);

        try {
            const payload = {
                referee_1_id: data.referees.referee_1_id || null,
                referee_2_id: data.referees.referee_2_id || null,
                scorer_id: data.referees.scorer_id || null,
                scorer_name: data.referees.scorer || null,
                scorer_country: data.referees.scorerCountry || null,
                scorer_code: data.referees.scorerCode || null,
                line_judge_1_id: data.referees.line_judge_1_id || null,
                line_judge_2_id: data.referees.line_judge_2_id || null,
                line_judge_3_id: data.referees.line_judge_3_id || null,
                line_judge_4_id: data.referees.line_judge_4_id || null,
                rr_name: data.referees.rr_name || null,
                rr_country: data.referees.rr_country || null,
                rr_code: data.referees.rr_code || null,
                rc_name: data.referees.rc_name || null,
                rc_country: data.referees.rc_country || null,
                rc_code: data.referees.rc_code || null,
                assistant_scorer_name: data.referees.assistant_scorer_name || null,
                assistant_scorer_country: data.referees.assistant_scorer_country || null,
                assistant_scorer_code: data.referees.assistant_scorer_code || null,
                td_name: data.referees.td_name || null,
                td_country: data.referees.td_country || null,
                td_code: data.referees.td_code || null,
                rd_name: data.referees.rd_name || null,
                rd_country: data.referees.rd_country || null,
                rd_code: data.referees.rd_code || null,

                // General match info fields (optionally editable by scorer in PreMatchSetupModal)
                match_number: data.matchDetails?.matchNo || null,
                pool_name: data.matchDetails?.pool || null,
                round_name: data.matchDetails?.round || null,
                city: data.matchDetails?.city || null,
                location: data.matchDetails?.hall || null,
                country: data.matchDetails?.countryCode || null,
                max_sets: data.setsToWin ? data.setsToWin * 2 - 1 : 5,
                has_challenge: data.matchDetails?.hasChallenge !== undefined ? data.matchDetails.hasChallenge : null
            };
            await api.updateMatchOfficials(matchId, payload);
        } catch (error) {
            console.error("Failed to update match officials:", error);
        }
        setShowPostMatchSignatures(true);
    };

    const handlePostMatchSignaturesConfirm = async (signaturesData) => {
        // 1. อัปเดต state ของ matchSignatures
        const finalSignatures = {
            ...matchSignatures,
            homeCaptain: signaturesData.homeCaptain,
            awayCaptain: signaturesData.awayCaptain,
            referee2: signaturesData.referee2,
            referee1: signaturesData.referee1
        };
        setMatchSignatures(finalSignatures);
        setShowPostMatchSignatures(false);

        // 2. บันทึก live state ล่าสุดไปยังเซิร์ฟเวอร์ทันที
        try {
            const liveStateForServer = {
                matchData,
                workflowStep,
                score,
                setsWon,
                timeouts,
                challenges,
                substitutions,
                servingTeam,
                isHomeLeft,
                homeRoster,
                awayRoster,
                homeLineup,
                awayLineup,
                homeLiberos,
                awayLiberos,
                homeLiberoSwaps,
                awayLiberoSwaps,
                teamColors,
                showTimeoutTimer,
                timeoutStartTime,
                matchDuration,
                isTimerRunning,
                subTracker,
                referees,
                matchSignatures: finalSignatures
            };
            await api.updateLiveState(matchId, liveStateForServer);
        } catch (error) {
            console.error("Failed to sync final signatures to server:", error);
        }

        // 3. เคลียร์ข้อมูลใน LocalStorage เพื่อเตรียมเริ่มแมตช์ถัดไป
        const keysToClear = [
            'matchData', 'workflowStep', 'score', 'setsWon', 'completedSets',
            'timeouts', 'challenges', 'substitutions', 'matchEvents', 'servingTeam',
            'isHomeLeft', 'homeRoster', 'awayRoster', 'homeLineup', 'awayLineup',
            'homeLiberos', 'awayLiberos', 'history', 'setsToWin', 'matchDuration',
            'isTimerRunning', 'lastLiberoSwap', 'teamColors', 'homeLiberoSwaps',
            'awayLiberoSwaps', 'liberoTracker', 'disqualified', 'tossWinner',
            'matchSignatures', 'referees', 'firstServeSet1'
        ];

        keysToClear.forEach(key => {
            localStorage.removeItem(`match_${matchId}_${key}`);
        });

        // 4. กลับสู่หน้าหลักตามสิทธิ์การใช้งาน (Role)
        const userStr = localStorage.getItem('user');
        let role = 'admin';
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                role = user.role;
            } catch { /* ignore JSON parse errors for user role */ }
        }
        if (role === 'score') {
            navigate('/adminscorer');
        } else {
            navigate('/admin');
        }
    };

    // --- CONFIRM HANDLERS ---
    const handleCoinTossConfirm = async (data) => {
        setShowCoinTossModal(false);
        // 1. อัปเดต State ในหน้าจอตามปกติ
        setTeamColors(data.colors);
        setServingTeam(data.servingTeam);
        if (matchData.currentSet === 1) {
            setFirstServeSet1(data.servingTeam);
        }
        if (data.tossWinner) {
            localStorage.setItem(`match_${matchId}_tossWinner`, data.tossWinner);
        }
        if (typeof data.isHomeLeft === 'boolean') {
            setIsHomeLeft(data.isHomeLeft);
        }

        // 1.5. บันทึกประวัติ Coin Toss ลง Match History
        if (data.tossWinner) {
            await saveEventToBackend('COIN_TOSS_WINNER', data.tossWinner);
        }
        if (typeof data.isHomeLeft === 'boolean') {
            await saveEventToBackend('COURT_SIDE_LEFT', data.isHomeLeft ? 'home' : 'away');
        }
        if (data.servingTeam) {
            await saveEventToBackend('FIRST_SERVE', data.servingTeam);
        }

        // 2. บันทึกผลเสี่ยงทายลงฐานข้อมูล (เฉพาะเซต 1 เพื่อใช้กำหนด Team A/B ใน Scoresheet)
        if (matchData.currentSet === 1) {
            try {
                // หา ID ของทีมที่ได้เสิร์ฟก่อน (เช็คจากค่า string 'home' หรือ 'away')
                const firstServeId = data.servingTeam === 'home' ? matchData.teamHomeId : matchData.teamAwayId;
                // หา ID ของทีมที่อยู่ด้านซ้าย
                const leftSideId = data.isHomeLeft ? matchData.teamHomeId : matchData.teamAwayId;

                // ยิง API ไปบันทึกในตาราง matches
                await api.saveCoinToss(matchId, {
                    first_serve_team_id: firstServeId,
                    left_side_team_id: leftSideId
                });

                console.log("Coin toss saved to database.");
            } catch (error) {
                console.error("Failed to save toss:", error);
                // Swal.fire('Error', 'Failed to save coin toss to database.', 'error'); // (ใส่แจ้งเตือนเพิ่มได้ถ้าต้องการ)
            }
        }

        // 3. ไปยังขั้นตอนถัดไป
        const isTieBreak = matchData.currentSet > 1;
        Swal.fire({
            title: 'Coin Toss',
            text: isTieBreak
                ? 'Starting Lineup  Select Players and Substitutions'
                : 'Ready to Play',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: isTieBreak ? '#0d54c7ff' : '#10b981',
            allowOutsideClick: false
        }).then(() => {
            if (isTieBreak) {
                setWorkflowStep('LINEUP');
                setShowLineupModal(true);
            } else {
                setWorkflowStep('READY');
            }
        });
    };

    const handleSignaturesConfirm = async (data) => {
        setMatchSignatures(data);

        // บันทึกลายเซ็นลงฐานข้อมูลทันที
        try {
            const liveStateForServer = {
                matchData,
                workflowStep: 'SIGNATURES', // or current
                score,
                setsWon,
                timeouts,
                challenges,
                substitutions,
                servingTeam,
                isHomeLeft,
                homeRoster,
                awayRoster,
                homeLineup,
                awayLineup,
                homeLiberos,
                awayLiberos,
                homeLiberoSwaps,
                awayLiberoSwaps,
                teamColors,
                showTimeoutTimer,
                timeoutStartTime,
                matchDuration,
                isTimerRunning,
                subTracker,
                referees,
                matchSignatures: data // use new data
            };
            await api.updateLiveState(matchId, liveStateForServer);
        } catch (error) {
            console.error("Failed to sync signatures to DB:", error);
        }

        Swal.fire({
            title: 'Starting Lineup',
            text: 'Select Players and Substitutions',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: '#0d54c7ff',
            allowOutsideClick: false
        }).then(() => {
            setWorkflowStep('LINEUP');
            setShowLineupModal(true);
        });
    };

    const handleSetupConfirm = async (data) => {
        const setsNeeded = parseInt(data.setsToWin, 10);
        setSetsToWin(setsNeeded >= 2 ? setsNeeded : 3);
        setHomeRoster(data.confirmedHome);
        setAwayRoster(data.confirmedAway);
        setReferees(data.referees);

        try {
            const payload = {
                referee_1_id: data.referees.referee_1_id || null,
                referee_2_id: data.referees.referee_2_id || null,
                scorer_id: data.referees.scorer_id || null,
                scorer_name: data.referees.scorer || null,
                scorer_country: data.referees.scorerCountry || null,
                scorer_code: data.referees.scorerCode || null,
                line_judge_1_id: data.referees.line_judge_1_id || null,
                line_judge_2_id: data.referees.line_judge_2_id || null,
                line_judge_3_id: data.referees.line_judge_3_id || null,
                line_judge_4_id: data.referees.line_judge_4_id || null,
                rr_name: data.referees.rr_name || null,
                rr_country: data.referees.rr_country || null,
                rr_code: data.referees.rr_code || null,
                rc_name: data.referees.rc_name || null,
                rc_country: data.referees.rc_country || null,
                rc_code: data.referees.rc_code || null,
                assistant_scorer_name: data.referees.assistant_scorer_name || null,
                assistant_scorer_country: data.referees.assistant_scorer_country || null,
                assistant_scorer_code: data.referees.assistant_scorer_code || null,
                td_name: data.referees.td_name || null,
                td_country: data.referees.td_country || null,
                td_code: data.referees.td_code || null,
                rd_name: data.referees.rd_name || null,
                rd_country: data.referees.rd_country || null,
                rd_code: data.referees.rd_code || null,
                match_number: data.matchDetails?.matchNo || null,
                pool_name: data.matchDetails?.pool || null,
                round_name: data.matchDetails?.round || null,
                city: data.matchDetails?.city || null,
                location: data.matchDetails?.hall || null,
                country: data.matchDetails?.countryCode || null,
                max_sets: setsNeeded ? setsNeeded * 2 - 1 : 5,
                has_challenge: data.matchDetails?.hasChallenge !== undefined ? data.matchDetails.hasChallenge : null
            };
            await api.updateMatchOfficials(matchId, payload);
        } catch (error) {
            console.error("Failed to update match officials during setup:", error);
        }

        if (data.matchDetails) {
            setMatchData(prev => ({
                ...prev,
                matchNo: data.matchDetails.matchNo,
                match_number: data.matchDetails.matchNo,
                round: data.matchDetails.round,
                round_name: data.matchDetails.round,
                pool: data.matchDetails.pool,
                pool_name: data.matchDetails.pool,
                city: data.matchDetails.city,
                hall: data.matchDetails.hall,
                location: data.matchDetails.hall,
                countryCode: data.matchDetails.countryCode,
                country: data.matchDetails.countryCode,
                hasChallenge: data.matchDetails.hasChallenge,
                has_challenge: data.matchDetails.hasChallenge,
                maxSets: setsNeeded ? setsNeeded * 2 - 1 : 5,
                max_sets: setsNeeded ? setsNeeded * 2 - 1 : 5
            }));
        }
        const homeLibFiles = data.confirmedHome.filter(isPlayerLibero);
        setHomeLiberos({
            l1: homeLibFiles[0] || null,
            l2: homeLibFiles[1] || null
        });

        // Auto-fill Lineup if exactly 6 regular players are confirmed
        const homeRegularPlayers = data.confirmedHome.filter(p => !isPlayerLibero(p));
        if (homeRegularPlayers.length === 6) {
            setHomeLineup(homeRegularPlayers);
        }

        const awayLibFiles = data.confirmedAway.filter(isPlayerLibero);
        setAwayLiberos({
            l1: awayLibFiles[0] || null,
            l2: awayLibFiles[1] || null
        });

        const awayRegularPlayers = data.confirmedAway.filter(p => !isPlayerLibero(p));
        if (awayRegularPlayers.length === 6) {
            setAwayLineup(awayRegularPlayers);
        }

        // หากเป็นการแก้ไขข้อมูลระหว่างเกม (Manually Edit) ให้ปิด Modal และไม่ต้องเปลี่ยน Step
        if (showSetup) {
            setShowSetup(false);
            Swal.fire({
                title: 'OK',
                text: 'บันทึกข้อมูลการตั้งค่าทีมและผู้ตัดสินเรียบร้อยแล้ว',
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#0d54c7ff'
            });
            return;
        }

        if (matchData.currentSet === 1) {
            Swal.fire({
                title: 'บันทึกการลงทะเบียนนักกีฬาสำเร็จ',
                text: 'ขั้นตอนต่อไป: บันทึกลายเซ็นโค้ชและกัปตันทีม (Signatures)',
                icon: 'success',
                confirmButtonText: 'ดำเนินการต่อ',
                confirmButtonColor: '#0d54c7ff',
                allowOutsideClick: false
            }).then(() => {
                setWorkflowStep('SIGNATURES');
            });
        } else {
            Swal.fire({
                title: 'บันทึกการลงทะเบียนนักกีฬาสำเร็จ',
                text: 'ขั้นตอนต่อไป: ส่งรายชื่อผู้เล่นตัวจริงในสนาม (Starting Lineup)',
                icon: 'success',
                confirmButtonText: 'ดำเนินการต่อ',
                confirmButtonColor: '#0d54c7ff',
                allowOutsideClick: false
            }).then(() => {
                setWorkflowStep('LINEUP');
                setShowLineupModal(true);
            });
        }
    };

    const handleLineupConfirm = async () => {
        if (homeLineup.some(p => !p) || awayLineup.some(p => !p)) {
            alert("กรุณาเลือกผู้เล่นตัวจริงให้ครบทั้ง 6 ตำแหน่ง");
            return;
        }

        // Assign stable "originalPos" to each starting player
        const taggedHome = homeLineup.map((p, idx) => ({ ...p, originalPos: idx }));
        const taggedAway = awayLineup.map((p, idx) => ({ ...p, originalPos: idx }));
        setHomeLineup(taggedHome);
        setAwayLineup(taggedAway);

        // ✅ บันทึก Lineup ลงฐานข้อมูล
        try {
            await Promise.all([
                api.saveLineup(matchId, {
                    team_id: matchData.teamHomeId,
                    set_number: matchData.currentSet,
                    player_positions: taggedHome,
                    libero_id: homeLiberos.l1?.id
                }),
                api.saveLineup(matchId, {
                    team_id: matchData.teamAwayId,
                    set_number: matchData.currentSet,
                    player_positions: taggedAway,
                    libero_id: awayLiberos.l1?.id
                })
            ]);
        } catch (error) {
            console.error("Failed to save lineups to DB:", error);
            Swal.fire('Warning', 'บันทึก Lineup ลงฐานข้อมูลไม่สำเร็จ (แต่ยังเล่นต่อได้)', 'warning');
        }

        // Save Lineups for next set reuse
        setLastSetHomeLineup([...homeLineup]);
        setLastSetAwayLineup([...awayLineup]);
        setLastSetHomeLiberos({ ...homeLiberos });
        setLastSetAwayLiberos({ ...awayLiberos });

        // Add Lineup to Match Events history
        const homeNumbers = homeLineup.map(p => p.number).join(', ');
        const awayNumbers = awayLineup.map(p => p.number).join(', ');

        setMatchEvents(prev => [{
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            set: matchData.currentSet,
            score: `${score.home}-${score.away}`,
            description: `Lineup Confirmed - ${matchData.teamHome}: [${homeNumbers}] | ${matchData.teamAway}: [${awayNumbers}]`,
            metadata: { type: 'LINEUP_CONFIRM' },
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }, ...prev]);

        setShowLineupModal(false);

        // เฉพาะเซต 1: ต้องทำ Coin Toss หลัง Save Lineup
        if (matchData.currentSet === 1) {
            await runCoinTossFlow();
        } else {
            Swal.fire({
                title: '✅ บันทึกไลน์อัปตัวจริงสำเร็จ',
                text: 'การตั้งค่าในเซตนี้เรียบร้อยแล้ว แมตช์พร้อมสำหรับการเริ่มแข่งขัน',
                icon: 'success',
                confirmButtonText: 'ดำเนินการต่อ',
                confirmButtonColor: '#0d54c7ff',
                allowOutsideClick: false
            }).then(() => {
                setWorkflowStep('READY');
            });
        }
    };

    // ============================================================
    // COIN TOSS SWEETALERT SEQUENCE (แทน CoinTossModal)
    // ============================================================
    const runCoinTossFlow = () => {
        setShowCoinTossModal(true);
    };

    const startTimeoutTimer = (teamCode) => {
        saveStateToHistory();
        setTimeouts(prev => ({ ...prev, [teamCode]: prev[teamCode] + 1 }));
        saveEventToBackend('TIMEOUT', teamCode);
        setTimeoutStartTime(Date.now());
        setShowTimeoutTimer(true);

        const teamName = teamCode === 'home' ? matchData.teamHome : matchData.teamAway;
        let timerInterval;
        Swal.fire({
            title: `เวลานอก (TIMEOUT) - ${teamName}`,
            html: `
                <div style="font-size: 16px; color: #64748b; margin-bottom: 10px;">กำลังนับถอยหลังการขอเวลานอก</div>
                <div style="font-size: 64px; font-weight: 900; color: #f59e0b; font-family: monospace;" id="timeout-countdown">30</div>
                <div style="font-size: 14px; color: #94a3b8; margin-top: 10px;">วินาที</div>
            `,
            timer: 30000,
            timerProgressBar: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: true,
            confirmButtonText: 'ยกเลิกเวลานอกก่อนเวลา (Stop)',
            confirmButtonColor: '#ef4444',
            didOpen: () => {
                const content = Swal.getHtmlContainer().querySelector('#timeout-countdown');
                timerInterval = setInterval(() => {
                    const timerLeft = Swal.getTimerLeft();
                    if (timerLeft) {
                        const sec = Math.ceil(timerLeft / 1000);
                        if (content) content.textContent = sec;
                    }
                }, 200);
            },
            willClose: () => {
                clearInterval(timerInterval);
                setShowTimeoutTimer(false);
                setTimeoutStartTime(null);
            }
        });
    };

    const handleActionSelect = (teamCode, actionType) => {
        if (actionType === 'TIMEOUT') {
            if (timeouts[teamCode] >= 2) {
                alert("Timeout limit reached.");
                return;
            }
            startTimeoutTimer(teamCode);
        }
    };

    const handlePlayerSelect = (player) => {

        console.log("SELECTED:", player);
        console.log("Context:", pickerContext);

        const { team, posIndex } = pickerContext;
        const isCourtPos = typeof posIndex === 'number';

        if (isCourtPos && isPlayerLibero(player)) {
            alert("ไม่สามารถเลือก Libero ลงเป็นผู้เล่น 6 คนแรกได้");
            return;
        }

        const setLineup = team === 'home' ? setHomeLineup : setAwayLineup;
        const currentLineup = team === 'home' ? homeLineup : awayLineup;

        // All players default to not being captains during this phase
        let newLineup = [...currentLineup];
        let newPlayer = { ...player };

        newLineup[posIndex] = newPlayer;
        setLineup(newLineup);
        setShowPlayerPicker(false);
    };

    const handleSanction = (player, cardType) => {
        if (!player || !cardType || !sanctionTeam) return;
        saveStateToHistory();
        saveEventToBackend('SANCTION', sanctionTeam, { player_id: player.id, details: { card: cardType } });

        if (cardType === 'RED') {
            const opponentTeam = sanctionTeam === 'home' ? 'away' : 'home';
            handlePoint(opponentTeam);
        }
        setShowSanctionModal(false);
        setSanctionTeam(null);
    };


    const handleManualEdit = (data) => {
        saveStateToHistory();

        setScore(data.score);
        setMatchData(prev => ({ ...prev, currentSet: data.currentSet }));

        // Log the manual adjustment with the remark
        setMatchEvents(prev => [{
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            set: data.currentSet,
            score: `${data.score.home}-${data.score.away}`,
            description: `MANUAL ADJUSTMENT: ${data.remark}`,
            metadata: { type: 'MANUAL_EDIT', remark: data.remark },
            time: formatThaiFullDateTime(new Date())
        }, ...prev]);

        Swal.fire({
            icon: 'success',
            title: 'Manual Adjustment Applied',
            text: 'Score and set number have been updated.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    };

    const handleInjury = (teamCode) => {
        setSubData({
            isOpen: true,
            team: teamCode,
            posIndex: null,
            playerOut: null,
            isExceptional: true
        });
    };

    const handleProtest = () => {
        Swal.fire({
            title: 'Special Procedures',
            text: 'เลือกการกระทำที่ผู้ตัดสินสั่ง',
            icon: 'warning',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'ประท้วง (Protest)',
            denyButtonText: 'ริบสิทธิ์ (Forfeit)',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#3b82f6',
            denyButtonColor: '#ef4444',
        }).then((result) => {
            if (result.isConfirmed) {
                saveEventToBackend('PROTEST', servingTeam || 'home', { description: 'Match Protested' });
                Swal.fire('Protest Logged', 'เหตุการณ์ประท้วงถูกบันทึกแล้ว', 'info');
            } else if (result.isDenied) {
                Swal.fire({
                    title: 'ยืนยันการริบสิทธิ์ (Forfeit)?',
                    text: "การริบสิทธิ์จะทำให้แมตช์สิ้นสุดลงทันที",
                    icon: 'error',
                    showCancelButton: true,
                    confirmButtonText: 'ยืนยัน',
                    confirmButtonColor: '#ef4444'
                }).then((res) => {
                    if (res.isConfirmed) {
                        saveEventToBackend('FORFEIT', servingTeam || 'home', { description: 'Match Forfeited' });
                        handleFinishMatch();
                    }
                });
            }
        });
    };

    const handleChallengeSelect = (result) => {
        const team = challengeData.team;
        if (!team) return;
        if (result === 'UNSUCCESSFUL') {
            setChallenges(prev => ({ ...prev, [team]: Math.max(0, prev[team] - 1) }));
        }
        setShowChallengeModal(false);
        setChallengeData({ team: null });
    };

    // --- STAFF REQUEST HANDLERS ---
    // Keep refs up-to-date so the pendingRequests useEffect always uses the latest version.
    const handleApproveRequest = async (request) => {
        try {
            // 1. อัปเดตสถานะในฐานข้อมูล
            await client.put(`/match/${matchId}/requests/${request.id}`, { status: 'APPROVED' });

            // 2. ดำเนินการตามประเภทคำขอ
            const teamCode = String(request.team_id) === String(matchData.teamHomeId) ? 'home' : 'away';

            if (request.request_type === 'TIMEOUT') {
                if (timeouts[teamCode] >= 2) {
                    Swal.fire('Error', 'ทีมนี้ใช้เวลานอกครบตามกำหนดแล้ว (Limit reached)', 'error');
                    return;
                }
                startTimeoutTimer(teamCode);
            } else if (request.request_type === 'CHALLENGE') {
                setChallengeData({ team: teamCode });
                setShowChallengeModal(true);
            } else if (request.request_type === 'LINEUP') {
                // โหลด Lineup ใหม่จาก DB ที่เจ้าหน้าที่พึ่งบันทึก
                const lineupRes = await client.get(`/match/${matchId}/lineup/${request.team_id}?set=${matchData.currentSet || 1}`);
                const savedLineup = lineupRes.data || [];
                const roster = teamCode === 'home' ? homeRoster : awayRoster;

                // แปลง ID กลับเป็น Object ผู้เล่นที่สมบูรณ์เพื่อให้ CourtView ใช้งานได้
                const fullLineup = savedLineup.map(p => {
                    if (!p) return null;
                    const pid = typeof p === 'object' ? p.id : p;
                    return roster.find(r => r.id === pid || r.player_id === pid) || null;
                });

                // เติม null ให้ครบ 6 ตำแหน่งกันเหนียว
                const paddedLineup = [...fullLineup, ...Array(6).fill(null)].slice(0, 6);
                const taggedLineup = paddedLineup.map((p, idx) => p ? { ...p, originalPos: idx } : null);

                if (teamCode === 'home') setHomeLineup(taggedLineup);
                else setAwayLineup(taggedLineup);

                // บันทึก Match Event สำหรับการยอมรับ Lineup นี้ด้วย
                const teamName = teamCode === 'home' ? matchData.teamHome : matchData.teamAway;
                const lineupNumbers = taggedLineup.filter(Boolean).map(p => p.number).join(', ');
                setMatchEvents(prev => [{
                    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    set: matchData.currentSet,
                    score: `${score.home}-${score.away}`,
                    description: `Lineup Confirmed - ${teamName}: [${lineupNumbers}]`,
                    metadata: { type: 'LINEUP_CONFIRM', team: teamName, lineup: lineupNumbers },
                    time: formatThaiFullDateTime(new Date())
                }, ...prev]);
            } else if (request.request_type === 'SUBSTITUTION') {
                saveStateToHistory();
                const pairs = request.details?.pairs || [];
                const lineup = teamCode === 'home' ? homeLineup : awayLineup;
                const roster = teamCode === 'home' ? homeRoster : awayRoster;
                let currentLineup = [...lineup];

                for (const pair of pairs) {
                    const outPlayer = pair.outPlayer;
                    const inPlayer = pair.inPlayer;
                    if (!outPlayer || !inPlayer) continue;

                    // ✅ FIX: ใช้ loose equality (==) เพื่อรองรับกรณี id เป็น number/string ต่างกัน
                    // และเพิ่ม fallback ค้นหาด้วยหมายเลขเสื้อ (number) กรณี id ไม่ตรง
                    const outId = outPlayer.id ?? outPlayer.player_id;
                    const outNumber = outPlayer.number;

                    let posIndex = currentLineup.findIndex(p => {
                        if (!p) return false;
                        const pId = p.id ?? p.player_id;
                        // Match by database ID (loose equality handles number/string mismatch)
                        if (outId != null && pId != null && String(pId) === String(outId)) return true;
                        // Fallback: match by jersey number
                        if (outNumber != null && p.number != null && String(p.number) === String(outNumber)) return true;
                        return false;
                    });

                    if (posIndex === -1) {
                        console.warn("ไม่พบผู้เล่นออกในสนามสำหรับการอนุมัติเปลี่ยนตัว:", outPlayer, "ใน lineup:", currentLineup);
                        continue;
                    }

                    const playerOut = currentLineup[posIndex];

                    // ✅ FIX: ค้นหา inPlayer ใน roster ด้วย loose equality + jersey number fallback
                    const inId = inPlayer.id ?? inPlayer.player_id;
                    const inNumber = inPlayer.number;

                    const fullPlayerIn = roster.find(r => {
                        const rId = r.id ?? r.player_id;
                        if (inId != null && rId != null && String(rId) === String(inId)) return true;
                        if (inNumber != null && r.number != null && String(r.number) === String(inNumber)) return true;
                        return false;
                    }) || inPlayer;

                    currentLineup[posIndex] = { ...fullPlayerIn, originalPos: playerOut.originalPos !== undefined ? playerOut.originalPos : posIndex };
                    await handleSubstitutionConfirm(fullPlayerIn, false, posIndex, playerOut, teamCode);
                }
            }

            // 3. เคลียร์ออกจากรายการแจ้งเตือน
            setPendingRequests(prev => prev.filter(r => r.id !== request.id));

            if (request.request_type !== 'TIMEOUT') {
                Swal.fire({
                    icon: 'success',
                    title: 'ดำเนินการตามคำขอแล้ว',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000
                });
            }
        } catch (error) {
            console.error("Failed to approve request:", error);
            Swal.fire('Error', 'ไม่สามารถอนุมัติคำขอได้', 'error');
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            await client.put(`/match/${matchId}/requests/${requestId}`, { status: 'REJECTED' });
            setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        } catch (error) {
            console.error("Failed to reject request:", error);
        }
    };

    // Video Challenge Popups & Review Workflow Effects/Handlers
    useEffect(() => {
        const pendingChallenges = pendingRequests.filter(r => r.request_type === 'CHALLENGE');
        if (pendingChallenges.length > 0) {
            const nextChall = pendingChallenges.find(r => !postponedChallengeIds.includes(r.id));
            if (nextChall && !activeChallengeRequest && !showChallengeRequestPopup) {
                setActiveChallengeRequest(nextChall);
                setShowChallengeRequestPopup(true);
                setChallengeConfirmMode(false);
            }
        }
    }, [pendingRequests, postponedChallengeIds, activeChallengeRequest, showChallengeRequestPopup]);

    useEffect(() => {
        let timer = null;
        if (showChallengeRequestPopup && activeChallengeRequest) {
            const updateTimer = () => {
                const elapsed = (Date.now() - new Date(activeChallengeRequest.created_at).getTime()) / 1000;
                const remaining = Math.max(0, 7 - Math.floor(elapsed));
                setPopupTimeLeft(remaining);

                const details = activeChallengeRequest.details || {};
                const reason = details.reason;
                const submittedAt = details.submittedAt;

                let expired = false;
                if (reason) {
                    if (submittedAt) {
                        const submitElapsed = (new Date(submittedAt).getTime() - new Date(activeChallengeRequest.created_at).getTime()) / 1000;
                        if (submitElapsed > 7) {
                            expired = true;
                        }
                    } else {
                        if (elapsed > 7) expired = true;
                    }
                } else {
                    if (elapsed > 7) {
                        expired = true;
                    }
                }
                setIsChallengeExpired(expired);
            };

            updateTimer();
            timer = setInterval(updateTimer, 500);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showChallengeRequestPopup, activeChallengeRequest]);

    useEffect(() => {
        if (activeChallengeRequest) {
            const updated = pendingRequests.find(r => r.id === activeChallengeRequest.id);
            if (!updated) {
                setActiveChallengeRequest(null);
                setShowChallengeRequestPopup(false);
            } else if (JSON.stringify(updated) !== JSON.stringify(activeChallengeRequest)) {
                setActiveChallengeRequest(updated);
            }
        }
    }, [pendingRequests, activeChallengeRequest]);

    const handlePostponeChallenge = () => {
        if (activeChallengeRequest) {
            setPostponedChallengeIds(prev => {
                const next = prev.includes(activeChallengeRequest.id) ? prev : [...prev, activeChallengeRequest.id];
                localStorage.setItem(`match_${matchId}_postponedChallengeIds`, JSON.stringify(next));
                return next;
            });
        }
        setShowChallengeRequestPopup(false);
        setActiveChallengeRequest(null);
    };

    const handleInvalidChallenge = async () => {
        if (activeChallengeRequest) {
            try {
                await client.put(`/match/${matchId}/requests/${activeChallengeRequest.id}`, { status: 'REJECTED' });
                setPendingRequests(prev => prev.filter(r => r.id !== activeChallengeRequest.id));
                setPostponedChallengeIds(prev => prev.filter(id => id !== activeChallengeRequest.id));
            } catch (err) {
                console.error(err);
            }
            setShowChallengeRequestPopup(false);
            setActiveChallengeRequest(null);
        }
    };

    const handleAcceptChallenge = () => {
        if (activeChallengeRequest) {
            setChallengeConfirmMode(true);
        }
    };

    const handleConfirmChallengeReview = async (reason, lastAction) => {
        if (activeChallengeRequest) {
            try {
                await client.put(`/match/${matchId}/requests/${activeChallengeRequest.id}`, {
                    status: 'APPROVED',
                    details: {
                        lastAction,
                        reason
                    }
                });

                const teamCode = String(activeChallengeRequest.team_id) === String(matchData.teamHomeId) ? 'home' : 'away';
                const reviewObj = {
                    requestId: activeChallengeRequest.id,
                    team: teamCode,
                    reason,
                    lastAction
                };
                setCurrentChallengeReview(reviewObj);
                localStorage.setItem(`match_${matchId}_currentChallengeReview`, JSON.stringify(reviewObj));

                setPendingRequests(prev => prev.filter(r => r.id !== activeChallengeRequest.id));
                setPostponedChallengeIds(prev => prev.filter(id => id !== activeChallengeRequest.id));

                setWorkflowStep('CHALLENGE_REVIEW');

                const teamName = teamCode === 'home' ? matchData.teamHome : matchData.teamAway;
                setMatchEvents(prev => [{
                    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    set: matchData.currentSet,
                    score: `${score.home}-${score.away}`,
                    description: `Challenge Review Started - ${teamName}: ${reason} (${lastAction ? 'Last action' : 'Previous action'})`,
                    metadata: { type: 'CHALLENGE_START', team: teamName, reason },
                    time: formatThaiFullDateTime(new Date())
                }, ...prev]);

            } catch (err) {
                console.error(err);
            }
            setShowChallengeRequestPopup(false);
            setActiveChallengeRequest(null);
            setChallengeConfirmMode(false);
        }
    };

    const handleChallengeOutcome = (outcome) => {
        saveStateToHistory();

        const teamCode = currentChallengeReview.team;
        const oppTeam = teamCode === 'home' ? 'away' : 'home';

        let newScore = { ...score };
        let newServingTeam = servingTeam;
        let description = "";

        if (outcome === 'SUCCESSFUL') {
            const lastPointEvent = matchEvents.find(e => e.metadata?.type === 'POINT');
            let lastScorer = null;
            if (lastPointEvent) {
                lastScorer = lastPointEvent.metadata.team === matchData.teamHome ? 'home' : 'away';
            }

            if (lastScorer === oppTeam) {
                newScore[oppTeam] = Math.max(0, newScore[oppTeam] - 1);
                newScore[teamCode] = newScore[teamCode] + 1;
                newServingTeam = teamCode;
                description = `Challenge SUCCESSFUL: Point reverted to ${teamCode === 'home' ? matchData.teamHome : matchData.teamAway}`;
            } else {
                description = `Challenge SUCCESSFUL`;
            }
        } else if (outcome === 'UNSUCCESSFUL') {
            setChallenges(prev => ({
                ...prev,
                [teamCode]: Math.max(0, prev[teamCode] - 1)
            }));
            description = `Challenge UNSUCCESSFUL`;
        } else if (outcome === 'INCONCLUSIVE') {
            description = `Challenge INCONCLUSIVE`;
        }

        setScore(newScore);
        setServingTeam(newServingTeam);

        setMatchEvents(prev => [{
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            set: matchData.currentSet,
            score: `${newScore.home}-${newScore.away}`,
            description: `${description} (${currentChallengeReview.reason})`,
            metadata: { type: 'CHALLENGE_END', outcome, team: teamCode },
            time: formatThaiFullDateTime(new Date())
        }, ...prev]);

        setCurrentChallengeReview(null);
        localStorage.removeItem(`match_${matchId}_currentChallengeReview`);
        setWorkflowStep('SERVING');
    };

    const handleFaultAdmission = () => {
        saveStateToHistory();
        const teamCode = currentChallengeReview.team;
        const oppTeam = teamCode === 'home' ? 'away' : 'home';

        let newScore = { ...score };
        newScore[oppTeam] = Math.max(0, newScore[oppTeam] - 1);
        newScore[teamCode] = newScore[teamCode] + 1;

        setScore(newScore);
        setServingTeam(teamCode);

        setMatchEvents(prev => [{
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            set: matchData.currentSet,
            score: `${newScore.home}-${newScore.away}`,
            description: `Player fault admission - Point awarded to ${teamCode === 'home' ? matchData.teamHome : matchData.teamAway}`,
            metadata: { type: 'CHALLENGE_FAULT_ADMISSION', team: oppTeam },
            time: formatThaiFullDateTime(new Date())
        }, ...prev]);

        setCurrentChallengeReview(null);
        localStorage.removeItem(`match_${matchId}_currentChallengeReview`);
        setWorkflowStep('SERVING');
    };

    // ============================================================
    // LIBERO SWEETALERT
    // ============================================================
    const openLiberoSwal = (teamCode) => {
        const roster = teamCode === 'home' ? homeRoster : awayRoster;
        const liberos = teamCode === 'home' ? homeLiberos : awayLiberos;
        let availableIn = [liberos?.l1, liberos?.l2].filter(Boolean);
        if (availableIn.length === 0) {
            const rosterLiberos = roster.filter(isPlayerLibero);
            if (rosterLiberos.length > 0) {
                availableIn = rosterLiberos;
            }
        }
        if (availableIn.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มี Libero ลงทะเบียน',
                text: 'กรุณาตั้งค่า Libero ในขั้นตอนการตั้งค่าทีมก่อน',
                confirmButtonColor: '#f59e0b'
            });
            return;
        }

        const lineup = teamCode === 'home' ? homeLineup : awayLineup;
        const isServing = servingTeam === teamCode;
        const allowedIndices = isServing ? [4, 5] : [0, 4, 5];
        const posOrder = { 0: 1, 5: 2, 4: 3 };
        const availableOut = lineup
            .map((p, idx) => p ? { ...p, posIndex: idx } : null)
            .filter(p => p && p.id && allowedIndices.includes(p.posIndex))
            .sort((a, b) => posOrder[a.posIndex] - posOrder[b.posIndex]);

        if (availableOut.length === 0) {
            Swal.fire({ icon: 'info', title: 'ไม่มีผู้เล่นในสนาม', confirmButtonColor: '#3b82f6' });
            return;
        }

        setLiberoSwapTeam(teamCode);
        setShowLiberoSwapModal(true);
    };

    // --- LIBERO REPLACEMENT HANDLER ---
    const handleLiberoConfirm = async (actionType, teamCode, details) => {
        const team = teamCode;
        let { posIndex, playerIn, playerOut } = details;

        if (actionType === 'IN') {
            Swal.fire({
                icon: 'success',
                title: `Libero in court`,
                html: `
                    <div style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;margin-top:10px;">
                        <span style="font-weight:bold;">Number In</span>
                        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:4px;background-color:#d1fae5;color:#10b981;border:1.5px solid #6ee7b7;font-size:13px;font-weight:900;">#${playerIn.number}</span>
                        <span style="font-weight:bold;">Number Out</span>
                        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:4px;background-color:#fee2e2;color:#ef4444;border:1.5px solid #fca5a5;font-size:13px;font-weight:900;">#${playerOut.number}</span>
                    </div>
                `,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2500
            });
        }

        // ดึง Lineup ปัจจุบันของทีมมาเตรียมไว้
        const currentLineup = team === 'home' ? [...homeLineup] : [...awayLineup];

        // 🌟 [แก้บั๊กหมุนตำแหน่ง] 🌟
        // หากเป็นการสลับ Libero ออก ต้องหา "ตำแหน่งปัจจุบัน" ของ Libero ในสนาม
        // เพราะระหว่างเกมอาจจะมีการหมุน (Rotate) ตำแหน่งไปแล้ว
        if (actionType === 'OUT') {
            const actualIndex = currentLineup.findIndex(p => p && p.id === playerOut.id);
            if (actualIndex !== -1) {
                posIndex = actualIndex; // อัปเดตไปใช้ตำแหน่งปัจจุบันแทน
            }
        }

        // 1. อัปเดต Lineup บนหน้าจอ (เอาผู้เล่นใหม่เสียบทับตำแหน่งนั้น)
        if (actionType === 'IN' && isPlayerLibero(playerOut)) {
            currentLineup[posIndex] = {
                ...playerIn,
                replacedLiberoNumber: playerOut.number
            };
        } else {
            currentLineup[posIndex] = playerIn;
        }

        if (team === 'home') {
            setHomeLineup(currentLineup);
            // ✅ Sync with Quick Swap Tracker
            if (actionType === 'IN') {
                if (!isPlayerLibero(playerOut)) {
                    setHomeLiberoSwaps(prev => ({ ...prev, [posIndex]: playerOut }));
                }
            } else {
                setHomeLiberoSwaps(prev => {
                    const next = { ...prev };
                    delete next[posIndex];
                    return next;
                });
            }
        } else {
            setAwayLineup(currentLineup);
            // ✅ Sync with Quick Swap Tracker
            if (actionType === 'IN') {
                if (!isPlayerLibero(playerOut)) {
                    setAwayLiberoSwaps(prev => ({ ...prev, [posIndex]: playerOut }));
                }
            } else {
                setAwayLiberoSwaps(prev => {
                    const next = { ...prev };
                    delete next[posIndex];
                    return next;
                });
            }
        }

        // 2. อัปเดตสถานะ Tracker 
        setLiberoTracker(prev => {
            const newTracker = { ...prev };
            if (actionType === 'IN') {
                // Libero ลงสนาม (จดจำตัวจริงที่ถูกเปลี่ยนออกไป - รักษาตัวจริงเดิมกรณี Libero-to-Libero swap)
                const existingReplacedPlayer = prev[team]?.replacedPlayer;
                const replaced = isPlayerLibero(playerOut) ? existingReplacedPlayer : playerOut;
                newTracker[team] = { onCourt: true, activeLibero: playerIn, replacedPlayer: replaced, posIndex };
            } else {
                // Libero ออกจากสนาม
                if (isPlayerLibero(playerIn)) {
                    // กรณี: เปลี่ยน Libero 1 เป็น Libero 2 (ยังคงสถานะ onCourt)
                    newTracker[team].activeLibero = playerIn;
                    newTracker[team].posIndex = posIndex; // อัปเดตตำแหน่งล่าสุดไว้ด้วย
                } else {
                    // กรณี: เปลี่ยนตัวจริงกลับเข้ามา (เคลียร์สถานะ Libero กลับไปนั่งม้านั่ง)
                    newTracker[team] = { onCourt: false, activeLibero: null, replacedPlayer: null, posIndex: null };
                }
            }
            return newTracker;
        });

        // 3. บันทึก Log ลงระบบหลังบ้าน (ไม่นับเป็นโควต้า 6 ครั้ง)
        await saveEventToBackend('LIBERO_REPLACEMENT', team, {
            player_id: playerIn.id,
            details: { out: playerOut.id, isLiberoAction: true }
        });
    };

    // Helper for UI
    const getLeftTeam = () => isHomeLeft
        ? { name: matchData.teamHome, score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home, bg: teamColors.home, roster: homeRoster, lineup: homeLineup, liberos: homeLiberos, liberoSwaps: homeLiberoSwaps, lastLiberoSwap: lastLiberoSwap, subTracker: subTracker.home, isStaffConnected: staffConnections.home }
        : { name: matchData.teamAway, score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away, bg: teamColors.away, roster: awayRoster, lineup: awayLineup, liberos: awayLiberos, liberoSwaps: awayLiberoSwaps, lastLiberoSwap: lastLiberoSwap, subTracker: subTracker.away, isStaffConnected: staffConnections.away };

    const getRightTeam = () => isHomeLeft
        ? { name: matchData.teamAway, score: score.away, sets: setsWon.away, code: 'away', color: teamColors.away, bg: teamColors.away, roster: awayRoster, lineup: awayLineup, liberos: awayLiberos, liberoSwaps: awayLiberoSwaps, lastLiberoSwap: lastLiberoSwap, subTracker: subTracker.away, isStaffConnected: staffConnections.away }
        : { name: matchData.teamHome, score: score.home, sets: setsWon.home, code: 'home', color: teamColors.home, bg: teamColors.home, roster: homeRoster, lineup: homeLineup, liberos: homeLiberos, liberoSwaps: homeLiberoSwaps, lastLiberoSwap: lastLiberoSwap, subTracker: subTracker.home, isStaffConnected: staffConnections.home };

    // Opens picker for LineupModal
    const openPickerForLineup = (team, index) => {
        setPickerContext({ team, posIndex: index });
        setShowPlayerPicker(true);
    };

    // --- SUBSTITUTION HANDLERS ---

    // ใน ScorerConsole.jsx (ส่วนของการเขียนฟังก์ชัน)
    const handleCourtPlayerClick = async (clickedSide, posIndex) => {
        // ป้องกันการเปลี่ยนตัวระหว่าง Rally หรือก่อนเริ่มแมตช์
        if (workflowStep === 'RALLY' || isSetupPhase || workflowStep === 'READY') {
            return;
        }

        const actualTeamCode = (clickedSide === 'home') ? (isHomeLeft ? 'home' : 'away') : (isHomeLeft ? 'away' : 'home');
        const lineup = actualTeamCode === 'home' ? homeLineup : awayLineup;
        const playerOut = lineup[posIndex];
        const tracker = actualTeamCode === 'home' ? subTracker.home : subTracker.away;

        // Logic for corner display: retrieve jersey number from tracker
        const opDisplay = playerOut?.originalPos !== undefined && playerOut?.originalPos !== null ? playerOut.originalPos : posIndex;
        if (tracker && tracker.positions && opDisplay !== undefined) {
            const posData = tracker.positions[opDisplay];
            if (posData && !posData.returned && posData.subId == (playerOut.id || playerOut.player_id)) {
                // We know this is a sub, ensure we store/use starter number for the corner
            }
        }

        if (!playerOut) return;

        const currentLiberos = actualTeamCode === 'home' ? homeLiberos : awayLiberos;
        const pOutId = playerOut.id || playerOut.player_id;
        const isLiberoOnCourt = isPlayerLibero(playerOut) ||
            (currentLiberos.l1 && (currentLiberos.l1.id == pOutId || currentLiberos.l1.player_id == pOutId)) ||
            (currentLiberos.l2 && (currentLiberos.l2.id == pOutId || currentLiberos.l2.player_id == pOutId));

        // CASE 1: Clicked on a Libero on court -> Swap them OUT
        if (isLiberoOnCourt) {
            const currentSwaps = actualTeamCode === 'home' ? homeLiberoSwaps : awayLiberoSwaps;
            const originalPlayer = currentSwaps[posIndex];

            if (!originalPlayer) {
                Swal.fire('Action Not Allowed', 'This Libero cannot be swapped out from here. This might be a formal replacement.', 'info');
                return;
            }

            saveStateToHistory();
            const setLineup = actualTeamCode === 'home' ? setHomeLineup : setAwayLineup;
            const setSwaps = actualTeamCode === 'home' ? setHomeLiberoSwaps : setAwayLiberoSwaps;

            const newLineup = [...lineup];
            newLineup[posIndex] = originalPlayer;
            setLineup(newLineup);

            const newSwaps = { ...currentSwaps };
            delete newSwaps[posIndex];
            setSwaps(newSwaps);

            setLastLiberoSwap({ team: actualTeamCode, posIndex });
            saveEventToBackend('LIBERO_SWAP', actualTeamCode, { details: { type: 'OUT', libero: playerOut.number, player: originalPlayer.number } });

            // ✅ Update Libero Tracker to sync with Quick Swap
            setLiberoTracker(prev => ({
                ...prev,
                [actualTeamCode]: { onCourt: false, activeLibero: null, replacedPlayer: null, posIndex: null }
            }));

            return;
        }

        // Use playerOut.originalPos for tracking with fallback to posIndex
        const originalPos = (playerOut?.originalPos !== undefined && playerOut?.originalPos !== null)
            ? playerOut.originalPos
            : posIndex;

        // CASE 3: Normal Substitution logic
        const posData = tracker.positions[originalPos]; // ดูประวัติการเปลี่ยนตัวในตำแหน่งนี้

        // 🌟 NEW LOGIC: หากลุ่มนักกีฬาที่ "สามารถเปลี่ยนตัวลงมาได้" ตามกฎการจับคู่
        const roster = actualTeamCode === 'home' ? homeRoster : awayRoster;
        const currentLineupIds = lineup.map(p => p?.id || p?.player_id);
        let validSubs = [];

        if (!posData) {
            // กรณียังไม่เคยเปลี่ยนตัวในตำแหน่งนี้: เลือกใครก็ได้ในคอกสำรอง ที่ "ยังไม่เคยลงสนามในตำแหน่งอื่น" ในเซตนี้
            const usedIds = tracker.usedPlayers || [];
            validSubs = roster.filter(p => {
                const pId = p.id || p.player_id;
                return !currentLineupIds.some(cId => cId == pId) &&
                    !usedIds.some(uId => uId == pId) &&
                    !isPlayerLibero(p);
            });
        } else {
            // กรณีเคยเปลี่ยนตัวไปแล้ว (สำรองอยู่ในสนาม): บังคับเลือกได้แค่ "ผู้เล่นตัวจริง (Starter)" คนเดิมคนเดียวเท่านั้น
            validSubs = roster.filter(p => {
                const pId = p.id || p.player_id;
                return pId == posData.starterId;
            });
            // ป้องกันกรณี Logic ผิดพลาดแล้ว validSubs ว่างเปล่า
            if (validSubs.length === 0) {
                console.warn("ไม่พบตัวจริงที่จะเปลี่ยนกลับในระบบ Tracker");
            }
        }

        // อัปเดต State พร้อมส่ง validSubs ไปให้ Modal ใช้งาน
        setSubData({
            isOpen: true,
            team: actualTeamCode,
            posIndex: posIndex,
            originalPos: originalPos, // ✅ Pass originalPos
            playerOut,
            validSubs
        });
    };



    // 2. ฟังก์ชันนี้จะถูกเรียกเมื่อกด Confirm ใน SubstitutionModal
    const handleSubstitutionConfirm = async (playerIn, isExceptional, innerPosIndex, innerPlayerOut, teamOverride = null) => {
        const team = teamOverride || subData.team;
        const posIndex = innerPosIndex !== undefined && innerPosIndex !== null ? innerPosIndex : subData.posIndex;
        const playerOut = innerPlayerOut !== undefined && innerPlayerOut !== null ? innerPlayerOut : subData.playerOut;
        const originalPos = (playerOut?.originalPos !== undefined && playerOut?.originalPos !== null)
            ? playerOut.originalPos
            : posIndex;

        // ✅ Check if this is actually a Libero Replacement (not a formal substitution)
        if (isPlayerLibero(playerIn)) {
            handleLiberoConfirm('IN', team, {
                posIndex: posIndex,
                playerIn: playerIn,
                playerOut: playerOut
            });
            return;
        }

        // --- 1. Update Tracker ตามกติกา FIVB ---
        if (!isExceptional) {
            setSubstitutions(prev => {
                const newCount = prev[team] + 1;
                if (newCount === 5) {
                    setTimeout(() => {
                        Swal.fire({
                            title: '⚠️ แจ้งเตือนโควต้า',
                            text: `ทีม ${team === 'home' ? matchData.teamHome : matchData.teamAway} เปลี่ยนตัวไปแล้ว 5 ครั้ง (เหลือโควต้าอีก 1 ครั้ง)`,
                            icon: 'warning',
                            confirmButtonColor: '#f59e0b',
                            confirmButtonText: 'รับทราบ'
                        });
                    }, 500);
                }
                return { ...prev, [team]: newCount };
            });

            setSubTracker(prev => {
                const newTracker = { ...prev };
                const teamTracker = {
                    ...newTracker[team],
                    positions: { ...newTracker[team].positions },
                    usedPlayers: [...newTracker[team].usedPlayers]
                };

                const posData = teamTracker.positions[originalPos];
                const pInId = playerIn.id || playerIn.player_id;
                const pOutId = playerOut.id || playerOut.player_id;

                // 🌟 สร้างข้อความคะแนน ณ ขณะที่เปลี่ยนตัว (ทีมเราขึ้นก่อน)
                const opponent = team === 'home' ? 'away' : 'home';
                const currentScoreText = `${score[team]}-${score[opponent]}`;

                teamTracker.count += 1;

                if (posData) {
                    // กรณีเปลี่ยนกลับ (Sub-back)
                    teamTracker.positions[originalPos] = {
                        ...posData,
                        currentOnCourt: pInId,
                        returned: true,
                        returnScore: currentScoreText // 🌟 บันทึกสกอร์ตอนเปลี่ยนตัวกลับ
                    };
                } else {
                    // เปลี่ยนครั้งแรก (Sub-in)
                    teamTracker.positions[originalPos] = {
                        starterId: pOutId,
                        starterNumber: playerOut.number, // 🌟 บันทึกหมายเลขไว้เลย
                        subId: pInId,
                        subNumber: playerIn.number,     // 🌟 บันทึกหมายเลขไว้เลย
                        currentOnCourt: pInId,
                        returned: false,
                        subScore: currentScoreText
                    };

                    if (!teamTracker.usedPlayers.includes(pInId)) teamTracker.usedPlayers.push(pInId);
                    if (!teamTracker.usedPlayers.includes(pOutId)) teamTracker.usedPlayers.push(pOutId);
                }

                newTracker[team] = teamTracker;
                return newTracker;
            });
        }

        // --- 2. อัปเดต Lineup บนสนาม ---
        const setLineup = team === 'home' ? setHomeLineup : setAwayLineup;
        setLineup(prev => {
            const newLineup = [...prev];
            // Preserve the originalPos when substituting
            const pInWithPos = { ...playerIn, originalPos: originalPos };
            newLineup[posIndex] = pInWithPos;
            return newLineup;
        });

        // --- 3. บันทึก Event ลง Backend ---
        await saveEventToBackend('SUBSTITUTION', team, {
            player_id: playerIn.id || playerIn.player_id,
            details: {
                out: playerOut.id || playerOut.player_id,
                isExceptional
            }
        });

        if (isExceptional) {
            setDisqualifiedPlayers(prev => {
                const teamDisq = [...prev[team], playerOut.id || playerOut.player_id];
                return { ...prev, [team]: teamDisq };
            });
        }

        // ปิด Modal
        setSubData({ isOpen: false, team: null, posIndex: null, playerOut: null, isExceptional: false });
    };


    if (isLoading) return (
        <div className="h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-sm">Loading Console...</p>
        </div>
    );

    const isSetupPhase = ['COIN_TOSS', 'SIGNATURES', 'ROSTER_CHECK', 'SERVER_SELECT', 'LINEUP_SELECT', 'LINEUP'].includes(workflowStep);
    const leftTeam = getLeftTeam();
    const rightTeam = getRightTeam();

    return (
        <div className="h-screen flex flex-col bg-white text-slate-900 font-sans overflow-hidden">
            {/* --- HEADER --- */}
            <header className="h-14 bg-white/70 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-indigo-100 shadow-xl border border-indigo-400/20">
                        <Trophy size={18} />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-semibold text-lg tracking-tight text-slate-900 uppercase leading-tight">
                            Scorer <span className="text-blue-600">Console</span>
                        </h1>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider flex-wrap">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span> LIVE</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="text-slate-500">{formatThaiFullDateTime(new Date())}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Sync Status Badge */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-tighter transition-all duration-300 ${queueCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse'}`}>
                        {queueCount === 0 ? (
                            <><CheckCircle size={14} /> Synced</>
                        ) : (
                            <><Loader size={14} className="animate-spin" /> Pending ({queueCount})</>
                        )}
                    </div>

                    <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200">
                        <button onClick={handleProtest} className="p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-all duration-200" title="Protest / Forfeit">
                            <Whistle size={18} />
                        </button>
                        <button onClick={() => setShowMatchLogModal(true)} className="p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-all duration-200" title="Match Log"><ListChecks size={18} /></button>
                        <button
                            onClick={() => {
                                const userStr = localStorage.getItem('user');
                                let role = 'admin';
                                if (userStr) {
                                    try {
                                        const user = JSON.parse(userStr);
                                        role = user.role;
                                    } catch {/* */ }
                                }
                                if (role === 'score') {
                                    navigate('/adminscorer');
                                } else {
                                    navigate('/admin');
                                }
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-white transition-all duration-200"
                            title="Exit"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden p-3 gap-3">
                {/* Left Sidebar */}
                <aside className="w-[300px] bg-white border border-slate-200/60 rounded-lg hidden lg:flex flex-col z-10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300">
                    <TeamInfoPanel team={leftTeam} align="left" onPlayerClick={handleCourtPlayerClick} />

                    <TeamQuickControls
                        team={leftTeam}
                        workflowStep={workflowStep}
                        challenges={challenges}
                        timeouts={timeouts}
                        substitutions={substitutions}
                        onOpenLiberoSwap={openLiberoSwal}
                        onOpenChallenge={(team) => {
                            setChallengeData({ team });
                            setShowChallengeModal(true);
                        }}
                        onActionSelect={handleActionSelect}
                        onOpenSubstitution={(team) => setSubData({ isOpen: true, team, posIndex: null, playerOut: null })}
                        onPointScored={handlePoint}
                    />
                </aside>

                {/* CENTER: COURT & SCORE */}
                <section className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0 lg:min-w-[600px] w-full">
                    {/* SCOREBOARD */}
                    <div className="bg-white border border-slate-200/60 rounded-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)] shrink-0 overflow-hidden">

                        {/* Header: Set + Timer */}
                        <div className="flex items-center justify-center gap-3 py-2 border-b border-slate-100 bg-slate-50/70">
                            <span className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">SET</span>
                            <span className="text-[13px] font-bold text-blue-600">{matchData.currentSet}</span>
                            <span className="w-px h-3.5 bg-slate-300"></span>
                            <div className="flex items-center gap-1 text-[13px] font-semibold text-slate-500">
                                <Clock size={13} className="text-slate-400" />
                                {Math.floor(matchDuration / 60)}:{(matchDuration % 60).toString().padStart(2, '0')}
                            </div>
                        </div>

                        {/* Score Row */}
                        <div className="flex items-stretch">

                            {/* Left: Sets Won */}
                            <div className="flex flex-col items-center justify-center px-5 py-3 border-r border-slate-100 min-w-[64px]">
                                <span className="text-4xl font-black tabular-nums select-none">{leftTeam.sets}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sets</span>
                            </div>

                            {/* Left: Current Score */}
                            <div
                                className="flex flex-col items-center justify-center flex-1 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-r border-slate-100 relative group"
                                onClick={() => setShowManualEditModal(true)}
                                title="Click to manually edit score"
                            >
                                <span className="text-6xl font-black tabular-nums tracking-tighter select-none transition-all duration-300">
                                    {leftTeam.score}
                                </span>
                                <div className="mt-2 text-[16px] font-bold uppercase tracking-wider  max-w-[400px] text-center" >
                                    {leftTeam.name}
                                </div>
                                {/* Team color accent bar */}
                                <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundColor: getLeftTeam().color }}></div>
                            </div>

                            {/* Center: Buzz / Point Button 
                            <div className="flex flex-col items-center justify-center px-4 py-3 gap-2 border-r border-slate-100">
                                <button
                                    onClick={() => handlePoint(leftTeam.code)}
                                    disabled={workflowStep !== 'RALLY'}
                                    className="px-5 py-2 rounded-md text-[12px] font-black uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-sm"
                                    style={{ backgroundColor: getLeftTeam().color, color: getContrastColorHex(getLeftTeam().color) }}
                                >
                                    Buzz
                                </button>
                                <button
                                    onClick={() => handlePoint(rightTeam.code)}
                                    disabled={workflowStep !== 'RALLY'}
                                    className="px-5 py-2 rounded-md text-[12px] font-black uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-sm"
                                    style={{ backgroundColor: getRightTeam().color, color: getContrastColorHex(getRightTeam().color) }}
                                >
                                    Buzz
                                </button>
                            </div>
                            */}
                            {/* Right: Current Score */}
                            <div
                                className="flex flex-col items-center justify-center flex-1 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-r border-slate-100 relative group"
                                onClick={() => setShowManualEditModal(true)}
                                title="Click to manually edit score"
                            >
                                <span className="text-6xl font-black tabular-nums tracking-tighter select-none transition-all duration-300">
                                    {rightTeam.score}
                                </span>
                                <div className="mt-2 text-[16px] font-bold uppercase tracking-wider  max-w-[400px] text-center">
                                    {rightTeam.name}
                                </div>
                                {/* Team color accent bar */}
                                <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundColor: getRightTeam().color }}></div>
                            </div>

                            {/* Right: Sets Won */}
                            <div className="flex flex-col items-center justify-center px-5 py-3 min-w-[64px]">
                                <span className="text-4xl font-black tabular-nums select-none">{rightTeam.sets}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sets</span>
                            </div>

                        </div>

                        {/* Mobile Roster buttons */}
                        <div className="flex lg:hidden border-t border-slate-100">
                            <button
                                onClick={(e) => { e.stopPropagation(); setMobilePanelTeam(leftTeam.code); }}
                                className="flex-1 py-2 text-[10px] font-bold text-center border-r border-slate-100 hover:bg-slate-50 transition-colors"
                                style={{ color: getLeftTeam().color }}
                            >
                                {leftTeam.name} — Roster &amp; Actions
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setMobilePanelTeam(rightTeam.code); }}
                                className="flex-1 py-2 text-[10px] font-bold text-center hover:bg-slate-50 transition-colors"
                                style={{ color: getRightTeam().color }}
                            >
                                {rightTeam.name} — Roster &amp; Actions
                            </button>
                        </div>
                    </div>

                    {/* COURT VIEW CONTAINER */}
                    <div className="flex-1 relative overflow-hidden flex items-center justify-center p-2">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-50 to-white pointer-events-none"></div>
                        <div className="w-full h-full max-w-4xl max-h-[420px] relative z-10">
                            <CourtView
                                homePositions={!isSetupPhase ? (isHomeLeft ? homeLineup : awayLineup) : Array(6).fill(null)}
                                awayPositions={!isSetupPhase ? (isHomeLeft ? awayLineup : homeLineup) : Array(6).fill(null)}
                                servingSide={!isSetupPhase && servingTeam ? ((servingTeam === 'home' && isHomeLeft) || (servingTeam === 'away' && !isHomeLeft) ? 'left' : 'right') : null}
                                onPlayerClick={handleCourtPlayerClick}
                                onLiberoClick={(team) => openLiberoSwal(team)}
                                leftTeam={getLeftTeam()}
                                rightTeam={getRightTeam()}
                                homeSubTracker={subTracker.home}
                                awaySubTracker={subTracker.away}
                                isHomeLeft={isHomeLeft}
                                disableLibero={workflowStep === 'RALLY'}
                            />
                        </div>
                    </div>

                    {/* OVERLAYS */}
                    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                        {(workflowStep === 'ROSTER_CHECK' || showSetup || showPostMatchVerify) && isRosterReady && (
                            <div className="pointer-events-auto">
                                <PreMatchSetupModal
                                    key={showSetup ? 'settings' : 'roster'}
                                    isOpen={true}
                                    match={matchData}
                                    matchNo={matchData.matchNo}
                                    teamHome={matchData.teamHome} teamAway={matchData.teamAway}
                                    homeRoster={masterHomeRoster} awayRoster={masterAwayRoster}
                                    activeHome={homeRoster} activeAway={awayRoster}
                                    referees={referees}
                                    isSettingsOnly={showSetup}
                                    onConfirm={showPostMatchVerify ? handlePostMatchVerifyConfirm : handleSetupConfirm}
                                    onClose={showPostMatchVerify ? () => setShowPostMatchVerify(false) : (workflowStep === 'ROSTER_CHECK' ? () => navigate(-1) : () => setShowSetup(false))}
                                />
                            </div>
                        )}

                        {/* Loading indicator ระหว่างรอ roster โหลด (เฉพาะ ROSTER_CHECK) */}
                        {workflowStep === 'ROSTER_CHECK' && !isRosterReady && (
                            <div className="pointer-events-auto flex flex-col items-center justify-center gap-4 bg-white/90 backdrop-blur-sm rounded-2xl px-16 py-10 shadow-2xl border border-slate-100">
                                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">กำลังโหลดข้อมูลผู้เล่น...</p>
                            </div>
                        )}




                        <SignatureModal
                            isOpen={workflowStep === 'SIGNATURES' || showPostMatchSignatures}
                            teamHome={matchData.teamHome}
                            teamAway={matchData.teamAway}
                            onConfirm={showPostMatchSignatures ? handlePostMatchSignaturesConfirm : handleSignaturesConfirm}
                            isPostMatch={showPostMatchSignatures}
                            matchSignatures={matchSignatures}
                        />

                    </div>

                    <MobileTeamDrawer
                        mobilePanelTeam={mobilePanelTeam}
                        onClose={() => setMobilePanelTeam(null)}
                        matchData={matchData}
                        leftTeam={leftTeam}
                        rightTeam={rightTeam}
                        workflowStep={workflowStep}
                        challenges={challenges}
                        timeouts={timeouts}
                        substitutions={substitutions}
                        teamColors={teamColors}
                        onPlayerClick={handleCourtPlayerClick}
                        onOpenLiberoSwap={openLiberoSwal}
                        onOpenChallenge={(team) => {
                            setChallengeData({ team });
                            setShowChallengeModal(true);
                        }}
                        onActionSelect={handleActionSelect}
                        onOpenSubstitution={(team) => setSubData({ isOpen: true, team, posIndex: null, playerOut: null })}
                        onPointScored={handlePoint}
                    />

                    <ControlActionsPanel
                        workflowStep={workflowStep}
                        pendingSetWinner={pendingSetWinner}
                        finishSet={finishSet}
                        startNextSet={startNextSet}
                        handleFinishMatch={handleFinishMatch}
                        runCoinTossFlow={runCoinTossFlow}
                        leftTeam={leftTeam}
                        rightTeam={rightTeam}
                        handleInjury={handleInjury}
                        setSanctionTeam={setSanctionTeam}
                        setShowSanctionModal={setShowSanctionModal}
                        currentChallengeReview={currentChallengeReview}
                        setCurrentChallengeReview={setCurrentChallengeReview}
                        isEditingChallengeReason={isEditingChallengeReason}
                        setIsEditingChallengeReason={setIsEditingChallengeReason}
                        handleFaultAdmission={handleFaultAdmission}
                        handleChallengeOutcome={handleChallengeOutcome}
                        handleStartMatch={handleStartMatch}
                        setWorkflowStep={setWorkflowStep}
                        setShowLineupModal={setShowLineupModal}
                        handleReplayRally={handleReplayRally}
                        matchData={matchData}
                    />
                </section>


                {/* Right Sidebar (Team Info) */}
                <aside className="w-[300px]  bg-white border border-slate-200/60 rounded-lg hidden lg:flex flex-col z-10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300">
                    <TeamInfoPanel team={rightTeam} align="right" onPlayerClick={handleCourtPlayerClick} />

                    <TeamQuickControls
                        team={rightTeam}
                        workflowStep={workflowStep}
                        challenges={challenges}
                        timeouts={timeouts}
                        substitutions={substitutions}
                        onOpenLiberoSwap={openLiberoSwal}
                        onOpenChallenge={(team) => {
                            setChallengeData({ team });
                            setShowChallengeModal(true);
                        }}
                        onActionSelect={handleActionSelect}
                        onOpenSubstitution={(team) => setSubData({ isOpen: true, team, posIndex: null, playerOut: null })}
                        onPointScored={handlePoint}
                    />
                </aside>

                <MatchHistorySidebar
                    matchData={matchData}
                    staffConnections={staffConnections}
                    isHomeLeft={isHomeLeft}
                    homeLineup={homeLineup}
                    awayLineup={awayLineup}
                    matchEvents={matchEvents}
                    activeHistoryTab={activeHistoryTab}
                    setActiveHistoryTab={setActiveHistoryTab}
                    pendingRequests={pendingRequests}
                    postponedChallengeIds={postponedChallengeIds}
                    teamColors={teamColors}
                    history={history}
                    setShowSetup={setShowSetup}
                    setActiveChallengeRequest={setActiveChallengeRequest}
                    setShowChallengeRequestPopup={setShowChallengeRequestPopup}
                    setChallengeConfirmMode={setChallengeConfirmMode}
                    handleUndo={handleUndo}
                />
            </main>

            {/* --- MODALS ZONE --- */}
            <PlayerPicker
                isOpen={showPlayerPicker}
                onClose={() => setShowPlayerPicker(false)}
                teamName={pickerContext.team === 'home' ? matchData.teamHome : matchData.teamAway}
                roster={pickerContext.team === 'home' ? homeRoster : awayRoster}
                lineup={pickerContext.team === 'home' ? homeLineup : awayLineup}
                liberos={pickerContext.team === 'home' ? homeLiberos : awayLiberos}
                onSelect={handlePlayerSelect}
                context={pickerContext}
            />

            <LineupModal
                isOpen={showLineupModal}
                onClose={() => setShowLineupModal(false)}
                teamHome={matchData.teamHome}
                teamAway={matchData.teamAway}
                homeLineup={homeLineup}
                awayLineup={awayLineup}
                homeLiberos={homeLiberos}
                awayLiberos={awayLiberos}
                onSlotClick={openPickerForLineup}
                onConfirm={handleLineupConfirm}
                homeRoster={homeRoster}
                awayRoster={awayRoster}
                teamColors={teamColors}
                onSetRoster={() => { setShowSetup(true); setShowLineupModal(false); }}
                onColorChange={(team, color) => setTeamColors(prev => ({ ...prev, [team]: color }))}
                onClearTeamLineup={(team) => {
                    if (team === 'home') {
                        setHomeLineup(Array(6).fill(null));
                    } else {
                        setAwayLineup(Array(6).fill(null));
                    }
                }}
                signatures={matchSignatures}
                onSignaturesChange={setMatchSignatures}
            />

            <ManualEditModal
                isOpen={showManualEditModal}
                onClose={() => setShowManualEditModal(false)}
                teamHome={matchData.teamHome}
                teamAway={matchData.teamAway}
                score={score}
                currentSet={matchData.currentSet}
                onConfirm={handleManualEdit}
            />

            <MatchLogModal
                isOpen={showMatchLogModal}
                onClose={() => setShowMatchLogModal(false)}
                events={matchEvents}
            />

            <SubstitutionModal
                isOpen={subData.isOpen}
                onClose={() => setSubData({ isOpen: false, team: null, posIndex: null, playerOut: null })}
                teamName={subData.team === 'home' ? matchData.teamHome : matchData.teamAway}
                roster={subData.team === 'home' ? homeRoster : awayRoster}
                currentLineup={subData.team === 'home' ? homeLineup : awayLineup}
                playerOut={subData.playerOut}
                posIndex={subData.posIndex}
                subTracker={subData.team ? subTracker[subData.team] : null}
                liberoTracker={subData.team ? liberoTracker[subData.team] : null}
                disqualifiedPlayers={subData.team ? disqualifiedPlayers[subData.team] : []} //ส่งเฉพาะอาเรย์ของทีมนั้น
                initialExceptional={subData.isExceptional}
                onConfirm={handleSubstitutionConfirm}
            />

            <SanctionModal
                isOpen={showSanctionModal}
                onClose={() => setShowSanctionModal(false)}
                teamName={sanctionTeam === 'home' ? matchData.teamHome : matchData.teamAway}
                roster={sanctionTeam === 'home' ? homeRoster : awayRoster}
                onConfirm={handleSanction}
            />

            <ChallengeModal
                isOpen={showChallengeModal}
                onClose={() => setShowChallengeModal(false)}
                teamName={challengeData.team === 'home' ? matchData.teamHome : matchData.teamAway}
                remaining={challengeData.team ? challenges[challengeData.team] : 0}
                onConfirm={handleChallengeSelect}
            />

            {/* Custom FIVB Challenge Request Confirmation Modal */}
            <ChallengeConfirmModal
                key={activeChallengeRequest?.id || 'none'}
                isOpen={showChallengeRequestPopup && challengeConfirmMode}
                activeChallengeRequest={activeChallengeRequest}
                matchData={matchData}
                teamColors={teamColors}
                onClose={handlePostponeChallenge}
                onConfirm={handleConfirmChallengeReview}
                onBack={() => {
                    setChallengeConfirmMode(false);
                }}
            />

            <CoinTossModal
                key={showCoinTossModal}
                isOpen={showCoinTossModal}
                teamHome={matchData.teamHome}
                teamAway={matchData.teamAway}
                teamColors={teamColors}
                onConfirm={handleCoinTossConfirm}
            />

            <LiberoSwapModal
                isOpen={showLiberoSwapModal}
                onClose={() => {
                    setShowLiberoSwapModal(false);
                    setLiberoSwapTeam(null);
                }}
                teamCode={liberoSwapTeam}
                teamName={liberoSwapTeam === 'home' ? matchData.teamHome : matchData.teamAway}
                lineup={liberoSwapTeam === 'home' ? homeLineup : awayLineup}
                roster={liberoSwapTeam === 'home' ? homeRoster : awayRoster}
                liberos={liberoSwapTeam === 'home' ? homeLiberos : awayLiberos}
                servingTeam={servingTeam}
                onConfirm={handleLiberoConfirm}
            />

            {/* --- NEW STAFF REQUEST MODALS --- */}
            <StaffRequestModal
                isOpen={!!(pendingRequests.filter(r => r.request_type !== 'CHALLENGE')[0])}
                request={pendingRequests.filter(r => r.request_type !== 'CHALLENGE')[0]}
                matchData={matchData}
                teamColors={teamColors}
                onAccept={handleApproveRequest}
                onReject={handleRejectRequest}
            />

            <StaffChallengeRequestModal
                isOpen={showChallengeRequestPopup && !challengeConfirmMode}
                request={activeChallengeRequest}
                matchData={matchData}
                teamColors={teamColors}
                popupTimeLeft={popupTimeLeft}
                isChallengeExpired={isChallengeExpired}
                onAccept={handleAcceptChallenge}
                onInvalid={handleInvalidChallenge}
                onPostpone={handlePostponeChallenge}
            />
        </div>
    );
}
