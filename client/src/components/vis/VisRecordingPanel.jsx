import useUiTranslation from '../../hooks/useUiTranslation';
import VisQuickEntry from './VisQuickEntry';
import VisHistoryPanel from './VisHistoryPanel';

export default function VisRecordingPanel({ onClosePanel, matchData, locked, reviewMode, finished,
    actionLog, players, undoDisabled, onUndo, codeTeams, send, lastSavedOperationId,
    contextChoice, activeContext, commandContext, servingTeam, onTimingStart, setLineups, currentSet, completedSets, setupComplete }) {
    const ui = useUiTranslation();
    return <section className="vis-recording flex min-h-0 flex-1 flex-col" aria-label={ui("แผงบันทึกสถิติ VIMS")}>
        <VisHistoryPanel onClosePanel={onClosePanel} matchData={matchData} actionLog={actionLog} players={players} className="vis-main-history"
            setLineups={setLineups} currentSet={currentSet} completedSets={completedSets} setupComplete={setupComplete} finished={finished} />
        {(!reviewMode || finished) && <div className="vis-entry-dock">
            <VisQuickEntry key={contextChoice} onTimingStart={onTimingStart} servingTeam={servingTeam} teams={codeTeams} locked={locked} finished={finished} send={send}
                score={activeContext?.score} commandContext={commandContext} lastSavedOperationId={lastSavedOperationId}
                onUndo={onUndo} undoDisabled={undoDisabled} />
        </div>}
    </section>;
}
