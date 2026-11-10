import { useLanguage } from '../context/LanguageContext';
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getSocketServerUrl } from '../api';
import Swal from 'sweetalert2';
import { getAuthToken, getStoredUser } from '../auth/authStorage';
import { isLocalVis } from '../offline/offlineStore';

export default function useVisScorer(match, requestedReadOnly) {
    const { language } = useLanguage();
    const [snapshot, setSnapshot] = useState(null);
    const [roster, setRoster] = useState(null);
    const [events, setEvents] = useState([]);
    const [rallies, setRallies] = useState([]);
    const [contextChoice, setContextChoice] = useState('current');
    const [loadError, setLoadError] = useState('');
    const [syncError, setSyncError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pending, setPending] = useState(null);
    const [lastSavedOperationId, setLastSavedOperationId] = useState(null);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const selectionContext = useRef(null);
    const busy = useRef(false);
    const mutationEpoch = useRef(0);
    const pendingRef = useRef(null);
    const refreshRef = useRef(null);
    const pendingKey = `vis_statistics_pending_${match.id}`;
    const clockOwner = getStoredUser()?.id || 'guest';
    const [draftClock, setDraftClock] = useState(null);
    const clockStarts = useRef({});
    useEffect(() => {
        const setNumber = snapshot?.currentSet;
        if (!setNumber) return;
        try {
            const startedAt = sessionStorage.getItem(`vis-clock:${clockOwner}:${match.id}:${setNumber}`);
            if (startedAt && Number.isFinite(Date.parse(startedAt))) { clockStarts.current[setNumber] = startedAt; setDraftClock({ setNumber, startedAt }); }
        } catch { /* Timing still works in memory when storage is unavailable. */ }
    }, [match.id, clockOwner, snapshot?.currentSet]);
    const startSetClock = () => {
        if (!snapshot || snapshot.phase === 'MATCH_FINISHED' || contextChoice !== 'current' || !snapshot.setupComplete) return null;
        const setNumber = snapshot.currentSet;
        const recorded = snapshot.timing?.sets.find(set => set.set === setNumber)?.startedAt;
        const startedAt = recorded || clockStarts.current[setNumber] || new Date().toISOString();
        clockStarts.current[setNumber] = startedAt;
        setDraftClock(previous => previous?.setNumber === setNumber && previous.startedAt === startedAt ? previous : { setNumber, startedAt });
        try { sessionStorage.setItem(`vis-clock:${clockOwner}:${match.id}:${setNumber}`, startedAt); } catch { /* Optional draft clock cache. */ }
        return startedAt;
    };
    const clearPending = () => {
        pendingRef.current = null; setPending(null);
        try { localStorage.removeItem(pendingKey); } catch { /* Optional retry cache. */ }
    };
    const resetSelection = () => {
        setSelectedTeam(null); setSelectedPlayer(null); setSelectedSkill(null);
        selectionContext.current = null;
    };
    useEffect(() => {
        if (selectionContext.current?.key && selectionContext.current.key !== snapshot?.context.key) {
            selectionContext.current = null;
            setSelectedTeam(null); setSelectedPlayer(null); setSelectedSkill(null);
        }
    }, [snapshot?.context.key]);
    useEffect(() => {
        let disposed = false, refreshing = false;
        const refresh = async (initial = false) => {
            if (disposed || refreshing || busy.current) return;
            refreshing = true;
            const epoch = mutationEpoch.current;
            try {
                const [saved, rosters] = await Promise.all([api.getVisState(match.id), api.getMatchRosterData(match.id)]);
                if (disposed || busy.current || epoch !== mutationEpoch.current) return;
                setSnapshot(saved.data.state); setEvents(saved.data.events); setRallies(saved.data.rallies || []);
                setRoster(rosters.data); setSyncError(false); setLoadError('');
                if (initial) {
                    let stored;
                    try { stored = JSON.parse(localStorage.getItem(`vis_statistics_pending_${match.id}`) || 'null'); } catch { /* Invalid cache. */ }
                    if (stored && !saved.data.operations.includes(stored.operationId)) { pendingRef.current = stored; setPending(stored); }
                    else { try { localStorage.removeItem(`vis_statistics_pending_${match.id}`); } catch { /* Optional cache. */ } }
                }
            } catch (error) {
                if (!disposed) {
                    setSyncError(true);
                    if (initial) setLoadError(error.response?.data?.error || 'ไม่สามารถโหลดข้อมูลจาก eScoreControl ได้');
                }
            } finally { refreshing = false; }
        };
        refreshRef.current = refresh;
        void refresh(true);
        const socket = isLocalVis(match.id) ? null : io(getSocketServerUrl(), { withCredentials: true, auth: { token: getAuthToken() } });
        socket?.on('connect', () => { socket.emit('join_match', { matchId: match.id, role: 'viewer' }); void refresh(); });
        for (const name of ['live_state_updated', 'match_updated', 'vis_statistics_updated']) socket?.on(name, () => { void refresh(); });
        const interval = setInterval(() => { void refresh(); }, 2500);
        return () => { disposed = true; clearInterval(interval); socket?.disconnect(); refreshRef.current = null; };
    }, [match.id]);

    const historical = contextChoice === 'current' ? null : rallies.find(item => String(item.pointEventId) === contextChoice);
    const activeContext = contextChoice === 'current' ? snapshot?.context : historical;
    const commandContext = activeContext ? contextChoice === 'current' ? { key: activeContext.key } : { pointEventId: activeContext.pointEventId } : null;
    const send = async (command, retry = false, operationId = null) => {
        if (busy.current || !snapshot || requestedReadOnly || (!retry && pendingRef.current)) return false;
        mutationEpoch.current++;
        busy.current = true; setIsSaving(true);
        const operation = retry ? pendingRef.current : { operationId: operationId || crypto.randomUUID(), revision: snapshot.revision,
            timing: ['STAT', 'RALLY'].includes(command?.type) ? { setNumber: snapshot.currentSet, recordedAt: new Date().toISOString(), setStartedAt: startSetClock() } : undefined,
            command: ['STAT', 'RALLY'].includes(command?.type) ? { ...command, context: command.context || commandContext } : command };
        if (!operation) { busy.current = false; setIsSaving(false); return false; }
        pendingRef.current = operation; setPending(operation);
        try { localStorage.setItem(pendingKey, JSON.stringify(operation)); } catch { /* Optional cache. */ }
        try {
            const response = await api.saveVisCommand(match.id, operation);
            setSnapshot(response.data.state);
            if (response.data.duplicate) {
                const saved = await api.getVisState(match.id);
                setSnapshot(saved.data.state); setEvents(saved.data.events); setRallies(saved.data.rallies || []);
            } else {
                if (response.data.event) setEvents(previous => [response.data.event, ...previous]);
                if (response.data.events) setEvents(previous => [...response.data.events, ...previous]);
                if (response.data.deletedEventIds) setEvents(previous => previous.filter(event => !response.data.deletedEventIds.map(String).includes(String(event.id))));
                if (response.data.deletedEventId) setEvents(previous => previous.filter(event => String(event.id) !== String(response.data.deletedEventId)));
            }
            clearPending(); resetSelection(); setLastSavedOperationId(operation.operationId);
            return true;
        } catch (error) {
            try {
                const saved = await api.getVisState(match.id);
                setSnapshot(saved.data.state); setEvents(saved.data.events); setRallies(saved.data.rallies || []);
                if (saved.data.operations.includes(operation.operationId)) {
                    clearPending(); resetSelection(); setLastSavedOperationId(operation.operationId); return true;
                }
                if (error.response?.status >= 400 && error.response?.status < 500) clearPending();
            } catch { /* Ambiguous results retain their original operation ID. */ }
            await Swal.fire(language === 'ENG' ? 'Could not save statistics' : 'บันทึกสถิติไม่สำเร็จ', error.response?.data?.error || (language === 'ENG' ? 'Check your connection and retry the same save.' : 'ตรวจสอบการเชื่อมต่อ แล้วลองบันทึกเดิมอีกครั้ง'), 'error');
            return false;
        } finally {
            busy.current = false; setIsSaving(false);
            void refreshRef.current?.();
        }
    };
    const matchData = { ...match, ...roster?.match,
        max_sets: snapshot?.maxSets ?? roster?.match?.max_sets ?? match.max_sets,
        home_team: roster?.match?.home_team_name || match.home_team,
        away_team: roster?.match?.away_team_name || match.away_team };
    const formatPlayers = players => (players || []).map(player => ({ ...player, name_th: [player.first_name_th,player.last_name_th].filter(Boolean).join(' '), name_en: [player.first_name_en,player.last_name_en].filter(Boolean).join(' '), id: Number(player.id), name: [player[language === 'ENG' ? 'first_name_en' : 'first_name_th'], player[language === 'ENG' ? 'last_name_en' : 'last_name_th']].filter(Boolean).join(' ') || player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() }));
    const homePlayers = formatPlayers(roster?.home?.players), awayPlayers = formatPlayers(roster?.away?.players);
    const findPlayer = (team, id) => (team === 'home' ? homePlayers : awayPlayers).find(player => player.id === Number(id)) || (id ? { id: Number(id), number: '?', name: language === 'ENG' ? 'Unknown player' : 'ไม่พบชื่อ' } : null);
    const lineups = activeContext?.lineups || snapshot?.lineups || { home: [], away: [] };
    const homeRotation = lineups.home.map(id => findPlayer('home', id)), awayRotation = lineups.away.map(id => findPlayer('away', id));
    const phase = snapshot?.phase;
    const isReadOnly = requestedReadOnly || snapshot?.isReadOnly || phase === 'MATCH_FINISHED' || !activeContext
        || isSaving || Boolean(pending) || syncError;
    const serverId = historical?.serverPlayerId || (snapshot?.servingTeam ? snapshot.lineups[snapshot.servingTeam]?.[0] : null);
    const serverTeam = historical ? (homePlayers.some(player => player.id === Number(serverId)) ? 'home' : 'away') : snapshot?.servingTeam;
    return { liberoReplacements: snapshot?.liberoReplacements || {}, timing: snapshot?.timing, draftClock, startSetClock, setLineups: snapshot?.setLineups || {},
        matchData, homeStaff: roster?.home?.staff || [], awayStaff: roster?.away?.staff || [], homePlayers, awayPlayers, homeRotation, awayRotation,
        homeLibero: findPlayer('home', snapshot?.liberoReplacements?.home?.libero || homePlayers.find(player => ['L', 'L1', 'L2', 'LIBERO'].includes(String(player.position || player.role).toUpperCase()) || Number(player.is_libero1) === 1 || Number(player.is_libero2) === 1)?.id),
        awayLibero: findPlayer('away', snapshot?.liberoReplacements?.away?.libero || awayPlayers.find(player => ['L', 'L1', 'L2', 'LIBERO'].includes(String(player.position || player.role).toUpperCase()) || Number(player.is_libero1) === 1 || Number(player.is_libero2) === 1)?.id),
        homeSubs: homePlayers.filter(player => !homeRotation.some(item => item.id === player.id)),
        awaySubs: awayPlayers.filter(player => !awayRotation.some(item => item.id === player.id)),
        timeouts: snapshot?.timeouts || { home: 0, away: 0 }, substitutions: snapshot?.substitutions || { home: 0, away: 0 },
        substitutionLimit: snapshot?.substitutionLimit || 6,
        phase, isReadOnly, isSaving, pending, loadError, syncError, loading: !snapshot || !roster, lastSavedOperationId,
        requiresToss: snapshot?.requiresToss, setupComplete: snapshot?.setupComplete, officialReady: snapshot?.officialReady, rallies, contextChoice, activeContext, commandContext,
        setContextChoice: value => { setContextChoice(value); resetSelection(); },
        teamA: snapshot?.firstSetHomeLeft === false ? 'away' : 'home',
        currentSet: snapshot?.currentSet || 1, pointScore: snapshot?.score || { home: 0, away: 0 },
        setScores: snapshot?.completedSets || [], setWins: snapshot?.setsWon || { home: 0, away: 0 },
        servingTeam: serverTeam, server: serverId && serverTeam ? findPlayer(serverTeam, serverId) : null,
        isHomeLeft: historical?.isHomeLeft ?? snapshot?.isHomeLeft ?? true,
        actionLog: events.map(event => ({ ...event, set_number: event.set_id })), history: snapshot?.history || [],
        selectedTeam, selectedPlayer, selectedSkill,
        handlePlayerSelect: (team, player) => { if (!isReadOnly) { setSelectedTeam(team); setSelectedPlayer(player); setSelectedSkill(null); selectionContext.current = commandContext; } },
        handleSkillSelect: skill => { if (!isReadOnly) setSelectedSkill(skill); },
        handleGradeSelect: grade => { if (!isReadOnly && selectedPlayer && selectedSkill) return send({ type: 'STAT', team: selectedTeam, player: selectedPlayer.id, skill: selectedSkill, grade: grade.code, context: selectionContext.current }); },
        handleUndo: () => send({ type: 'UNDO' }), retrySave: () => send(null, true), send, resetSelection,
    };
}
