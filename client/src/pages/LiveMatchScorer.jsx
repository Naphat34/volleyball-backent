import React, { useState, useEffect } from 'react';
import { 
    User, Activity, CheckCircle, XCircle, PlayCircle, RotateCcw, 
    ArrowRightLeft, Clock, AlertTriangle, FileText 
} from 'lucide-react';
import { api } from '../api';
import { generateScoresheetPDF } from '../utils/pdfGenerator';
import Swal from 'sweetalert2';
import LineupSelector from '../components/LineupSelector';
import { formatThaiTime } from '../utils';

// ============================================================================
// HELPER FUNCTIONS - Volleyball Logic
// ============================================================================

const isSetOver = (homeScore, awayScore, setNumber, maxSets) => {
    const isFinalSet = setNumber === maxSets;
    const targetScore = isFinalSet ? 15 : 25;
    
    if (homeScore >= targetScore && homeScore >= awayScore + 2) return true;
    if (awayScore >= targetScore && awayScore >= homeScore + 2) return true;
    
    return false;
};

const isMatchOver = (homeSets, awaySets, maxSets) => {
    const setsToWin = Math.ceil(maxSets / 2);
    return homeSets >= setsToWin || awaySets >= setsToWin;
};

const SKILLS = [
    { code: 'S', name: 'Serve', icon: '🏐' },
    { code: 'R', name: 'Receive', icon: '📥' },
    { code: 'A', name: 'Attack', icon: '⚡' },
    { code: 'B', name: 'Block', icon: '🧱' },
    { code: 'D', name: 'Dig', icon: '🛡️' },
    { code: 'E', name: 'Set', icon: '🤲' },
];

const GRADES = [
    { code: '#', name: 'Point / Ace / Kill', color: 'bg-gradient-to-r from-green-600 to-green-700', score: true },
    { code: '+', name: 'Good', color: 'bg-gradient-to-r from-blue-600 to-blue-700', score: false },
    { code: '!', name: 'Continue / In Play', color: 'bg-gradient-to-r from-yellow-600 to-yellow-700', score: false },
    { code: '-', name: 'Poor', color: 'bg-gradient-to-r from-orange-600 to-orange-700', score: false },
    { code: '=', name: 'Error / Fault', color: 'bg-gradient-to-r from-red-600 to-red-700', score: true, opponentScore: true },
];

// ============================================================================
// COMPONENT: Player Button
// ============================================================================

const PlayerButton = ({ 
    team, 
    player, 
    selectedPlayer, 
    onSelect, 
    onBench = false,
    onCourt = false,
    isServer = false, 
    isLibero = false, 
    isReadOnly = false 
}) => {
    const isSelected = selectedPlayer?.id === player.id;
    
    let buttonClass = 'aspect-square rounded-md text-center flex items-center justify-center transition-all duration-200 relative group shadow-md';
    
    if (isSelected) {
        buttonClass += team === 'home' 
            ? ' bg-gradient-to-br from-indigo-600 to-indigo-700 ring-4 ring-white shadow-xl shadow-indigo-500/50' 
            : ' bg-gradient-to-br from-rose-600 to-rose-700 ring-4 ring-white shadow-xl shadow-rose-500/50';
    } else if (onBench) {
        buttonClass += ' bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 opacity-90';
    } else if (onCourt) {
        buttonClass += isReadOnly 
            ? ' bg-gradient-to-br from-gray-700 to-gray-800 cursor-default' 
            : ' bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 hover:scale-110 hover:shadow-xl';
    } else {
        buttonClass += isReadOnly 
            ? ' bg-gradient-to-br from-gray-700 to-gray-800 cursor-default' 
            : ' bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 hover:scale-105';
    }
    
    if (isLibero && !onBench) {
        buttonClass += ' border-2 border-yellow-500 ring-2 ring-yellow-500/30';
    }

    // Different text sizes based on location
    const numberSize = onCourt ? 'text-xl md:text-2xl lg:text-4xl' : (onBench ? 'text-lg md:text-xl lg:text-2xl' : 'text-2xl md:text-3xl');

    return (
        <button 
            onClick={isReadOnly ? undefined : () => onSelect(team, player)}
            disabled={isReadOnly}
            className={buttonClass}
            title={player.name}
        >
            {isServer && !onCourt && (
                <div 
                    className="absolute -top-2 -left-2 w-4 h-4 bg-yellow-400 rounded-full 
                               border-2 border-gray-800 z-10 animate-pulse" 
                    title="Server"
                />
            )}
            
            {isLibero && (
                <div 
                    className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-yellow-500 
                               text-black text-[8px] font-bold rounded-full shadow-md" 
                    title="Libero"
                >
                    L
                </div>
            )}
            
            <span className={`font-mono font-semibold ${numberSize} text-white drop-shadow-lg`}>{player.number}</span>
        </button>
    );
};

// ============================================================================
// COMPONENT: Court Layout (FIVB Style)
// ============================================================================

const CourtLayout = ({ 
    rotation, 
    team, 
    libero, 
    selectedPlayer, 
    onSelect, 
    server, 
    isReadOnly, 
    isHome 
}) => {
    if (rotation.length < 6) {
        return (
            <div className="grid grid-cols-2 grid-rows-3 gap-2 w-full h-full bg-orange-100/5 
                          rounded-lg p-2 border-2 border-dashed border-gray-700/50">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-gray-700/30 rounded-md animate-pulse" />
                ))}
            </div>
        );
    }
    
    // Map rotation array to court positions (P1 = index 0, P2 = index 1, etc.)
    const positions = {
        p1: rotation[0], p2: rotation[1], p3: rotation[2],
        p4: rotation[3], p5: rotation[4], p6: rotation[5],
    };

    const renderPlayerButton = (player) => (
        <div className="relative w-full h-full flex items-center justify-center p-1">
            <div className="w-10 h-10 md:w-14 md:h-14 lg:w-20 lg:h-20">
                <PlayerButton
                    team={team}
                    player={player}
                    selectedPlayer={selectedPlayer}
                    onSelect={onSelect}
                    isReadOnly={isReadOnly}
                    isLibero={libero?.id === player.id}
                    onCourt={true}
                />
            </div>
            
            {server?.id === player.id && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-br from-orange-400 to-orange-500 
                              rounded-full p-2 shadow-2xl z-20 border-3 border-white animate-bounce 
                              ring-2 ring-orange-300">
                    <span className="text-2xl drop-shadow-lg">🏐</span>
                </div>
            )}
        </div>
    );

    const cellClass = "flex justify-center items-center";

    return (
        <div className="relative w-full h-full">
            {/* 3-Meter Attack Line (White) */}
            <div className={`absolute ${isHome ? 'right-[33.33%]' : 'left-[33.33%]'} top-0 bottom-0 w-0.5 bg-white z-10`} />
            
            <div className="grid grid-cols-2 grid-rows-3 h-full w-full relative z-10">
                {isHome ? (
                    <>
                        {/* Home Team Layout (Net on Right) */}
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p5)} {/* Z5 Back-Left */}
                        </div>
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p4)} {/* Z4 Front-Left */}
                        </div>
                        
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p6)} {/* Z6 Back-Center */}
                        </div>
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p3)} {/* Z3 Front-Center */}
                        </div>
                        
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p1)} {/* Z1 Back-Right */}
                        </div>
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p2)} {/* Z2 Front-Right */}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Away Team Layout (Net on Left) */}
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p2)} {/* Z2 Front-Right */}
                        </div>
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p1)} {/* Z1 Back-Right */}
                        </div>
                        
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p3)} {/* Z3 Front-Center */}
                        </div>
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p6)} {/* Z6 Back-Center */}
                        </div>
                        
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p4)} {/* Z4 Front-Left */}
                        </div>
                        <div className={cellClass}>
                            {renderPlayerButton(positions.p5)} {/* Z5 Back-Left */}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT: Live Match Scorer
// ============================================================================

export default function LiveMatchScorer({ match, onClose, isReadOnly = false }) {
    
    // ------------------------------------------------------------------------
    // STATE MANAGEMENT
    // ------------------------------------------------------------------------
    
    // Match Data
    const [matchData, setMatchData] = useState(match || {});
    const [homePlayers, setHomePlayers] = useState([]);
    const [awayPlayers, setAwayPlayers] = useState([]);

    // Phase 1: Lineup Setup
    const [lineupSubmitted, setLineupSubmitted] = useState(isReadOnly);
    const [homeLineupConfirmed, setHomeLineupConfirmed] = useState(false);
    const [awayLineupConfirmed, setAwayLineupConfirmed] = useState(false);


    // Team Compositions
    const [homeSubs, setHomeSubs] = useState([]);
    const [homeLibero, setHomeLibero] = useState(null);
    
    const [awaySubs, setAwaySubs] = useState([]);
    const [awayLibero, setAwayLibero] = useState(null);

    // Court Rotations
    const [homeRotation, setHomeRotation] = useState([]); 
    const [awayRotation, setAwayRotation] = useState([]);

    // Game State
    const [matchStarted, setMatchStarted] = useState(isReadOnly);
    const [isHomeLeft, setIsHomeLeft] = useState(true);
    const [currentSet, setCurrentSet] = useState(1);
    const [pointScore, setPointScore] = useState({ home: 0, away: 0 });
    const [setScores, setSetScores] = useState([]); 
    const [setWins, setSetWins] = useState({ home: 0, away: 0 });
    const [servingTeam, setServingTeam] = useState(null); 
    const [server, setServer] = useState(null); 
    const [actionLog, setActionLog] = useState([]);

    // Match Management
    const [timeouts, setTimeouts] = useState({ home: 0, away: 0 });
    const [subCounts, setSubCounts] = useState({ home: 0, away: 0 });
    
    // UI State
    const [selectedTeam, setSelectedTeam] = useState(null); 
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const [showSubModal, setShowSubModal] = useState(false);
    const [subData, setSubData] = useState({ team: 'home', playerOut: null, playerIn: null });
    const [showSanctionModal, setShowSanctionModal] = useState(false);
    const [sanctionData, setSanctionData] = useState({ team: 'home', player: null, type: 'yellow' });
    
    // History for Undo
    const [history, setHistory] = useState([]);

    // Effect to check if both lineups are confirmed
    useEffect(() => {
        if (homeLineupConfirmed && awayLineupConfirmed) {
            const timeout = setTimeout(() => {
                setLineupSubmitted(true);
                
                // Add Lineup to Action Log
                const homeNumbers = homeRotation.map(p => p.number).join(', ');
                const awayNumbers = awayRotation.map(p => p.number).join(', ');
                
                setActionLog(prev => [{
                    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    set_number: currentSet,
                    team_id: null,
                    player_id: null,
                    skill: 'LINEUP_CONFIRM',
                    grade: '!',
                    score_home: pointScore.home,
                    score_away: pointScore.away,
                    description: `Lineup Confirmed - ${matchData.home_team}: [${homeNumbers}] | ${matchData.away_team}: [${awayNumbers}]`,
                    time: formatThaiTime(new Date())
                }, ...prev]);
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [homeLineupConfirmed, awayLineupConfirmed, homeRotation, awayRotation, currentSet, pointScore, matchData]);

    // ------------------------------------------------------------------------
    // LOCAL STORAGE SYNC FOR REFEREE VIEW
    // ------------------------------------------------------------------------
    useEffect(() => {
        const syncData = () => {
            if (!match?.id) return;

            const matchId = match.id;

            // Helper to set item
            const setItem = (key, value) => {
                try {
                    localStorage.setItem(`match_${matchId}_${key}`, JSON.stringify(value));
                } catch (e) {
                    console.error(`Failed to save ${key} to localStorage`, e);
                }
            };

            setItem('matchData', {
                teamHome: matchData.home_team,
                teamAway: matchData.away_team,
                currentSet: currentSet,
            });
            setItem('score', pointScore);
            setItem('setsWon', setWins);
            setItem('timeouts', timeouts);
            setItem('substitutions', subCounts);
            setItem('servingTeam', servingTeam);
            setItem('isHomeLeft', isHomeLeft);
            setItem('homeLineup', homeRotation);
            setItem('awayLineup', awayRotation);
            setItem('homeLiberos', { l1: homeLibero, l2: null });
            setItem('awayLiberos', { l1: awayLibero, l2: null });
        };

        syncData();
    }, [
        match, matchData, currentSet, pointScore, setWins, timeouts, subCounts,
        servingTeam, isHomeLeft, homeRotation, awayRotation, homeLibero, awayLibero
    ]);

    // ------------------------------------------------------------------------
    // INITIAL DATA LOADING
    // ------------------------------------------------------------------------
    
    useEffect(() => {
        const fetchRosters = async () => {
            if (!match) return;
            
            try {
                const [homeRes, awayRes] = await Promise.all([
                    api.getPlayersByTeam(match.home_team_id),
                    api.getPlayersByTeam(match.away_team_id)
                ]);
                
                const formatPlayers = (players) => players.map(p => ({
                    ...p,
                    name: p.name || `${p.first_name} ${p.last_name}`.trim()
                }));

                const hPlayers = formatPlayers(homeRes.data);
                const aPlayers = formatPlayers(awayRes.data);

                setHomePlayers(hPlayers);
                setAwayPlayers(aPlayers);

                // ReadOnly Mode: Auto-setup
                if (isReadOnly) {
                    const hStart = hPlayers.slice(0, 6);
                    const aStart = aPlayers.slice(0, 6);
                    
                    setHomeRotation(hStart);
                    setHomeSubs(hPlayers.slice(6));
                    
                    setAwayRotation(aStart);
                    setAwaySubs(aPlayers.slice(6));
                    
                    setServingTeam('home');
                    setServer(hStart[0]);
                    setMatchStarted(true);
                }
            } catch (err) {
                console.error("Failed to load rosters:", err);
                Swal.fire('Error', 'Failed to load team rosters', 'error');
            }
        };

        if (match) {
            const timeout = setTimeout(() => {
                setMatchData(match);
                fetchRosters();
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [match, isReadOnly]);

    // ------------------------------------------------------------------------
    // HISTORY & UNDO MANAGEMENT
    // ------------------------------------------------------------------------
    
    const saveStateToHistory = () => {
        setHistory(prevHistory => [
            ...prevHistory,
            {
                pointScore, setScores, setWins, currentSet, servingTeam, server,
                homeRotation, awayRotation, homeSubs, awaySubs,
                timeouts, subCounts, actionLog,
            }
        ]);
    };

    const handleUndo = () => {
        if (history.length === 0) {
            Swal.fire('Cannot Undo', 'No previous action to undo.', 'info');
            return;
        }

        const lastState = history[history.length - 1];
        
        setPointScore(lastState.pointScore);
        setSetScores(lastState.setScores);
        setSetWins(lastState.setWins);
        setCurrentSet(lastState.currentSet);
        setServingTeam(lastState.servingTeam);
        setServer(lastState.server);
        setHomeRotation(lastState.homeRotation);
        setAwayRotation(lastState.awayRotation);
        setHomeSubs(lastState.homeSubs);
        setAwaySubs(lastState.awaySubs);
        setTimeouts(lastState.timeouts);
        setSubCounts(lastState.subCounts);
        setActionLog(lastState.actionLog);

        setHistory(prevHistory => prevHistory.slice(0, -1));
        setSelectedPlayer(null);
        setSelectedSkill(null);
        setSelectedTeam(null);
    };

    // ------------------------------------------------------------------------
    // LINEUP HANDLERS
    // ------------------------------------------------------------------------
    
    const handleLineupSubmit = (teamType, starters, libero) => {
        const isHome = teamType === 'home';
        const teamId = isHome ? matchData.home_team_id : matchData.away_team_id;
        
        api.saveLineup(matchData.id, {
            team_id: teamId,
            set_number: currentSet,
            player_positions: starters.map(p => p.id),
            libero_id: libero?.id || null
        }).catch(err => console.error(`Error saving ${teamType} lineup`, err));

        if (isHome) {
            setHomeRotation(starters);
            setHomeLibero(libero);
            setHomeSubs(homePlayers.filter(p => !starters.find(s => s.id === p.id) && p.id !== libero?.id));
            setHomeLineupConfirmed(true);
            checkLineupComplete(true, awayLineupConfirmed);
        } else {
            setAwayRotation(starters);
            setAwayLibero(libero);
            setAwaySubs(awayPlayers.filter(p => !starters.find(s => s.id === p.id) && p.id !== libero?.id));
            setAwayLineupConfirmed(true);
            checkLineupComplete(homeLineupConfirmed, true);
        }
    };

    const handleHomeLineup = (starters, libero) => handleLineupSubmit('home', starters, libero);
    const handleAwayLineup = (starters, libero) => handleLineupSubmit('away', starters, libero);

    const checkLineupComplete = (homeDone, awayDone) => {
        if (homeDone && awayDone) {
            setLineupSubmitted(true);
        }
    };

    // ------------------------------------------------------------------------
    // GAME LOGIC
    // ------------------------------------------------------------------------
    
    const handleRotate = (teamToRotate) => {
        const rotateArray = (arr) => [...arr.slice(1), arr[0]];

        if (teamToRotate === 'home') {
            const newRot = rotateArray(homeRotation);
            setHomeRotation(newRot);
            setServer(newRot[0]);
        } else {
            const newRot = rotateArray(awayRotation);
            setAwayRotation(newRot);
            setServer(newRot[0]);
        }
    };

    const handlePlayerSelect = (team, player) => {
        setSelectedTeam(team);
        setSelectedPlayer(player);
        setSelectedSkill(null);
    };

    const handleSkillSelect = (skillCode) => {
        setSelectedSkill(skillCode);
    };

    const handleGradeSelect = (grade) => {
        if (!selectedPlayer || !selectedSkill || isReadOnly) return;

        const rallyWinner = grade.code === '#' 
            ? selectedTeam 
            : (grade.code === '=' ? (selectedTeam === 'home' ? 'away' : 'home') : null);
        
        if (!rallyWinner) {
            resetSelection();
            return;
        }

        addPoint(rallyWinner, selectedPlayer, selectedSkill, grade.code);
    };

    const addPoint = (winner, player, skill, grade) => {
        saveStateToHistory();
        
        const prevServingTeam = servingTeam;
        const newPointScore = { ...pointScore, [winner]: pointScore[winner] + 1 };
        setPointScore(newPointScore);

        if (winner !== prevServingTeam) {
            handleRotate(winner);
        }
        setServingTeam(winner);

        // Check Set/Match End
        const maxSets = matchData.max_sets || 5;
        
        if (isSetOver(newPointScore.home, newPointScore.away, currentSet, maxSets)) {
            handleSetEnd(newPointScore, maxSets, winner);
        }

        // Log Action
    const actionTeamId = selectedTeam === 'home' ? match.home_team_id : match.away_team_id;
    const skillName = SKILLS.find(s => s.code === skill)?.name || 'Action';
    const gradeName = GRADES.find(g => g.code === grade)?.name || 'Result';
    const description = `${skillName} (${gradeName}) by #${player.number}`;

        logAction({
            match_id: match.id,
            set_number: currentSet,
        // Log the team of the player who performed the action, not who won the point
        team_id: actionTeamId,
            player_id: player?.id,
            skill,
            grade,
            score_home: newPointScore.home,
            score_away: newPointScore.away,
        description: description
        });

        resetSelection();
    };

    const handleSetEnd = (finalScore, maxSets, winner) => {
        // 1. Save Set Result to DB
        api.endSet(matchData.id, {
            setNumber: currentSet,
            homeScore: finalScore.home,
            awayScore: finalScore.away,
            duration: 0 // TODO: Track duration if needed
        }).catch(err => console.error("Failed to save set result:", err));

        const newSetScores = [...setScores, finalScore];
        setSetScores(newSetScores);

        const newSetWins = { ...setWins };
        if (finalScore.home > finalScore.away) {
            newSetWins.home += 1;
        } else {
            newSetWins.away += 1;
        }
        setSetWins(newSetWins);

        if (isMatchOver(newSetWins.home, newSetWins.away, maxSets)) {
            const winnerTeam = winner === 'home' ? matchData.home_team : matchData.away_team;
            Swal.fire({
                title: 'Match Over!',
                text: `${winnerTeam} wins the match!`,
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
        } else {
            const nextSetNumber = currentSet + 1;
            setCurrentSet(nextSetNumber);
            api.startSet(matchData.id, { setNumber: nextSetNumber })
               .catch(err => console.error("Failed to save set start time:", err));
            
            setPointScore({ home: 0, away: 0 });
            setTimeouts({ home: 0, away: 0 });
            setSubCounts({ home: 0, away: 0 });
            setServingTeam(winner);
            
            if (winner === 'home') {
                setServer(homeRotation[0]);
            } else {
                setServer(awayRotation[0]);
            }
        }
    };

    const resetSelection = () => {
        setSelectedPlayer(null);
        setSelectedSkill(null);
        setSelectedTeam(null);
    };

    const logAction = (payload) => {
        api.saveMatchEvent(matchData.id, {
            set_number: payload.set_number,
            event_type: payload.skill, // Use skill code as event type
            team_id: payload.team_id,
            player_id: payload.player_id,
            score_home: payload.score_home,
            score_away: payload.score_away,
            skill: payload.skill,
            grade: payload.grade,
            details: { description: payload.description }
        }).catch(err => console.error("Error saving action", err));

        setActionLog(prev => [payload, ...prev]);
    };

    // ------------------------------------------------------------------------
    // SUBSTITUTION LOGIC
    // ------------------------------------------------------------------------
    
    const performSubstitution = () => {
        const { team, playerOut, playerIn } = subData;
        
        if (!playerOut || !playerIn) {
            Swal.fire('Invalid Substitution', 'Please select both players', 'warning');
            return;
        }

        saveStateToHistory();

        const isLiberoSwap = (
            (team === 'home' && (playerIn.id === homeLibero?.id || playerOut.id === homeLibero?.id)) ||
            (team === 'away' && (playerIn.id === awayLibero?.id || playerOut.id === awayLibero?.id))
        );

        if (!isLiberoSwap) {
            if (subCounts[team] >= 6) {
                Swal.fire('Limit Reached', 'Maximum 6 substitutions per set allowed.', 'error');
                return;
            }
            setSubCounts(prev => ({ ...prev, [team]: prev[team] + 1 }));
        }

        // Update Rotation and Bench
        if (team === 'home') {
            setHomeRotation(prev => prev.map(p => p.id === playerOut.id ? playerIn : p));
            setHomeSubs(prev => prev.map(p => p.id === playerIn.id ? playerOut : p));
        } else {
            setAwayRotation(prev => prev.map(p => p.id === playerOut.id ? playerIn : p));
            setAwaySubs(prev => prev.map(p => p.id === playerIn.id ? playerOut : p));
        }

        logAction({
            match_id: match.id,
            set_number: currentSet,
            team_id: team === 'home' ? match.home_team_id : match.away_team_id,
            player_id: playerIn.id,
            skill: isLiberoSwap ? 'LIBERO' : 'SUB',
            grade: '!',
            score_home: pointScore.home,
            score_away: pointScore.away,
            description: `OUT #${playerOut.number} / IN #${playerIn.number}`
        });

        setShowSubModal(false);
        setSubData({ team: 'home', playerOut: null, playerIn: null });
    };

    // ------------------------------------------------------------------------
    // TIMEOUT & SANCTION LOGIC
    // ------------------------------------------------------------------------
    
    const handleTimeout = (team) => {
        if (timeouts[team] >= 2) {
            Swal.fire('Limit Reached', 'Maximum 2 timeouts per set.', 'warning');
            return;
        }
        
        saveStateToHistory();
        setTimeouts(prev => ({ ...prev, [team]: prev[team] + 1 }));

        logAction({
            match_id: match.id,
            set_number: currentSet,
            team_id: team === 'home' ? match.home_team_id : match.away_team_id,
            player_id: null,
            skill: 'TIMEOUT',
            grade: '!',
            score_home: pointScore.home,
            score_away: pointScore.away,
            description: `${team.toUpperCase()} (${timeouts[team] + 1}/2)`
        });
    };

    const handleSanctionSubmit = () => {
        const { team, player, type } = sanctionData;
        
        if (!player) {
            Swal.fire('Invalid Sanction', 'Please select a player', 'warning');
            return;
        }

        if (type === 'red') {
            const opponent = team === 'home' ? 'away' : 'home';
            addPoint(opponent, player, 'SANCTION', 'Red Card');
        } else {
            saveStateToHistory();
            
            logAction({
                match_id: match.id,
                set_number: currentSet,
                team_id: team === 'home' ? match.home_team_id : match.away_team_id,
                player_id: player.id,
                skill: 'SANCTION',
                grade: 'Yellow Card',
                score_home: pointScore.home,
                score_away: pointScore.away,
                description: 'Yellow Card'
            });
        }
        
        setShowSanctionModal(false);
    };

    // ------------------------------------------------------------------------
    // PDF GENERATION
    // ------------------------------------------------------------------------
    
    const generatePDF = async () => {
        try {
            Swal.fire({
                title: 'Preparing Scoresheet...',
                text: 'Fetching match data and generating PDF',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await api.getMatchScoresheetData(match.id);
            generateScoresheetPDF(response.data);

            Swal.fire({
                title: 'Scoresheet Generated',
                text: 'The official FIVB scoresheet has been downloaded.',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
        } catch (error) {
            console.error("PDF Generation Error:", error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to generate PDF scoresheet: ' + error.message,
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        }
    };

    // ------------------------------------------------------------------------
    // RENDER: LINEUP SELECTION PHASE
    // ------------------------------------------------------------------------
    
    if (!lineupSubmitted) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 
                          text-white z-50 flex flex-col items-center justify-center p-6 overflow-y-auto">
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-semibold mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 
                                 bg-clip-text text-transparent">
                        Pre-Match Line-up
                    </h2>
                    <p className="text-gray-400">Select 6 starters and 1 libero for each team</p>
                </div>
                
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 lg:px-12">
                    {!homeLineupConfirmed ? (
                        <LineupSelector 
                            teamName={matchData.home_team} 
                            players={homePlayers} 
                            onConfirm={handleHomeLineup} 
                        />
                    ) : (
                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 p-8 
                                      rounded-lg border-2 border-green-500 flex flex-col items-center 
                                      justify-center shadow-xl">
                            <CheckCircle size={64} className="text-green-400 mb-4 animate-pulse" />
                            <h3 className="text-2xl font-bold text-green-300">{matchData.home_team} Ready</h3>
                        </div>
                    )}

                    {!awayLineupConfirmed ? (
                        <LineupSelector 
                            teamName={matchData.away_team} 
                            players={awayPlayers} 
                            onConfirm={handleAwayLineup} 
                        />
                    ) : (
                        <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 p-8 
                                      rounded-lg border-2 border-green-500 flex flex-col items-center 
                                      justify-center shadow-xl">
                            <CheckCircle size={64} className="text-green-400 mb-4 animate-pulse" />
                            <h3 className="text-2xl font-bold text-green-300">{matchData.away_team} Ready</h3>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------------
    // RENDER: COIN TOSS / MATCH SETUP
    // ------------------------------------------------------------------------
    
    if (lineupSubmitted && !matchStarted) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 
                          text-white z-[100] flex flex-col items-center justify-center p-4">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-3xl 
                              shadow-2xl w-full border border-gray-700">
                    <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3">
                        <Activity className="text-yellow-500" size={32} />
                        <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                            Match Setup
                        </span>
                    </h2>

                    {/* Serving Team Selection */}
                    <div className="mb-10">
                        <h3 className="text-xl font-semibold mb-4 text-gray-300 text-center">
                            Who Serves First?
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <button 
                                onClick={() => setServingTeam('home')}
                                className={`p-6 rounded-lg border-2 transition-all duration-300 
                                          flex flex-col items-center gap-3 transform hover:scale-105 ${
                                    servingTeam === 'home' 
                                        ? 'border-blue-500 bg-gradient-to-br from-indigo-900/50 to-indigo-800/50 text-white shadow-xl shadow-blue-500/10' 
                                        : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                                }`}
                            >
                                <span className="font-bold text-xl">{matchData.home_team}</span>
                                {servingTeam === 'home' && (
                                    <CheckCircle size={24} className="text-indigo-400 animate-pulse" />
                                )}
                            </button>
                            
                            <button 
                                onClick={() => setServingTeam('away')}
                                className={`p-6 rounded-lg border-2 transition-all duration-300 
                                          flex flex-col items-center gap-3 transform hover:scale-105 ${
                                    servingTeam === 'away' 
                                        ? 'border-rose-500 bg-gradient-to-br from-rose-900/50 to-rose-800/50 text-white shadow-xl shadow-rose-500/20' 
                                        : 'border-gray-600 bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                                }`}
                            >
                                <span className="font-bold text-xl">{matchData.away_team}</span>
                                {servingTeam === 'away' && (
                                    <CheckCircle size={24} className="text-rose-400 animate-pulse" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Court Side Selection */}
                    <div className="mb-10">
                        <h3 className="text-xl font-semibold mb-4 text-gray-300 text-center">
                            Court Side (Scorer's View)
                        </h3>
                        <div className="relative bg-gray-700 rounded-lg p-1 flex items-center">
                            <div 
                                className={`absolute top-1 bottom-1 w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-700 
                                          rounded-md transition-all duration-300 shadow-lg ${
                                    isHomeLeft ? 'left-1' : 'left-[calc(50%-4px)]'
                                }`}
                            />
                            <button 
                                onClick={() => setIsHomeLeft(true)}
                                className={`relative z-10 flex-1 py-4 text-center font-bold transition-colors rounded-md ${
                                    isHomeLeft ? 'text-white' : 'text-gray-400'
                                }`}
                            >
                                {matchData.home_team} (Left)
                            </button>
                            <button 
                                onClick={() => setIsHomeLeft(false)}
                                className={`relative z-10 flex-1 py-4 text-center font-bold transition-colors rounded-md ${
                                    !isHomeLeft ? 'text-white' : 'text-gray-400'
                                }`}
                            >
                                {matchData.home_team} (Right)
                            </button>
                        </div>
                        <p className="text-sm text-center mt-3 text-gray-500">
                            {isHomeLeft 
                                ? `${matchData.home_team} on Left, ${matchData.away_team} on Right` 
                                : `${matchData.away_team} on Left, ${matchData.home_team} on Right`}
                        </p>
                    </div>

                    <button 
                        onClick={() => {
                            if (!servingTeam) {
                                Swal.fire('Please Select', 'Choose which team serves first', 'warning');
                                return;
                            }
                            
                            if (servingTeam === 'home') {
                                setServer(homeRotation[0]);
                            } else {
                                setServer(awayRotation[0]);
                            }
                            
                            setMatchStarted(true);
                            api.startSet(matchData.id, { setNumber: 1 })
                               .catch(err => console.error("Failed to save set start time:", err));
                        }}
                        disabled={!servingTeam}
                        className="w-full py-5 bg-gradient-to-r from-green-600 to-green-700 
                                 hover:from-green-700 hover:to-green-800 text-white font-bold 
                                 rounded-lg shadow-xl shadow-green-900/30 transition-all duration-300 
                                 flex items-center justify-center gap-3 text-lg
                                 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 
                                 disabled:cursor-not-allowed disabled:shadow-none
                                 transform hover:scale-105 active:scale-95"
                    >
                        <PlayCircle size={28} />
                        Start Match
                    </button>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------------
    // RENDER: MAIN SCORER INTERFACE
    // ------------------------------------------------------------------------
    
    const leftTeam = isHomeLeft ? 'home' : 'away';
    const rightTeam = isHomeLeft ? 'away' : 'home';
    
    const leftTeamData = {
        name: isHomeLeft ? matchData.home_team : matchData.away_team,
        setWins: isHomeLeft ? setWins.home : setWins.away,
        pointScore: isHomeLeft ? pointScore.home : pointScore.away,
        timeouts: isHomeLeft ? timeouts.home : timeouts.away,
        color: isHomeLeft ? 'indigo' : 'rose',
        rotation: isHomeLeft ? homeRotation : awayRotation,
        subs: isHomeLeft ? homeSubs : awaySubs,
        libero: isHomeLeft ? homeLibero : awayLibero,
    };
    
    const rightTeamData = {
        name: !isHomeLeft ? matchData.home_team : matchData.away_team,
        setWins: !isHomeLeft ? setWins.home : setWins.away,
        pointScore: !isHomeLeft ? pointScore.home : pointScore.away,
        timeouts: !isHomeLeft ? timeouts.home : timeouts.away,
        color: !isHomeLeft ? 'indigo' : 'rose',
        rotation: !isHomeLeft ? homeRotation : awayRotation,
        subs: !isHomeLeft ? homeSubs : awaySubs,
        libero: !isHomeLeft ? homeLibero : awayLibero,
    };

    return (
        <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col h-screen">
            
            {/* ============================================================
                SCOREBOARD HEADER
            ============================================================ */}
            <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 p-6 shadow-2xl 
                          flex justify-between items-center shrink-0 border-b border-gray-700">
                
                {/* Left Team Score */}
                <div className="text-center w-1/3">
                    <h2 className="text-2xl font-bold text-gray-300 truncate mb-2">
                        {leftTeamData.name}
                    </h2>
                    <div className="flex items-center justify-center gap-6">
                        <div className={`text-7xl font-semibold ${
                            leftTeamData.color === 'indigo' ? 'text-indigo-400' : 'text-rose-400'
                        } drop-shadow-lg`}>
                            {leftTeamData.setWins}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className={`w-4 h-4 rounded-full transition-all ${
                                leftTeamData.timeouts > 0 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-gray-700'
                            }`} title="Timeout 1" />
                            <div className={`w-4 h-4 rounded-full transition-all ${
                                leftTeamData.timeouts > 1 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-gray-700'
                            }`} title="Timeout 2" />
                        </div>
                    </div>
                </div>

                {/* Center Score */}
                <div className="text-center w-1/3">
                    <div className="text-sm text-gray-400 uppercase tracking-widest mb-2 font-bold">
                        Set {currentSet}
                    </div>
                    <div className="text-6xl font-semibold text-white tracking-wider drop-shadow-2xl">
                        {leftTeamData.pointScore} - {rightTeamData.pointScore}
                    </div>
                    <div className="text-xs text-gray-500 mt-3 font-mono flex justify-center gap-3">
                        {setScores.map((s, i) => (
                            <span key={i} className="bg-gray-800 px-2 py-1 rounded">
                                {isHomeLeft ? s.home : s.away}-{isHomeLeft ? s.away : s.home}
                            </span>
                        ))}
                    </div>
                    <button 
                        onClick={onClose}
                        className="mt-3 text-xs underline text-gray-500 hover:text-white transition-colors"
                    >
                        Exit Scorer
                    </button>
                </div>

                {/* Right Team Score */}
                <div className="text-center w-1/3">
                    <h2 className="text-2xl font-bold text-gray-300 truncate mb-2">
                        {rightTeamData.name}
                    </h2>
                    <div className="flex items-center justify-center gap-6">
                        <div className="flex flex-col gap-2">
                            <div className={`w-4 h-4 rounded-full transition-all ${
                                rightTeamData.timeouts > 0 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-gray-700'
                            }`} title="Timeout 1" />
                            <div className={`w-4 h-4 rounded-full transition-all ${
                                rightTeamData.timeouts > 1 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-gray-700'
                            }`} title="Timeout 2" />
                        </div>
                        <div className={`text-7xl font-semibold ${
                            rightTeamData.color === 'indigo' ? 'text-indigo-400' : 'text-rose-400'
                        } drop-shadow-lg`}>
                            {rightTeamData.setWins}
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================
                MAIN CONTENT: 3 COLUMN LAYOUT
            ============================================================ */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* LEFT BENCH */}
                <div className="hidden md:flex md:w-48 lg:w-72 bg-gray-800 border-r border-gray-700 flex-col">
                    <div className={`p-4 border-b text-center bg-gradient-to-r ${
                        leftTeamData.color === 'indigo' 
                            ? 'from-indigo-900/40 to-indigo-800/40 border-indigo-900/50' 
                            : 'from-rose-900/40 to-rose-800/40 border-rose-900/50'
                    }`}>
                        <h3 className={`${
                            leftTeamData.color === 'indigo' ? 'text-indigo-400' : 'text-rose-400'
                        } font-bold tracking-wider uppercase`}>
                            {leftTeam === 'home' ? 'Home' : 'Away'} Bench
                        </h3>
                        <div className="text-xs text-gray-400 mt-1">{leftTeamData.name}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        <div className="grid grid-cols-2 gap-2">
                            {leftTeamData.subs.map(p => (
                                <PlayerButton 
                                    key={p.id} 
                                    team={leftTeam}
                                    player={p} 
                                    selectedPlayer={selectedPlayer} 
                                    onSelect={handlePlayerSelect} 
                                    onBench={true} 
                                    isReadOnly={isReadOnly} 
                                    isLibero={leftTeamData.libero?.id === p.id} 
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* CENTER COURT */}
                <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
                    
                    {/* Court Visual - Fixed 800x400px */}
                    <div className="flex-1 relative bg-gradient-to-br from-[#d4a574] to-[#c99660] overflow-hidden flex items-center justify-center p-2">
                        <div className="flex relative border-4 border-white shadow-2xl rounded-lg overflow-hidden w-full max-w-[800px] aspect-[2/1]">
                            
                            {/* Net - White Center Line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white z-20 
                                          -translate-x-1/2 shadow-lg" />
                            
                            {/* Left Court */}
                            <div className="flex-1 relative bg-orange-100/5">
                                <CourtLayout
                                    rotation={leftTeamData.rotation}
                                    team={leftTeam}
                                    libero={leftTeamData.libero}
                                    selectedPlayer={selectedPlayer}
                                    onSelect={handlePlayerSelect}
                                    server={server}
                                    isReadOnly={isReadOnly}
                                    isHome={true}
                                />
                            </div>
                            
                            {/* Right Court */}
                            <div className="flex-1 relative bg-orange-100/5">
                                <CourtLayout
                                    rotation={rightTeamData.rotation}
                                    team={rightTeam}
                                    libero={rightTeamData.libero}
                                    selectedPlayer={selectedPlayer}
                                    onSelect={handlePlayerSelect}
                                    server={server}
                                    isReadOnly={isReadOnly}
                                    isHome={false}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Control Panel */}
                    <div className="h-80 bg-gray-800 border-t-2 border-gray-700 flex flex-col shadow-2xl">
                        
                        {/* Control Buttons */}
                        <div className="p-3 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex gap-2 items-center flex-wrap">
                                <button 
                                    onClick={() => handleTimeout(leftTeam)}
                                    disabled={isReadOnly}
                                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-xs 
                                              font-bold transition-all hover:scale-105 ${
                                        leftTeamData.color === 'indigo' 
                                            ? 'bg-indigo-900/50 text-indigo-200 border-indigo-700 hover:bg-indigo-800/50' 
                                            : 'bg-rose-900/50 text-rose-200 border-rose-700 hover:bg-rose-800/50'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <Clock size={16} /> TO Left
                                </button>
                                
                                <button 
                                    onClick={() => handleTimeout(rightTeam)}
                                    disabled={isReadOnly}
                                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-xs 
                                              font-bold transition-all hover:scale-105 ${
                                        rightTeamData.color === 'indigo' 
                                            ? 'bg-indigo-900/50 text-indigo-200 border-indigo-700 hover:bg-indigo-800/50' 
                                            : 'bg-rose-900/50 text-rose-200 border-rose-700 hover:bg-rose-800/50'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    <Clock size={16} /> TO Right
                                </button>
                                
                                <div className="w-px h-8 bg-gray-700 mx-1" />
                                
                                <button 
                                    onClick={() => setShowSanctionModal(true)}
                                    disabled={isReadOnly}
                                    className="flex items-center gap-2 px-4 py-2 bg-yellow-900/50 text-yellow-200 
                                             border border-yellow-700 rounded-lg hover:bg-yellow-800/50 text-xs 
                                             font-bold transition-all hover:scale-105 disabled:opacity-50 
                                             disabled:cursor-not-allowed"
                                >
                                    <AlertTriangle size={16} /> Sanction
                                </button>
                                
                                <button 
                                    onClick={() => setShowSubModal(true)}
                                    disabled={isReadOnly}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 
                                             border border-gray-600 rounded-lg hover:bg-gray-600 text-xs 
                                             font-bold transition-all hover:scale-105 disabled:opacity-50 
                                             disabled:cursor-not-allowed"
                                >
                                    <ArrowRightLeft size={16} /> Substitute
                                </button>
                                
                                <button 
                                    onClick={handleUndo}
                                    disabled={isReadOnly || history.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 
                                             border border-gray-600 rounded-lg hover:bg-gray-600 text-xs 
                                             font-bold transition-all hover:scale-105 disabled:opacity-50 
                                             disabled:cursor-not-allowed"
                                >
                                    <RotateCcw size={16} /> Undo
                                </button>
                            </div>
                            
                            {/* Selected Player Display */}
                            <div className="flex-1 flex justify-center px-6">
                                {!selectedPlayer ? (
                                    <span className="text-gray-400 animate-pulse text-sm font-medium">
                                        Select a player to record action...
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span className={`px-4 py-2 rounded-lg font-bold shadow-lg ${
                                            selectedTeam === 'home' 
                                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white' 
                                                : 'bg-gradient-to-r from-rose-600 to-rose-700 text-white'
                                        }`}>
                                            #{selectedPlayer.number} {selectedPlayer.name}
                                        </span>
                                        {selectedSkill && (
                                            <>
                                                <span className="text-gray-500 text-xl">→</span>
                                                <span className="px-4 py-2 rounded-lg bg-gray-700 font-bold shadow-lg">
                                                    {SKILLS.find(s => s.code === selectedSkill)?.name}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={generatePDF}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 
                                         to-green-700 text-white rounded-lg hover:from-green-700 
                                         hover:to-green-800 text-xs font-bold shadow-lg transition-all 
                                         hover:scale-105"
                            >
                                <FileText size={16} /> Export PDF
                            </button>
                        </div>

                        {/* Skills/Grades Selection & Action Log */}
                        <div className="flex-1 flex overflow-hidden">
                            
                            {/* Skills/Grades Grid */}
                            <div className="flex-1 p-4 overflow-y-auto">
                                <div className="grid grid-cols-3 gap-4 h-full content-center">
                                    {selectedPlayer && !selectedSkill && SKILLS.map(skill => (
                                        <button 
                                            key={skill.code}
                                            onClick={() => handleSkillSelect(skill.code)}
                                            disabled={isReadOnly}
                                            className="h-24 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 
                                                     hover:from-gray-600 hover:to-gray-700 border-2 border-gray-600 
                                                     hover:border-blue-500 flex flex-col items-center justify-center 
                                                     gap-2 transition-all duration-200 shadow-lg hover:shadow-blue-500/10 
                                                     hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="text-4xl">{skill.icon}</span>
                                            <span className="font-bold text-sm">{skill.name}</span>
                                        </button>
                                    ))}
                                    
                                    {selectedSkill && GRADES.map(grade => (
                                        <button 
                                            key={grade.code}
                                            onClick={() => handleGradeSelect(grade)}
                                            disabled={isReadOnly}
                                            className={`h-24 rounded-lg flex flex-col items-center justify-center 
                                                      gap-2 transition-all duration-200 text-white shadow-lg 
                                                      hover:shadow-xl hover:scale-105 ${grade.color} 
                                                      disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            <span className="text-3xl font-semibold">{grade.code}</span>
                                            <span className="text-xs font-semibold uppercase px-2 text-center">
                                                {grade.name}
                                            </span>
                                        </button>
                                    ))}
                                    
                                    {selectedSkill && (
                                        <button 
                                            onClick={() => setSelectedSkill(null)}
                                            className="h-24 rounded-lg bg-gray-600 hover:bg-gray-500 
                                                     flex items-center justify-center gap-2 font-bold 
                                                     transition-all hover:scale-105"
                                        >
                                            <RotateCcw size={20} /> Back
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Action Log */}
                            <div className="w-80 bg-gray-900/80 border-l-2 border-gray-700 overflow-y-auto">
                                <div className="sticky top-0 bg-gray-900 p-3 border-b border-gray-800 
                                              text-sm font-bold text-gray-400 uppercase tracking-wider">
                                    Recent Actions
                                </div>
                                <div className="p-2 space-y-1">
                                    {actionLog.map((log, i) => (
                                        <div 
                                            key={i}
                                            className="text-sm flex gap-2 text-gray-400 bg-gray-800/50 
                                                     rounded-lg p-2 hover:bg-gray-800 transition-colors"
                                        >
                                            <span className="text-gray-500 font-mono w-12 shrink-0">
                                                {log.score_home}-{log.score_away}
                                            </span>
                                            <span className={`w-24 truncate font-bold ${
                                                log.team_id === match.home_team_id 
                                                    ? 'text-indigo-400' 
                                                    : 'text-rose-400'
                                            }`}>
                                                {log.player_id 
                                                    ? `#${homePlayers.find(h => h.id === log.player_id)?.number || 
                                                         awayPlayers.find(a => a.id === log.player_id)?.number}` 
                                                    : 'TEAM'}
                                            </span>
                                            <span className="font-bold text-white flex-1 truncate">
                                                {log.skill === 'SUB' ? 'Sub' : 
                                                 log.skill === 'LIBERO' ? 'Libero' : 
                                                 log.skill === 'SANCTION' ? 'Card' : 
                                                 SKILLS.find(s => s.code === log.skill)?.name || log.skill}
                                                <span className="text-xs font-normal ml-1 text-gray-400">
                                                    ({log.grade})
                                                </span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT BENCH */}
                <div className="hidden md:flex md:w-48 lg:w-72 bg-gray-800 border-l border-gray-700 flex-col">
                    <div className={`p-4 border-b text-center bg-gradient-to-r ${
                        rightTeamData.color === 'indigo' 
                            ? 'from-indigo-900/40 to-indigo-800/40 border-indigo-900/50' 
                            : 'from-rose-900/40 to-rose-800/40 border-rose-900/50'
                    }`}>
                        <h3 className={`${
                            rightTeamData.color === 'indigo' ? 'text-indigo-400' : 'text-rose-400'
                        } font-bold tracking-wider uppercase`}>
                            {rightTeam === 'home' ? 'Home' : 'Away'} Bench
                        </h3>
                        <div className="text-xs text-gray-400 mt-1">{rightTeamData.name}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                        <div className="grid grid-cols-2 gap-2">
                            {rightTeamData.subs.map(p => (
                                <PlayerButton 
                                    key={p.id} 
                                    team={rightTeam}
                                    player={p} 
                                    selectedPlayer={selectedPlayer} 
                                    onSelect={handlePlayerSelect} 
                                    onBench={true} 
                                    isReadOnly={isReadOnly} 
                                    isLibero={rightTeamData.libero?.id === p.id} 
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================
                SUBSTITUTION MODAL
            ============================================================ */}
            {showSubModal && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center 
                              justify-center p-4 animate-fadeIn">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 w-full 
                                  rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] 
                                  border border-gray-700">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center 
                                      bg-gray-900/50">
                            <h3 className="text-2xl font-bold flex items-center gap-3">
                                <ArrowRightLeft className="text-yellow-500" size={28} />
                                Substitution
                            </h3>
                            <button 
                                onClick={() => setShowSubModal(false)}
                                className="hover:bg-gray-700 p-2 rounded-lg transition-colors"
                            >
                                <XCircle size={28} className="text-gray-500 hover:text-white" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col p-6">
                            {/* Team Selection */}
                            <div className="flex justify-center gap-6 mb-8">
                                <button 
                                    onClick={() => setSubData({ team: 'home', playerOut: null, playerIn: null })}
                                    className={`px-8 py-4 rounded-lg font-bold text-lg transition-all 
                                              duration-300 transform hover:scale-105 ${
                                        subData.team === 'home' 
                                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white ring-2 ring-indigo-400 shadow-xl shadow-blue-500/10' 
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                                >
                                    {matchData.home_team}
                                </button>
                                <button 
                                    onClick={() => setSubData({ team: 'away', playerOut: null, playerIn: null })}
                                    className={`px-8 py-4 rounded-lg font-bold text-lg transition-all 
                                              duration-300 transform hover:scale-105 ${
                                        subData.team === 'away' 
                                            ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white ring-2 ring-rose-400 shadow-xl shadow-rose-500/20' 
                                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                    }`}
                                >
                                    {matchData.away_team}
                                </button>
                            </div>

                            {/* Player Selection */}
                            <div className="flex gap-8 flex-1 overflow-hidden">
                                {/* Player OUT */}
                                <div className="flex-1 bg-gray-900/50 rounded-lg p-6 overflow-y-auto 
                                              border-2 border-red-900/50">
                                    <h4 className="text-red-400 font-bold mb-4 text-center uppercase 
                                                 tracking-wider text-lg">
                                        Player OUT (Court)
                                    </h4>
                                    <div className="space-y-3">
                                        {(subData.team === 'home' ? homeRotation : awayRotation).map(p => (
                                            <button 
                                                key={p.id}
                                                onClick={() => setSubData({ ...subData, playerOut: p })}
                                                className={`w-full p-4 rounded-md flex items-center justify-between 
                                                          transition-all duration-200 ${
                                                    subData.playerOut?.id === p.id 
                                                        ? 'bg-red-900/50 border-2 border-red-500 text-white shadow-lg shadow-red-500/20' 
                                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-2 border-transparent'
                                                }`}
                                            >
                                                <span className="font-mono font-bold text-2xl">#{p.number}</span>
                                                <span className="truncate flex-1 text-center">{p.name}</span>
                                                {((subData.team === 'home' ? homeLibero : awayLibero)?.id === p.id) && (
                                                    <span className="text-xs bg-yellow-500 text-black px-2 py-1 
                                                                 rounded-full ml-2 font-bold">
                                                        L
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Player IN */}
                                <div className="flex-1 bg-gray-900/50 rounded-lg p-6 overflow-y-auto 
                                              border-2 border-green-900/50">
                                    <h4 className="text-green-400 font-bold mb-4 text-center uppercase 
                                                 tracking-wider text-lg">
                                        Player IN (Bench)
                                    </h4>
                                    <div className="space-y-3">
                                        {(subData.team === 'home' ? homeSubs : awaySubs).map(p => (
                                            <button 
                                                key={p.id}
                                                onClick={() => setSubData({ ...subData, playerIn: p })}
                                                className={`w-full p-4 rounded-md flex items-center justify-between 
                                                          transition-all duration-200 ${
                                                    subData.playerIn?.id === p.id 
                                                        ? 'bg-green-900/50 border-2 border-green-500 text-white shadow-lg shadow-green-500/20' 
                                                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-2 border-transparent'
                                                }`}
                                            >
                                                <span className="font-mono font-bold text-2xl">#{p.number}</span>
                                                <span className="truncate flex-1 text-center">{p.name}</span>
                                                {((subData.team === 'home' ? homeLibero : awayLibero)?.id === p.id) && (
                                                    <span className="text-xs bg-yellow-500 text-black px-2 py-1 
                                                                 rounded-full ml-2 font-bold">
                                                        L
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-700 bg-gray-900/50 flex justify-end gap-4">
                            <button 
                                onClick={() => setShowSubModal(false)}
                                className="px-6 py-3 text-gray-400 hover:text-white hover:bg-gray-700 
                                         rounded-md transition-all font-bold"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={performSubstitution}
                                disabled={!subData.playerOut || !subData.playerIn}
                                className={`px-8 py-3 rounded-md font-bold flex items-center gap-3 
                                          transition-all duration-200 ${
                                    (!subData.playerOut || !subData.playerIn) 
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black shadow-xl shadow-yellow-500/20 transform hover:scale-105'
                                }`}
                            >
                                <ArrowRightLeft size={20} /> Confirm Substitution
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================
                SANCTION MODAL
            ============================================================ */}
            {showSanctionModal && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center 
                              justify-center p-4 animate-fadeIn">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 w-full max-w-lg 
                                  rounded-3xl shadow-2xl p-8 border border-gray-700">
                        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                            <AlertTriangle className="text-yellow-500" size={28} />
                            Issue Sanction
                        </h3>
                        
                        {/* Team Selection */}
                        <div className="mb-6">
                            <label className="block text-sm text-gray-400 mb-2 font-bold">Team</label>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setSanctionData({...sanctionData, team: 'home', player: null})}
                                    className={`flex-1 py-3 rounded-md border-2 font-bold transition-all ${
                                        sanctionData.team === 'home' 
                                            ? 'bg-blue-600 border-indigo-400 text-white' 
                                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                                    }`}
                                >
                                    {matchData.home_team}
                                </button>
                                <button 
                                    onClick={() => setSanctionData({...sanctionData, team: 'away', player: null})}
                                    className={`flex-1 py-3 rounded-md border-2 font-bold transition-all ${
                                        sanctionData.team === 'away' 
                                            ? 'bg-rose-600 border-rose-400 text-white' 
                                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                                    }`}
                                >
                                    {matchData.away_team}
                                </button>
                            </div>
                        </div>

                        {/* Player Selection */}
                        <div className="mb-6">
                            <label className="block text-sm text-gray-400 mb-2 font-bold">Player / Coach</label>
                            <select 
                                className="w-full bg-gray-700 border-2 border-gray-600 rounded-md p-3 text-white 
                                         font-bold focus:border-blue-500 focus:outline-none transition-colors"
                                onChange={(e) => setSanctionData({...sanctionData, player: JSON.parse(e.target.value)})}
                            >
                                <option value="null">-- Select --</option>
                                {(sanctionData.team === 'home' ? homePlayers : awayPlayers).map(p => (
                                    <option key={p.id} value={JSON.stringify(p)}>
                                        #{p.number} {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Card Type */}
                        <div className="mb-8">
                            <label className="block text-sm text-gray-400 mb-2 font-bold">Card Type</label>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setSanctionData({...sanctionData, type: 'yellow'})}
                                    className={`flex-1 py-4 rounded-md font-bold border-2 transition-all ${
                                        sanctionData.type === 'yellow' 
                                            ? 'bg-yellow-500 text-black border-yellow-400 shadow-lg shadow-yellow-500/20' 
                                            : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
                                    }`}
                                >
                                    Yellow Card
                                </button>
                                <button 
                                    onClick={() => setSanctionData({...sanctionData, type: 'red'})}
                                    className={`flex-1 py-4 rounded-md font-bold border-2 transition-all ${
                                        sanctionData.type === 'red' 
                                            ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-500/20' 
                                            : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
                                    }`}
                                >
                                    Red Card<br/><span className="text-xs">(+1 Point)</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4">
                            <button 
                                onClick={() => setShowSanctionModal(false)}
                                className="px-6 py-3 text-gray-400 hover:text-white hover:bg-gray-700 
                                         rounded-md transition-all font-bold"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSanctionSubmit}
                                className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 
                                         hover:from-red-700 hover:to-red-800 text-white rounded-md 
                                         font-bold shadow-lg shadow-red-500/20 transition-all 
                                         transform hover:scale-105"
                            >
                                Confirm Sanction
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}