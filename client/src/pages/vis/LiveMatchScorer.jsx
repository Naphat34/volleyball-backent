import { GuardedButton } from '../../components/ui/GuardedAction';
import useUiTranslation from '../../hooks/useUiTranslation';
import useVisTranslation from '../../components/vis/useVisTranslation';
import VisResizablePanel from '../../components/vis/VisResizablePanel';
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
import { visSetScoreSlots, visMatchFinished } from '../../utils/vis/visSetScores';
import VisCourtPanel from '../../components/vis/VisCourtPanel';
import { buildSetStats } from '../../utils/vis/visStatsCsv';
import { useLanguage } from '../../context/LanguageContext';
import { Settings, Tablet, Wifi, Clock3, Timer, ArrowLeftRight } from 'lucide-react';
import FullscreenToggle from '../../components/ui/FullscreenToggle';
import VisRecordingPanel from '../../components/vis/VisRecordingPanel';
import { useEffect, useRef, useState } from 'react';
import VisToolbar from '../../components/vis/VisToolbar';
import VisMatchLayout from '../../components/vis/VisMatchLayout';
import VisMatchDialog from '../../components/vis/VisMatchDialog';

export default function LiveMatchScorer({ match, onClose, isReadOnly: requestedReadOnly = false }) {
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const { theme } = useVisTheme();
    const { language, setLanguage } = useLanguage();
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);
    const [showGuide, setShowGuide] = useState(true);
    const [orientation, setOrientation] = useState('row');
    const [showCourt, setShowCourt] = useState(true);
    const [showCode, setShowCode] = useState(true);
    const [panelWidths, setPanelWidths] = useState({ court: 22, code: 48, guide: 28 });
    const [showVideo, setShowVideo] = useState(false);
    const [panelRatio, setPanelRatio] = useState(70);
    const [reversed, setReversed] = useState(false);
    const [courtReversed, setCourtReversed] = useState(false);
    const [dialog, setDialog] = useState(null);
    const [editingLineup, setEditingLineup] = useState(false);
    const lineupAlerted = useRef(null);
    const [teamColors, setTeamColors] = useState({ home: '#905cff', away: '#397fff' });
    const resetLayout = () => { setShowCode(true); setPanelWidths({ court: 22, code: 48, guide: 28 }); setShowGuide(true); setOrientation('row'); setShowCourt(true); setShowVideo(false); setPanelRatio(70); setReversed(false); setCourtReversed(false); };
    const {
        matchData, homeStaff, awayStaff, homePlayers, awayPlayers, homeRotation, awayRotation, homeLibero, awayLibero,
        homeSubs, awaySubs, phase, isReadOnly, isSaving, pending, loadError, loading, syncError,
        currentSet, pointScore, setScores, setWins, servingTeam, server,
        isHomeLeft, actionLog, history, selectedPlayer,
        handlePlayerSelect, handleUndo, retrySave,
        send, teamA, lastSavedOperationId, contextChoice,
        liberoReplacements, activeContext, commandContext, setupComplete, requiresToss, timeouts, substitutions, substitutionLimit, timing, draftClock, startSetClock, setLineups,
    } = useVisScorer(match, requestedReadOnly);
    useEffect(() => {
        setTeamColors({ home: matchData.home_team_color || '#905cff', away: matchData.away_team_color || '#397fff' });
    }, [match.id, matchData.home_team_color, matchData.away_team_color]);
    const finished = visMatchFinished({ phase, setsWon: setWins, maxSets: matchData.max_sets });
    useEffect(() => {
        const key = match.id + ':' + currentSet;
        if (loading || loadError || setupComplete || finished || isReadOnly || lineupAlerted.current === key) return;
        let active = true;
        const timer = setTimeout(() => {
        lineupAlerted.current = key;
        Swal.fire({
            icon: 'warning',
            title: vt('กรุณาจัดไลน์อัป'),
            text: language === 'ENG' ? 'Complete and confirm the lineup for set ' + currentSet + ' before recording statistics.' : 'ยังไม่ได้จัดไลน์อัปให้ครบสำหรับเซต ' + currentSet + ' กรุณาจัดผู้เล่นและยืนยันก่อนบันทึกสถิติ',
            confirmButtonText: vt('จัดไลน์อัป'),
            showCancelButton: true,
            cancelButtonText: vt('ภายหลัง'),
            showCloseButton: true,
        }).then(result => { if (active && result.isConfirmed) setEditingLineup(true); });
        }, 0);
        return () => { active = false; clearTimeout(timer); if (lineupAlerted.current === key) Swal.close(); };
    }, [match.id, currentSet, loading, loadError, setupComplete, finished, isReadOnly, language, vt]);
    const players = [...homePlayers, ...awayPlayers];
    const makeCodeTeam = key => ({ key, staff: key === 'home' ? homeStaff : awayStaff, liberoReplacement: liberoReplacements[key], name: matchData[key + (language === 'ENG' ? '_team_name_en' : '_team_name_th')] || matchData[key + '_team'],
        players: key === 'home' ? homePlayers : awayPlayers, lineup: key === 'home' ? homeRotation : awayRotation });
    const makeEntryTeam = key => ({ ...makeCodeTeam(key), fullName: matchData[key + (language === 'ENG' ? '_team_name_en' : '_team_name_th')] || matchData[`${key}_team`],
        name: matchData[`${key}_team_code`]?.trim() || matchData[`${key}_team_short_name`]?.trim() || matchData[`${key}_team`] });
    const codeTeams = { A: makeEntryTeam(teamA), B: makeEntryTeam(teamA === 'home' ? 'away' : 'home') };
    const undoDisabled = requestedReadOnly || matchData.offline_released || ['confirmed', 'cancelled'].includes(matchData.vis_lifecycle) || isSaving || Boolean(pending) || history.length === 0;
    const reviewMode = requestedReadOnly || matchData.offline_released;
    const undoLastSavedAction = async () => {
        if (undoDisabled) return;
        await handleUndo();
    };

    const generatePDF = async () => {
        const selection = await Swal.fire({ uiTextLocalized: true,
            title: (language === 'ENG' ? ui('Export PDF report') : ui('ส่งออกรายงาน PDF')),
            html: language === 'ENG' ? ui('<p>Match summary and player statistics for both teams</p><label style="display:block;text-align:left;margin-top:16px"><input id="vis-pdf-sets" type="checkbox"> Include set details</label><label style="display:block;text-align:left;margin-top:12px"><input id="vis-pdf-history" type="checkbox"> Include event history</label>') : ui('<p>รายงานสรุปการแข่งขันและสถิติรายบุคคลทั้งสองทีม</p><label style="display:block;text-align:left;margin-top:16px"><input id="vis-pdf-sets" type="checkbox"> เพิ่มรายละเอียดรายเซต</label><label style="display:block;text-align:left;margin-top:12px"><input id="vis-pdf-history" type="checkbox"> เพิ่มประวัติเหตุการณ์</label>'),
            showCancelButton: true,
            confirmButtonText: (language === 'ENG' ? ui('Download PDF') : ui('ดาวน์โหลด PDF')),
            cancelButtonText: vt('ยกเลิก'),
            preConfirm: () => ({
                includeSets: document.getElementById('vis-pdf-sets').checked,
                includeHistory: document.getElementById('vis-pdf-history').checked,
            }),
        });
        if (!selection.isConfirmed) return;
        try {
            Swal.fire({ uiTextLocalized: true,
                title: (language === 'ENG' ? ui('Generating report...') : ui('กำลังสร้างรายงาน...')),
                text: (language === 'ENG' ? ui('Loading saved data and generating PDF') : ui('กำลังดึงข้อมูลที่บันทึกและสร้าง PDF')),
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const response = await api.getMatchScoresheetData(match.id);
            await generateVisMatchPDF(response.data, { ...selection.value, language });

            Swal.fire({ uiTextLocalized: true,
                title: (language === 'ENG' ? ui('Report generated') : ui('สร้างรายงานแล้ว')),
                text: (language === 'ENG' ? ui('VIMS statistics report downloaded') : ui('ดาวน์โหลดรายงานสถิติ VIMS เรียบร้อยแล้ว')),
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
        } catch (error) {
            console.error("PDF Generation Error:", error);
            Swal.fire({ uiTextLocalized: true,
                title: ui('Error'),
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
            <p>{(loadError) || (ui('Loading saved VIMS match...'))}</p>
            <GuardedButton onClick={onClose} className="rounded bg-gray-700 px-6 py-2">{ui("Close")}</GuardedButton>
            {loadError && <GuardedButton onClick={() => window.location.reload()} className="rounded bg-blue-700 px-6 py-2">{ui("Reload")}</GuardedButton>}
        </div>
    );

    const displayHomeLeft = isHomeLeft !== courtReversed;
    const leftTeam = displayHomeLeft ? 'home' : 'away';
    const rightTeam = displayHomeLeft ? 'away' : 'home';
    const names = Object.fromEntries(['home','away'].map(key => [key, matchData[key + (language === 'THA' ? '_team_name_th' : '_team_name_en')] || matchData[key + '_team']]));
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
        {!finished && servingTeam === key && <span className="vis-score-serving-ball" role="img" aria-label={ui(`{0} ได้เสิร์ฟ`, [shortName(key)])} title={ui(`{0} ได้เสิร์ฟ`, [shortName(key)])} />}
    </strong>;
    const teamScore = (key, right) => <div className={`vis-score-team ${right ? 'vis-score-team-right' : ''}`} style={{ '--team-color': teamColors[key], '--team-ink': `var(--vis-${key}-ink)`, '--team-card': `var(--vis-${key}-card)`, '--team-card-ink': `var(--vis-${key}-card-ink)` }}>
        <b className="vis-set-count">{setWins[key]}</b><div><h2>{names[key]}</h2><small title={matchData[key + '_team_name_en']?.trim() ? undefined : ui('ยังไม่ได้ระบุชื่อทีมภาษาอังกฤษ')}>{matchData[key + '_team_name_en']?.trim() || '—'}</small>
        <div className="vis-team-indicators" aria-label={ui(`เวลานอก {0} จาก 2 · เปลี่ยนตัว {1} จาก {2}`, [timeouts[key], substitutions[key], substitutionLimit])}><span><Clock3 size={12} />{Array.from({ length: 2 }, (_, i) => <i key={i} className={i < timeouts[key] ? 'vis-indicator-used' : ''} />)}</span><span><ArrowLeftRight size={13} />{Array.from({ length: substitutionLimit }, (_, i) => <i key={i} className={i < substitutions[key] ? 'vis-indicator-used' : ''} />)}</span></div></div>
    </div>;
    const teamPalette = Object.fromEntries(['home', 'away'].flatMap(key => {
        const palette = visTeamPalette(teamColors[key], theme);
        return [[`--vis-${key}-color`, teamColors[key]], [`--vis-${key}-ink`, palette.ink], [`--vis-${key}-card`, palette.card], [`--vis-${key}-card-ink`, palette.cardInk]];
    }));
    return <div className="vis-workspace" style={teamPalette}>
        <header className="vis-app-header">
            <strong>{ui("VIMS")}</strong><div className="vis-match-heading"><b>{names.home}{' '}{ui("vs")}{' '}{names.away}</b>{matchData.competition_name && <span> · {matchData.competition_name.replace(/\s*\(Male\)/gi, '').trim()}</span>}</div>
            <div className="vis-app-actions"><GuardedButton onClick={() => { setShowCourt(true); setShowVideo(false); }}><Tablet size={14} />{ui("Tablet")}</GuardedButton>
                <FullscreenToggle size={16} />
                <GuardedButton title={vt("ตั้งค่า")} aria-label={vt("ตั้งค่า")} onClick={() => setDialog('settings')}><Settings size={17} /></GuardedButton>
                <div className="vis-language"><GuardedButton aria-pressed={language === 'THA'} onClick={() => setLanguage('THA')}>{ui("ไทย")}</GuardedButton><GuardedButton aria-pressed={language === 'ENG'} onClick={() => setLanguage('ENG')}>{ui("EN")}</GuardedButton></div>
                <span className={`vis-sync-status ${syncError || pending ? 'vis-sync-warning' : ''}`}><Wifi size={13} />{isSaving ? vt('กำลังบันทึก') : pending ? vt('รอส่ง') : syncError ? vt('ซิงค์ขัดข้อง') : vt('Sync พร้อม')}</span>
            </div>
        </header>
        <VisToolbar exportOptions={{ colors: teamColors }} match={matchData} onClose={onClose} orientation={orientation} onOrientation={setOrientation} onReset={resetLayout}
            showCode={showCode} onToggleCode={() => setShowCode(value => !value)} showGuide={showGuide} onToggleGuide={() => setShowGuide(value => !value)} showCourt={showCourt} onToggleCourt={() => setShowCourt(value => !value)} showVideo={showVideo} onToggleVideo={() => { setShowCode(true); setShowVideo(value => !value); }}
            onSettings={() => setDialog('settings')} onStats={() => setDialog('stats')} onHelp={() => { setShowGuide(true); requestAnimationFrame(() => { document.getElementById('vis-guide-help')?.scrollIntoView({ block: 'nearest' }); document.getElementById('vis-guide-help')?.focus(); }); }}
            liveEnabled={!syncError} pending={pending} isSaving={isSaving} retrySave={retrySave} onConfirm={() => send({ type: 'CONFIRM' })} />
        <section className="vis-scoreboard" aria-label={vt("คะแนนการแข่งขัน")}>
            {teamScore(leftTeam, false)}
            <div className="vis-score-center">{scorePoints(leftTeam, 'left')}<div className="vis-score-context"><b className={finished ? 'vis-phase-finished' : ''}>{finished ? ui('Match finished') : vt('เซต ') + currentSet}</b><div className="vis-set-scores">{setScoreSlots.filter(score => score.completed || score.home > 0 || score.away > 0).map(score => <span key={score.set} className={score.active ? "vis-set-score-active" : ""} aria-label={(language === "THA" ? vt("เซต ") : "Set ") + score.set + ": " + (score[leftTeam] ?? "-") + " - " + (score[rightTeam] ?? "-")}>{score.completed && score[leftTeam] > score[rightTeam] ? <strong>{score[leftTeam]}</strong> : score[leftTeam] ?? "-"}{' : '}{score.completed && score[rightTeam] > score[leftTeam] ? <strong>{score[rightTeam]}</strong> : score[rightTeam] ?? "-"}</span>)}</div><div className="vis-score-times"><span title={vt("เวลาปัจจุบัน")}><Clock3 size={12} /><time>{new Date(now).toLocaleTimeString('en-GB', { hour12: false })}</time></span><span title={language === 'THA' ? finished ? ui('เวลารวม รวมพัก 3 นาที ยกเว้นก่อนเซตตัดสิน') : ui('เวลาเซตปัจจุปัน') : finished ? ui('Total set time plus 3-minute intervals, excluding before the deciding set') : ui('Current set duration')}><Timer size={12} /><b>{elapsedTime}</b></span></div>{isSaving && <small role="status">{vt("กำลังบันทึก…")}</small>}</div>{scorePoints(rightTeam, 'right')}</div>
            {teamScore(rightTeam, true)}
        </section>
        <main className={`vis-workspace-panels vis-fluid-panels vis-panels-${orientation}`}>
            {showCourt && (<VisResizablePanel id="court" title={vt("สนามและการควบคุม")} weight={panelWidths.court} orientation={orientation} onResize={sizes => setPanelWidths(previous => ({ ...previous, ...sizes }))} onClose={() => setShowCourt(false)}><VisCourtPanel onClosePanel={() => setShowCourt(false)} teams={[{ ...makeEntryTeam(leftTeam), subs: leftTeam === 'home' ? homeSubs : awaySubs, libero: leftTeam === 'home' ? homeLibero : awayLibero }, { ...makeEntryTeam(rightTeam), subs: rightTeam === 'home' ? homeSubs : awaySubs, libero: rightTeam === 'home' ? homeLibero : awayLibero }]}
                setStats={buildSetStats(matchData, [makeEntryTeam('home'), makeEntryTeam('away')], actionLog, currentSet)}
                onReverse={() => setCourtReversed(value => !value)} onResetSides={() => setCourtReversed(false)}
                selectedPlayer={selectedPlayer} onSelect={handlePlayerSelect} server={server} servingTeam={servingTeam} locked={isReadOnly} reviewMode={reviewMode}
                onLineup={() => setEditingLineup(true)} send={send} timeouts={timeouts} substitutions={substitutions} substitutionLimit={substitutionLimit} /></VisResizablePanel>)}
            {showCode && <VisResizablePanel id="code" title={vt("โค้ดและประวัติ")} weight={panelWidths.code} orientation={orientation} onResize={sizes => setPanelWidths(previous => ({ ...previous, ...sizes }))} onClose={() => setShowCode(false)}><section className="vis-code-panel" aria-label={vt("โค้ดและประวัติ")}><VisMatchLayout onCloseVideo={() => setShowVideo(false)} showVideo={showVideo} orientation={orientation} ratio={panelRatio} onRatio={setPanelRatio} reversed={reversed} onReverse={() => setReversed(value => !value)}>
                <VisRecordingPanel onClosePanel={() => setShowCode(false)} servingTeam={servingTeam} setLineups={setLineups} currentSet={currentSet} completedSets={setScores} setupComplete={setupComplete} matchData={matchData} locked={isReadOnly} reviewMode={reviewMode} finished={finished}
                    actionLog={actionLog} players={players} undoDisabled={undoDisabled} onUndo={undoLastSavedAction} contextChoice={contextChoice}
                    codeTeams={codeTeams} onTimingStart={startSetClock} send={send} lastSavedOperationId={lastSavedOperationId} activeContext={activeContext} commandContext={commandContext} />
            </VisMatchLayout></section></VisResizablePanel>}
            {showGuide && (<VisResizablePanel id="guide" title={vt("คู่มือและสถิติ")} weight={panelWidths.guide} orientation={orientation} onResize={sizes => setPanelWidths(previous => ({ ...previous, ...sizes }))} onClose={() => setShowGuide(false)}><VisCodeGuide onClosePanel={() => setShowGuide(false)} onStats={() => setDialog('stats')} actionLog={actionLog} matchData={matchData} /></VisResizablePanel>)}
        </main>
        {editingLineup && !reviewMode && !finished && <VisLineupPanel colors={teamColors} key={currentSet} setNumber={currentSet} teams={[makeEntryTeam('home'), makeEntryTeam('away')]} locked={isReadOnly} requiresToss={requiresToss}
            initialServingTeam={servingTeam} initialHomeLeft={requiresToss ? null : isHomeLeft} send={send} onClose={() => setEditingLineup(false)} />}
        {dialog && <VisMatchDialog mode={dialog} match={matchData} teams={[makeCodeTeam('home'), makeCodeTeam('away')]} events={actionLog} onClose={() => setDialog(null)} readOnly={isReadOnly}
            colors={teamColors} onColors={setTeamColors} onPDF={generatePDF} canEditLineup={currentSet === 1 && history.length === 0} onLineup={() => { setDialog(null); setEditingLineup(true); }} />}
    </div>;
}
