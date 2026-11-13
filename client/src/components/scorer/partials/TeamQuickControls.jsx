import { GuardedButton } from '../../ui/GuardedAction';
import useScorerTranslation from '../useScorerTranslation';
import React from 'react';
import { ArrowRightToLine, ArrowLeftRight, UserPlus, Video, Timer, Replace, CirclePlus } from 'lucide-react';
import { getContrastColorHex } from '../../../utils/common/colorUtils';

export default function TeamQuickControls({
    team,
    workflowStep,
    challenges,
    timeouts,
    substitutions,
    onOpenLiberoSwap,
    onOpenChallenge,
    onActionSelect,
    onOpenSubstitution,
    onPointScored,
    challengeEnabled = true
}) {
    const st = useScorerTranslation();
    const isRallyOrLineup = workflowStep === 'RALLY' || workflowStep === 'LINEUP';

    return (
        <div className="p-2 flex flex-col gap-2 border-t border-slate-200 shrink-0">
            <div className="flex gap-2">
                {/* Left Col: Libero */}
                <div className="flex flex-col gap-1 w-1/2">
                    <GuardedButton
                        onClick={() => onOpenLiberoSwap(team.code)}
                        disabled={isRallyOrLineup}
                        className="border text-[11px] font-bold py-1.5 rounded hover:bg-slate-50 disabled:opacity-50"
                        style={{ borderColor: team.color, color: 'var(--scorer-control-ink, #000)' }}
                    ><span className="flex items-center justify-center gap-1 px-1"><ArrowRightToLine size={14} className="shrink-0" aria-hidden="true" />{st("Libero in")}</span></GuardedButton>
                    <GuardedButton className="border border-slate-200 text-slate-300 text-[11px] font-bold py-1.5 rounded" disabled><span className="flex items-center justify-center gap-1 px-1"><ArrowLeftRight size={14} className="shrink-0" aria-hidden="true" />{st("Libero exchange")}</span></GuardedButton>
                    <GuardedButton className="border border-slate-200 text-slate-300 text-[11px] font-bold py-1.5 rounded" disabled><span className="flex items-center justify-center gap-1 px-1"><UserPlus size={14} className="shrink-0" aria-hidden="true" />{st("New libero")}</span></GuardedButton>
                </div>
                
                {/* Right Col: Actions */}
                <div className="flex flex-col gap-1 w-1/2">
                    {/* Video Challenge */}
                    <div className="flex border rounded overflow-hidden" style={{ borderColor: team.color }}>
                        <GuardedButton
                            onClick={() => onOpenChallenge(team.code)}
                            disabled={!challengeEnabled || challenges[team.code] <= 0 || isRallyOrLineup}
                            className="flex-1 bg-white text-[10px] font-bold py-1.5 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                            style={{ borderColor: team.color, color: 'var(--scorer-control-ink, #000)' }}
                            title={challengeEnabled ? st('Video challenge') : st('Challenge system is not enabled for this match')}
                        ><span className="flex items-center justify-center gap-1 px-1"><Video size={14} className="shrink-0" aria-hidden="true" />{st("Video chall.")}</span></GuardedButton>
                        <div
                            className="w-6 flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: team.color, color: getContrastColorHex(team.color) }}
                        >
                            {challenges[team.code]}
                        </div>
                    </div>

                    {/* Timeout */}
                    <div className="flex border rounded overflow-hidden" style={{ borderColor: team.color }}>
                        <GuardedButton
                            onClick={() => onActionSelect(team.code, 'TIMEOUT')}
                            disabled={timeouts[team.code] >= 2 || isRallyOrLineup}
                            className="flex-1 bg-white text-[11px] font-bold py-1.5 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                            style={{ borderColor: team.color, color: 'var(--scorer-control-ink, #000)' }}
                        ><span className="flex items-center justify-center gap-1 px-1"><Timer size={14} className="shrink-0" aria-hidden="true" />{st("Timeout")}</span></GuardedButton>
                        <div
                            className="w-6 flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: team.color, color: getContrastColorHex(team.color) }}
                        >
                            {timeouts[team.code]}
                        </div>
                    </div>

                    {/* Substitution */}
                    <div className="flex border rounded overflow-hidden" style={{ borderColor: team.color }}>
                        <GuardedButton
                            onClick={() => onOpenSubstitution(team.code)}
                            disabled={isRallyOrLineup}
                            className="flex-1 bg-white text-[11px] font-bold py-1.5 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                            style={{ borderColor: team.color, color: 'var(--scorer-control-ink, #000)' }}
                        ><span className="flex items-center justify-center gap-1 px-1"><Replace size={14} className="shrink-0" aria-hidden="true" />{st("Substitution")}</span></GuardedButton>
                        <div
                            className="w-6 flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: team.color, color: getContrastColorHex(team.color) }}
                        >
                            {substitutions[team.code]}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Point Scored */}
            <GuardedButton
                onClick={() => onPointScored(team.code)}
                disabled={workflowStep !== 'RALLY'}
                className="w-full font-bold py-2.5 rounded-md text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: team.color, color: getContrastColorHex(team.color) }}
            ><span className="flex items-center justify-center gap-1"><CirclePlus size={16} className="shrink-0" aria-hidden="true" />{st("Point scored")}</span></GuardedButton>
        </div>
    );
}
