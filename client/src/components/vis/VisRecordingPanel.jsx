import { useState } from 'react';
import { History } from 'lucide-react';
import VisQuickEntry from './VisQuickEntry';
import VisHistoryPanel from './VisHistoryPanel';

export default function VisRecordingPanel({ matchData, locked, reviewMode,
    actionLog, players, undoDisabled, onUndo, isHomeLeft, codeTeams, send, lastSavedOperationId,
    contextChoice, activeContext, commandContext, servingTeam }) {
    const [mobileHistory, setMobileHistory] = useState(false);

    return <section className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-slate-600 bg-slate-900" aria-label="แผงบันทึกสถิติ VIS">
        {!reviewMode && <button className="m-2 inline-flex items-center justify-center gap-2 self-end rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 lg:hidden"
            onClick={() => setMobileHistory(value => !value)} aria-expanded={mobileHistory}>
            <History size={15} />{mobileHistory ? 'กลับไปบันทึก' : `ประวัติ (${actionLog.length})`}
        </button>}
        <div className="flex min-h-0 flex-1">
            {!reviewMode && <div className={`${mobileHistory ? 'hidden lg:block' : 'block'} min-w-0 flex-1 overflow-y-auto p-2`}>
                <VisQuickEntry key={contextChoice} servingTeam={servingTeam} teams={codeTeams} locked={locked} send={send}
                    score={activeContext?.score} commandContext={commandContext} lastSavedOperationId={lastSavedOperationId}
                    onUndo={onUndo} undoDisabled={undoDisabled} />
            </div>}
            <VisHistoryPanel matchData={matchData} actionLog={actionLog} players={players} isHomeLeft={isHomeLeft}
                className={`${reviewMode || mobileHistory ? 'block' : 'hidden'} w-full lg:hidden`} />
        </div>
    </section>;
}
