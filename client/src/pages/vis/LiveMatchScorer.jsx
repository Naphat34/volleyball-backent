import VisLineupPanel from '../../components/vis/VisLineupPanel';
import { api } from '../../api';
import { generateVisMatchPDF } from '../../utils/reports/pdfGenerator';
import Swal from 'sweetalert2';
import useVisScorer from '../../hooks/useVisScorer';
import VisCodeGuide from '../../components/vis/VisCodeGuide';
import './LiveMatchScorer.css';
import './VisScorerTheme.css';
import { useVisTheme } from '../../components/vis/visThemeContext';
import { visTeamPalette } from '../../utils/vis/visThemeColors';
import { formatVisDuration } from '../../utils/vis/visTiming';
import { visSetScoreSlots } from '../../utils/vis/visSetScores';
import VisCourtPanel from '../../components/vis/VisCourtPanel';
import { buildSetStats } from '../../utils/vis/visStatsCsv';
import { useLanguage } from '../../context/LanguageContext';
import { Settings, Maximize, Tablet, Wifi, Clock3, Timer, ArrowLeftRight } from 'lucide-react';
import VisRecordingPanel from '../../components/vis/VisRecordingPanel';
import { useEffect, useState } from 'react';
import VisToolbar from '../../components/vis/VisToolbar';
import VisMatchLayout from '../../components/vis/VisMatchLayout';
import VisMatchDialog from '../../components/vis/VisMatchDialog';

export default function LiveMatchScorer({ match, onClose, isReadOnly: requestedReadOnly = false }) {
    const { theme } = useVisTheme();
    const { language, setLanguage } = useLanguage();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);
    const [showGuide, setShowGuide] = useState(true);
    const [layout, setLayout] = useState('code');
    const [orientation, setOrientation] = useState('row');
    const [showCourt, setShowCourt] = useState(true);
    const [showVideo, setShowVideo] = useState(false);
    const [panelRatio, setPanelRatio] = useState(70);
    const [reversed, setReversed] = useState(false);
    const [courtReversed, setCourtReversed] = useState(false);
    const [dialog, setDialog] = useState(null);
    const [editingLineup, setEditingLineup] = useState(false);
    const [teamColors, setTeamColors] = useState({ home: '#905cff', away: '#397fff' });
    const resetLayout = () => { setShowGuide(true); setLayout('code'); setOrientation('row'); setShowCourt(true); setShowVideo(false); setPanelRatio(70); setReversed(false); setCourtReversed(false); };
    const changeLayout = value => { setLayout(value); setPanelRatio(value === 'code' ? 70 : value === 'video' ? 30 : 50); if (value !== 'code') setShowVideo(true); };
    const {
        matchData, homePlayers, awayPlayers, homeRotation, awayRotation, homeLibero, awayLibero,
        homeSubs, awaySubs, phase, isReadOnly, isSaving, pending, loadError, loading, syncError,
        currentSet, pointScore, setScores, setWins, servingTeam, server,
        isHomeLeft, actionLog, history, selectedPlayer,
        handlePlayerSelect, handleUndo, retrySave,
        send, teamA, lastSavedOperationId, contextChoice,
        activeContext, commandContext, setupComplete, requiresToss, timeouts, substitutions, substitutionLimit, timing, draftClock, startSetClock, setLineups,
    } = useVisScorer(match, requestedReadOnly);
    const players = [...homePlayers, ...awayPlayers];
    const makeCodeTeam = key => ({ key, name: key === 'home' ? matchData.home_team : matchData.away_team,
        players: key === 'home' ? homePlayers : awayPlayers, lineup: key === 'home' ? homeRotation : awayRotation });
    const makeEntryTeam = key => ({ ...makeCodeTeam(key), fullName: matchData[`${key}_team`],
        name: matchData[`${key}_team_code`]?.trim() || matchData[`${key}_team_short_name`]?.trim() || matchData[`${key}_team`] });
    const codeTeams = { A: makeEntryTeam(teamA), B: makeEntryTeam(teamA === 'home' ? 'away' : 'home') };
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
        <div className="vis-scorer-loading fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-gray-900 text-white">
            <p>{loadError || 'Loading saved VIS match...'}</p>
            <button onClick={onClose} className="rounded bg-gray-700 px-6 py-2">Close</button>
            {loadError && <button onClick={() => window.location.reload()} className="rounded bg-blue-700 px-6 py-2">Reload</button>}
        </div>
    );

    const displayHomeLeft = isHomeLeft !== courtReversed;
    const leftTeam = displayHomeLeft ? 'home' : 'away';
    const rightTeam = displayHomeLeft ? 'away' : 'home';
    const names = { home: matchData.home_team, away: matchData.away_team };
    const finished = phase === 'MATCH_FINISHED';
    const currentTiming = timing?.sets.find(set => set.set === currentSet);
    const startedAt = currentTiming?.startedAt || (draftClock?.setNumber === currentSet ? draftClock.startedAt : null);
    const elapsedSeconds = finished ? timing?.totalSeconds ?? null : currentTiming?.durationSeconds
        ?? (startedAt ? Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000)) : null);
    const elapsedTime = formatVisDuration(elapsedSeconds);
    const setScoreSlots = visSetScoreSlots({ maxSets: matchData.max_sets, completedSets: setScores, currentSet,
        score: pointScore, started: setupComplete || actionLog.some(event => Number(event.set_number) === currentSet), finished });
    const shortName = key => matchData[key + '_team_code'] || matchData[key + '_team_short_name'] || names[key];
    const scorePoints = (key, side) => <strong className={`vis-score-points vis-score-points-${side}`} style={{ color: `var(--vis-${key}-ink)` }}>
        {pointScore[key]}
        {!finished && servingTeam === key && <span className="vis-score-serving-ball" role="img" aria-label={`${shortName(key)} ได้เสิร์ฟ`} title={`${shortName(key)} ได้เสิร์ฟ`} />}
    </strong>;
    const teamScore = (key, right) => <div className={`vis-score-team ${right ? 'vis-score-team-right' : ''}`} style={{ '--team-color': teamColors[key], '--team-ink': `var(--vis-${key}-ink)`, '--team-card': `var(--vis-${key}-card)`, '--team-card-ink': `var(--vis-${key}-card-ink)` }}>
        <b className="vis-set-count">{setWins[key]}</b><div><h2>{names[key]}</h2><small>{matchData[key + '_team_name_en'] || shortName(key)}</small>
        <div className="vis-team-indicators" aria-label={`เวลานอก ${timeouts[key]} จาก 2 · เปลี่ยนตัว ${substitutions[key]} จาก ${substitutionLimit}`}><span><Clock3 size={12} />{Array.from({ length: 2 }, (_, i) => <i key={i} className={i < timeouts[key] ? 'vis-indicator-used' : ''} />)}</span><span><ArrowLeftRight size={13} />{Array.from({ length: substitutionLimit }, (_, i) => <i key={i} className={i < substitutions[key] ? 'vis-indicator-used' : ''} />)}</span></div></div>
    </div>;
    const teamPalette = Object.fromEntries(['home', 'away'].flatMap(key => {
        const palette = visTeamPalette(teamColors[key], theme);
        return [[`--vis-${key}-color`, teamColors[key]], [`--vis-${key}-ink`, palette.ink], [`--vis-${key}-card`, palette.card], [`--vis-${key}-card-ink`, palette.cardInk]];
    }));
    return <div className="vis-workspace" style={teamPalette}>
        <header className="vis-app-header">
            <strong>VIMS</strong><div className="vis-match-heading"><b>{names.home} vs {names.away}</b>{matchData.competition_name && <span> · {matchData.competition_name}</span>}</div>
            <div className="vis-app-actions"><button onClick={() => { setShowCourt(true); setShowVideo(false); }}><Tablet size={14} />Tablet</button>
                <button title="เต็มหน้าจอ" aria-label="เต็มหน้าจอ" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }}><Maximize size={16} /></button>
                <button title="ตั้งค่า" aria-label="ตั้งค่า" onClick={() => setDialog('settings')}><Settings size={17} /></button>
                <div className="vis-language"><button aria-pressed={language === 'THA'} onClick={() => setLanguage('THA')}>ไทย</button><button aria-pressed={language === 'ENG'} onClick={() => setLanguage('ENG')}>EN</button></div>
                <span className={`vis-sync-status ${syncError || pending ? 'vis-sync-warning' : ''}`}><Wifi size={13} />{isSaving ? 'กำลังบันทึก' : pending ? 'รอส่ง' : syncError ? 'ซิงค์ขัดข้อง' : 'Sync พร้อม'}</span>
            </div>
        </header>
        <VisToolbar exportOptions={{ colors: teamColors }} match={matchData} onClose={onClose} layout={layout} onLayout={changeLayout} orientation={orientation} onOrientation={setOrientation} onReset={resetLayout}
            showGuide={showGuide} onToggleGuide={() => setShowGuide(value => !value)} showCourt={showCourt} onToggleCourt={() => setShowCourt(value => !value)} showVideo={showVideo} onToggleVideo={() => setShowVideo(value => !value)}
            onSettings={() => setDialog('settings')} onStats={() => setDialog('stats')} onHelp={() => { setShowGuide(true); requestAnimationFrame(() => { document.getElementById('vis-guide-help')?.scrollIntoView({ block: 'nearest' }); document.getElementById('vis-guide-help')?.focus(); }); }}
            liveEnabled={!syncError} pending={pending} isSaving={isSaving} retrySave={retrySave} onConfirm={() => send({ type: 'CONFIRM' })} />
        <section className="vis-scoreboard" aria-label="คะแนนการแข่งขัน">
            {teamScore(leftTeam, false)}
            <div className="vis-score-center">{scorePoints(leftTeam, 'left')}<div className="vis-score-context"><b className={finished ? 'vis-phase-finished' : ''}>{finished ? 'จบการแข่งขัน' : 'เซต ' + currentSet}</b><div className="vis-set-scores">{setScoreSlots.map(score => <span key={score.set} className={score.active ? "vis-set-score-active" : ""} aria-label={(language === "THA" ? "เซต " : "Set ") + score.set + ": " + (score[leftTeam] ?? "-") + " - " + (score[rightTeam] ?? "-")}><small>{language === "THA" ? "เซต" : "Set"} {score.set}</small><b>{score[leftTeam] ?? "-"} - {score[rightTeam] ?? "-"}</b>{score.completed && <time className="vis-set-duration">{formatVisDuration(timing?.sets.find(set => set.set === score.set)?.durationSeconds)}</time>}</span>)}</div><div className="vis-score-times"><span title="เวลาปัจจุบัน"><Clock3 size={12} /><time>{new Date(now).toLocaleTimeString('en-GB', { hour12: false })}</time></span><span title={language === 'THA' ? (finished ? 'เวลารวม รวมพัก 3 นาที ยกเว้นก่อนเซตตัดสิน' : 'เวลาเซตปัจจุปัน') : (finished ? 'Total set time plus 3-minute intervals, excluding before the deciding set' : 'Current set duration')}><Timer size={12} /><b>{elapsedTime}</b></span></div>{isSaving && <small role="status">กำลังบันทึก…</small>}</div>{scorePoints(rightTeam, 'right')}</div>
            {teamScore(rightTeam, true)}
        </section>
        <main className={`vis-workspace-panels vis-fluid-panels vis-panels-${orientation}`}>
            {showCourt && (<VisCourtPanel teams={[{ ...makeEntryTeam(leftTeam), subs: leftTeam === 'home' ? homeSubs : awaySubs, libero: leftTeam === 'home' ? homeLibero : awayLibero }, { ...makeEntryTeam(rightTeam), subs: rightTeam === 'home' ? homeSubs : awaySubs, libero: rightTeam === 'home' ? homeLibero : awayLibero }]}
                setStats={buildSetStats(matchData, [makeEntryTeam('home'), makeEntryTeam('away')], actionLog, currentSet)}
                onReverse={() => setCourtReversed(value => !value)} onResetSides={() => setCourtReversed(false)}
                selectedPlayer={selectedPlayer} onSelect={handlePlayerSelect} server={server} servingTeam={servingTeam} locked={isReadOnly} reviewMode={reviewMode}
                onLineup={() => setEditingLineup(true)} send={send} timeouts={timeouts} substitutions={substitutions} substitutionLimit={substitutionLimit} />)}
            <section className="vis-code-panel" aria-label="โค้ดและประวัติ"><VisMatchLayout showVideo={showVideo} orientation={orientation} ratio={panelRatio} onRatio={setPanelRatio} reversed={reversed} onReverse={() => setReversed(value => !value)}>
                <VisRecordingPanel servingTeam={servingTeam} setLineups={setLineups} currentSet={currentSet} completedSets={setScores} setupComplete={setupComplete} matchData={matchData} locked={isReadOnly} reviewMode={reviewMode} finished={finished}
                    actionLog={actionLog} players={players} undoDisabled={undoDisabled} onUndo={undoLastSavedAction} contextChoice={contextChoice}
                    codeTeams={codeTeams} onTimingStart={startSetClock} send={send} lastSavedOperationId={lastSavedOperationId} activeContext={activeContext} commandContext={commandContext} />
            </VisMatchLayout></section>
            {showGuide && (<VisCodeGuide onStats={() => setDialog('stats')} actionLog={actionLog} matchData={matchData} />)}
        </main>
        {(!setupComplete || editingLineup) && !reviewMode && !finished && <VisLineupPanel key={currentSet} setNumber={currentSet} teams={[makeEntryTeam('home'), makeEntryTeam('away')]} locked={isReadOnly} requiresToss={requiresToss}
            initialServingTeam={servingTeam} initialHomeLeft={requiresToss ? null : isHomeLeft} send={send} onClose={() => setEditingLineup(false)} onCancel={editingLineup ? () => setEditingLineup(false) : onClose} />}
        {dialog && <VisMatchDialog mode={dialog} match={matchData} teams={[makeCodeTeam('home'), makeCodeTeam('away')]} events={actionLog} onClose={() => setDialog(null)} readOnly={isReadOnly}
            colors={teamColors} onColors={setTeamColors} onPDF={generatePDF} canEditLineup={currentSet === 1 && history.length === 0} onLineup={() => { setDialog(null); setEditingLineup(true); }} />}
    </div>;
}
