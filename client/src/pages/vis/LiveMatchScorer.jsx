import VisLineupPanel from '../../components/vis/VisLineupPanel';
import { api } from '../../api';
import { generateVisMatchPDF } from '../../utils/reports/pdfGenerator';
import Swal from 'sweetalert2';
import useVisScorer from '../../hooks/useVisScorer';
import ballImage from '../../assets/img/ball.png';
import VisRecordingPanel from '../../components/vis/VisRecordingPanel';
import VisMatchControls from '../../components/vis/VisMatchControls';
import { useState } from 'react';
import VisToolbar from '../../components/vis/VisToolbar';
import VisMatchLayout from '../../components/vis/VisMatchLayout';
import VisMatchDialog from '../../components/vis/VisMatchDialog';
import VisHistoryPanel from '../../components/vis/VisHistoryPanel';
import { describeVisEvent } from '../../utils/vis/visPresentation';

// ============================================================================
// HELPER FUNCTIONS - Volleyball Logic
// ============================================================================

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
    if (onCourt) buttonClass += ' w-full h-full';
    if (onCourt && isServer) buttonClass += ' ring-2 ring-lime-300 ring-offset-2 ring-offset-transparent';

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
    const numberSize = onCourt ? 'text-[clamp(0.75rem,45cqw,2.25rem)]' : (onBench ? 'text-lg md:text-xl lg:text-2xl' : 'text-2xl md:text-3xl');

    return (
        <button
            onClick={isReadOnly || onBench ? undefined : () => onSelect(team, player)}
            disabled={isReadOnly || onBench}
            className={buttonClass}
            style={isLibero ? undefined : { backgroundImage: `linear-gradient(135deg, var(--vis-${team}-color), #1e293b)` }}
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
            <div className="relative aspect-square w-[min(70cqw,70cqh,80px)] [container-type:inline-size]">
                <PlayerButton
                    team={team}
                    player={player}
                    selectedPlayer={selectedPlayer}
                    onSelect={onSelect}
                    isReadOnly={isReadOnly}
                    isLibero={libero?.id === player.id}
                    onCourt={true}
                    isServer={server?.id === player.id}
                />
                {player.id === rotation[0]?.id && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded bg-slate-950 px-1.5 text-[10px] leading-4 text-slate-300">P1</span>}
            </div>
        </div>
    );

    const cellClass = "flex min-h-0 min-w-0 justify-center items-center [container-type:size]";

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

export default function LiveMatchScorer({ match, onClose, isReadOnly: requestedReadOnly = false }) {
    const [layout, setLayout] = useState('code');
    const [orientation, setOrientation] = useState('row');
    const [showCourt, setShowCourt] = useState(true);
    const [showVideo, setShowVideo] = useState(false);
    const [panelRatio, setPanelRatio] = useState(70);
    const [reversed, setReversed] = useState(false);
    const [dialog, setDialog] = useState(null);
    const [editingLineup, setEditingLineup] = useState(false);
    const [teamColors, setTeamColors] = useState({ home: '#6366f1', away: '#f43f5e' });
    const resetLayout = () => { setLayout('code'); setOrientation('row'); setShowCourt(true); setShowVideo(false); setPanelRatio(70); setReversed(false); };
    const changeLayout = value => { setLayout(value); setPanelRatio(value === 'code' ? 70 : value === 'video' ? 30 : 50); if (value !== 'code') setShowVideo(true); };
    const {
        matchData, homePlayers, awayPlayers, homeRotation, awayRotation, homeLibero, awayLibero,
        homeSubs, awaySubs, phase, isReadOnly, isSaving, pending, loadError, loading, syncError,
        currentSet, pointScore, setScores, setWins, servingTeam, server,
        isHomeLeft, actionLog, history, selectedTeam, selectedPlayer, selectedSkill,
        handlePlayerSelect, handleSkillSelect, handleGradeSelect, handleUndo, retrySave,
        send, resetSelection, teamA, lastSavedOperationId, rallies, contextChoice,
        setContextChoice, activeContext, commandContext, setupComplete, requiresToss, timeouts, substitutions,
    } = useVisScorer(match, requestedReadOnly);
    const players = [...homePlayers, ...awayPlayers];
    const makeCodeTeam = key => ({ key, name: key === 'home' ? matchData.home_team : matchData.away_team,
        players: key === 'home' ? homePlayers : awayPlayers, lineup: key === 'home' ? homeRotation : awayRotation });
    const codeTeams = { A: makeCodeTeam(teamA), B: makeCodeTeam(teamA === 'home' ? 'away' : 'home') };
    const lastSavedAction = history[history.length - 1];
    const undoEvent = lastSavedAction?.eventId ? actionLog.find(event => String(event.id) === String(lastSavedAction.eventId)) : null;
    const undoLabel = history.length ? describeVisEvent(undoEvent, players) : 'ไม่มีรายการ';
    const undoDisabled = requestedReadOnly || matchData.offline_released || ['confirmed', 'cancelled'].includes(matchData.vis_lifecycle) || isSaving || Boolean(pending) || history.length === 0;
    const reviewMode = requestedReadOnly || matchData.offline_released;
    const undoLastSavedAction = async () => {
        if (undoDisabled) return;
        await handleUndo();
    };

    const generatePDF = async () => {
        const selection = await Swal.fire({
            title: 'ส่งออกรายงาน PDF',
            html: '<p>รายงานสรุปการแข่งขันและสถิติรายบุคคลทั้งสองทีม</p><label style="display:block;text-align:left;margin-top:16px"><input id="vis-pdf-sets" type="checkbox"> เพิ่มรายละเอียดรายเซต</label><label style="display:block;text-align:left;margin-top:12px"><input id="vis-pdf-history" type="checkbox"> เพิ่มประวัติเหตุการณ์</label>',
            showCancelButton: true,
            confirmButtonText: 'ดาวน์โหลด PDF',
            cancelButtonText: 'ยกเลิก',
            preConfirm: () => ({
                includeSets: document.getElementById('vis-pdf-sets').checked,
                includeHistory: document.getElementById('vis-pdf-history').checked,
            }),
        });
        if (!selection.isConfirmed) return;
        try {
            Swal.fire({
                title: 'กำลังสร้างรายงาน...',
                text: 'กำลังดึงข้อมูลที่บันทึกและสร้าง PDF',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await api.getMatchScoresheetData(match.id);
            await generateVisMatchPDF(response.data, selection.value);

            Swal.fire({
                title: 'สร้างรายงานแล้ว',
                text: 'ดาวน์โหลดรายงานสถิติ VIS เรียบร้อยแล้ว',
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

    if (loading || loadError) return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gray-900 text-white">
            <p>{loadError || 'Loading saved VIS match...'}</p>
            <button onClick={onClose} className="rounded bg-gray-700 px-6 py-2">Close</button>
            {loadError && <button onClick={() => window.location.reload()} className="rounded bg-blue-700 px-6 py-2">Reload</button>}
        </div>
    );

    const leftTeam = isHomeLeft ? 'home' : 'away';
    const rightTeam = isHomeLeft ? 'away' : 'home';

    const leftTeamData = {
        name: isHomeLeft ? matchData.home_team : matchData.away_team,
        setWins: isHomeLeft ? setWins.home : setWins.away,
        pointScore: isHomeLeft ? pointScore.home : pointScore.away,
        color: isHomeLeft ? 'indigo' : 'rose',
        rotation: isHomeLeft ? homeRotation : awayRotation,
        subs: isHomeLeft ? homeSubs : awaySubs,
        libero: isHomeLeft ? homeLibero : awayLibero,
    };

    const rightTeamData = {
        name: !isHomeLeft ? matchData.home_team : matchData.away_team,
        setWins: !isHomeLeft ? setWins.home : setWins.away,
        pointScore: !isHomeLeft ? pointScore.home : pointScore.away,
        color: !isHomeLeft ? 'indigo' : 'rose',
        rotation: !isHomeLeft ? homeRotation : awayRotation,
        subs: !isHomeLeft ? homeSubs : awaySubs,
        libero: !isHomeLeft ? homeLibero : awayLibero,
    };

    return (
        <div className="fixed inset-0 z-50 flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gray-900 text-white" style={{ '--vis-home-color': teamColors.home, '--vis-away-color': teamColors.away }}>
            <VisToolbar match={matchData} onClose={onClose} layout={layout} onLayout={changeLayout}
                orientation={orientation} onOrientation={setOrientation} onReset={resetLayout}
                showCourt={showCourt} onToggleCourt={() => setShowCourt(value => !value)}
                showVideo={showVideo} onToggleVideo={() => setShowVideo(value => !value)}
                onSettings={() => setDialog('settings')} onStats={() => setDialog('stats')}
                liveEnabled={!syncError} pending={pending} isSaving={isSaving} retrySave={retrySave} onConfirm={() => send({ type: 'CONFIRM' })} />
            {dialog && <VisMatchDialog mode={dialog} match={matchData} teams={[makeCodeTeam('home'), makeCodeTeam('away')]}
                events={actionLog} onClose={() => setDialog(null)} readOnly={isReadOnly}
                colors={teamColors} onColors={setTeamColors} onPDF={generatePDF}
                canEditLineup={currentSet === 1 && history.length === 0}
                onLineup={() => { setDialog(null); setEditingLineup(true); }} />}
            <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {(!setupComplete || editingLineup) && !reviewMode && phase !== 'MATCH_FINISHED' && <VisLineupPanel key={currentSet}
                    teams={[makeCodeTeam('home'), makeCodeTeam('away')]} locked={isReadOnly} requiresToss={requiresToss}
                    initialServingTeam={servingTeam} initialHomeLeft={requiresToss ? null : isHomeLeft}
                    send={send} onClose={() => setEditingLineup(false)} onCancel={editingLineup ? () => setEditingLineup(false) : onClose} />}
                {phase === 'WAITING' && <div className="bg-blue-950 px-3 py-1 text-center text-sm">VIS บันทึกได้ทันที · คะแนนและบริบทถูกเก็บแยกในรายการ VIS</div>}
                {phase === 'MATCH_FINISHED' && <div className="bg-emerald-900 px-3 py-1 text-center text-sm">จบการแข่งขัน · {matchData.home_team} {setWins.home}–{setWins.away} {matchData.away_team}</div>}

                {/* ============================================================
                    SCOREBOARD HEADER
                ============================================================ */}
                <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 px-3 py-1.5 shadow-2xl
                              flex justify-between items-center shrink-0 border-b border-gray-700">

                    {/* Left Team Score */}
                    <div className="min-w-0 w-1/3 px-1 text-center">
                        <h2 className="text-sm lg:text-base font-bold text-gray-300 truncate mb-1">
                            {leftTeamData.name}
                        </h2>
                        <div className="flex items-center justify-center gap-6">
                            <div className={`text-3xl lg:text-4xl leading-none font-semibold ${
                                leftTeamData.color === 'indigo' ? 'text-indigo-400' : 'text-rose-400'
                            } drop-shadow-lg`}>
                                {leftTeamData.setWins}<span className="ml-2 text-xs font-normal text-slate-400"></span>
                            </div>
                        </div>
                    </div>

                    {/* Center Score */}
                    <div className="min-w-0 w-1/3 px-1 text-center">
                        <div className="text-xl text-gray-400 uppercase tracking-widest mb-1 font-bold">
                            SET {currentSet}
                        </div>
                        <div className="text-3xl lg:text-4xl leading-none font-semibold text-white tracking-wider drop-shadow-2xl">
                            {leftTeamData.pointScore} - {rightTeamData.pointScore}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 font-mono flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                            {setScores.map((s, i) => (
                                <span key={i} className="bg-gray-800 px-2 py-0.5 rounded">
                                    {isHomeLeft ? s.home : s.away}-{isHomeLeft ? s.away : s.home}
                                </span>
                            ))}
                            <button
                                onClick={onClose}
                                className="text-xs underline text-gray-400 hover:text-white transition-colors"
                            >
                                Exit Scorer
                            </button>
                        </div>
                    </div>

                    {/* Right Team Score */}
                    <div className="min-w-0 w-1/3 px-1 text-center">
                        <h2 className="text-sm lg:text-base font-bold text-gray-300 truncate mb-1">
                            {rightTeamData.name}
                        </h2>
                        <div className="flex items-center justify-center gap-6">
                            <div className={`text-3xl lg:text-4xl leading-none font-semibold ${
                                rightTeamData.color === 'indigo' ? 'text-indigo-400' : 'text-rose-400'
                            } drop-shadow-lg`}>
                                {rightTeamData.setWins}<span className="ml-2 text-xs font-normal text-slate-400"></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================================
                    MAIN CONTENT: 3 COLUMN LAYOUT
                ============================================================ */}
                <div className="flex min-h-0 flex-1 overflow-hidden">

                    {/* LEFT BENCH */}
                    <div className={`${showCourt ? 'hidden md:flex' : 'hidden'} min-h-0 md:w-24 xl:w-28 2xl:w-32 shrink-0 bg-gray-800 border-r border-gray-700 flex-col`}>
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
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
                        {!reviewMode && <div className="shrink-0 border-t border-gray-700 p-2">
                            <VisMatchControls key={`${currentSet}-${leftTeam}`} teams={[makeCodeTeam(leftTeam)]}
                                stacked showTeamName={false} locked={isReadOnly} send={send} timeouts={timeouts} substitutions={substitutions} />
                        </div>}
                    </div>

                    {/* CENTER COURT */}
                    <div className="flex-1 flex min-h-0 flex-col min-w-0 bg-gray-900">

                        {/* Fit the complete 2:1 court within both available dimensions. */}
                        <div className={`${showCourt ? 'flex' : 'hidden'} relative min-h-24 max-h-[240px] min-w-0 basis-[28%] shrink items-center justify-center overflow-hidden bg-gray-900 px-2 py-1 [container-type:size]`}>
                            <div className="relative flex aspect-[2/1] w-[min(96cqw,190cqh)] shrink-0 rounded-lg border-2 border-white bg-[#c99660] shadow-lg">
                                {server && servingTeam && (
                                    <div
                                        className={`absolute z-20 aspect-square w-[min(3cqw,28px)] -translate-y-1/2 ${servingTeam === leftTeam ? 'top-[83.333%] left-[1.5%]' : 'top-[16.667%] right-[1.5%]'}`}
                                        title="Server — position 1"
                                    >
                                        <img src={ballImage} alt="Serving team" className="h-full w-full object-contain drop-shadow-lg" />
                                    </div>
                                )}

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

                        <VisMatchLayout showVideo={showVideo} orientation={orientation} ratio={panelRatio} onRatio={setPanelRatio}
                            reversed={reversed} onReverse={() => setReversed(value => !value)}>
                        <VisRecordingPanel
                            servingTeam={servingTeam}
                            matchData={matchData} selectedPlayer={selectedPlayer} selectedTeam={selectedTeam}
                            selectedSkill={selectedSkill} locked={isReadOnly} reviewMode={reviewMode} phase={phase}
                            isSaving={isSaving} pending={pending} retrySave={retrySave}
                            skillsDisabled={isReadOnly || !selectedPlayer} onSkill={handleSkillSelect}
                            onGrade={handleGradeSelect} resetSelection={resetSelection}
                            actionLog={actionLog} players={players} undoLabel={undoLabel}
                            undoDisabled={undoDisabled} onUndo={undoLastSavedAction}
                            rallies={rallies} contextChoice={contextChoice} onContextChange={setContextChoice}
                            onExport={generatePDF} isHomeLeft={isHomeLeft}
                            codeTeams={codeTeams} send={send} lastSavedOperationId={lastSavedOperationId} activeContext={activeContext} commandContext={commandContext}
                        />
                        </VisMatchLayout>
                    </div>

                    {/* RIGHT BENCH */}
                    <div className={`${showCourt ? 'hidden md:flex' : 'hidden'} min-h-0 md:w-24 xl:w-28 2xl:w-32 shrink-0 bg-gray-800 border-l border-gray-700 flex-col`}>
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
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
                        {!reviewMode && <div className="shrink-0 border-t border-gray-700 p-2">
                            <VisMatchControls key={`${currentSet}-${rightTeam}`} teams={[makeCodeTeam(rightTeam)]}
                                stacked showTeamName={false} locked={isReadOnly} send={send} timeouts={timeouts} substitutions={substitutions} />
                        </div>}
                    </div>
                </div>
            </div>
            <VisHistoryPanel matchData={matchData} actionLog={actionLog} players={players} isHomeLeft={isHomeLeft}
                className="hidden h-full shrink-0 lg:block lg:w-[38%] xl:w-[40%] max-w-[760px]" />
            </div>
        </div>
    );
}
