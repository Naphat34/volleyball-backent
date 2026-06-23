import React from 'react';
import { getContrastColorHex } from '../../../utils/colorUtils';

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
    onPointScored
}) {
    const isRallyOrLineup = workflowStep === 'RALLY' || workflowStep === 'LINEUP';

    return (
        <div className="p-2 flex flex-col gap-2 border-t border-slate-200 shrink-0">
            <div className="flex gap-2">
                {/* Left Col: Libero */}
                <div className="flex flex-col gap-1 w-1/2">
                    <button
                        onClick={() => onOpenLiberoSwap(team.code)}
                        disabled={isRallyOrLineup}
                        className="border text-[11px] font-bold py-1.5 rounded hover:bg-slate-50 disabled:opacity-50"
                        style={{ borderColor: team.color, color: team.color }}
                    >
                        Libero in
                    </button>
                    <button className="border border-slate-200 text-slate-300 text-[11px] font-bold py-1.5 rounded" disabled>
                        Libero exchange
                    </button>
                    <button className="border border-slate-200 text-slate-300 text-[11px] font-bold py-1.5 rounded" disabled>
                        New libero
                    </button>
                </div>
                
                {/* Right Col: Actions */}
                <div className="flex flex-col gap-1 w-1/2">
                    {/* Video Challenge */}
                    <div className="flex border rounded overflow-hidden" style={{ borderColor: team.color }}>
                        <button
                            onClick={() => onOpenChallenge(team.code)}
                            disabled={challenges[team.code] <= 0 || isRallyOrLineup}
                            className="flex-1 bg-white text-[10px] font-bold py-1.5 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                            style={{ borderColor: team.color, color: team.color }}
                        >
                            Video chall.
                        </button>
                        <div
                            className="w-6 flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: team.color, color: getContrastColorHex(team.color) }}
                        >
                            {challenges[team.code]}
                        </div>
                    </div>

                    {/* Timeout */}
                    <div className="flex border rounded overflow-hidden" style={{ borderColor: team.color }}>
                        <button
                            onClick={() => onActionSelect(team.code, 'TIMEOUT')}
                            disabled={timeouts[team.code] >= 2 || isRallyOrLineup}
                            className="flex-1 bg-white text-[11px] font-bold py-1.5 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                            style={{ borderColor: team.color, color: team.color }}
                        >
                            Timeout
                        </button>
                        <div
                            className="w-6 flex items-center justify-center text-[11px] font-bold"
                            style={{ backgroundColor: team.color, color: getContrastColorHex(team.color) }}
                        >
                            {timeouts[team.code]}
                        </div>
                    </div>

                    {/* Substitution */}
                    <div className="flex border rounded overflow-hidden" style={{ borderColor: team.color }}>
                        <button
                            onClick={() => onOpenSubstitution(team.code)}
                            disabled={isRallyOrLineup}
                            className="flex-1 bg-white text-[11px] font-bold py-1.5 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                            style={{ borderColor: team.color, color: team.color }}
                        >
                            Substitution
                        </button>
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
            <button
                onClick={() => onPointScored(team.code)}
                disabled={workflowStep !== 'RALLY'}
                className="w-full font-bold py-2.5 rounded-md text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: team.color, color: getContrastColorHex(team.color) }}
            >
                Point scored
            </button>
        </div>
    );
}
