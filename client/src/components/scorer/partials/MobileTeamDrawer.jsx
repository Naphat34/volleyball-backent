import { ArrowRightToLine, Video, Timer, Replace, CirclePlus } from 'lucide-react';
import useDisplayNames from '../../../hooks/useDisplayNames';
import useScorerTranslation from '../useScorerTranslation';
import { getTeamCode } from '../../../utils/scorer/scorerHelpers';
import React from 'react';
import { X } from 'lucide-react';
import TeamInfoPanel from './TeamInfoPanel';
import { getContrastColorHex } from '../../../utils/common/colorUtils';

export default function MobileTeamDrawer({
    mobilePanelTeam,
    onClose,
    leftTeam,
    rightTeam,
    workflowStep,
    challenges,
    timeouts,
    substitutions,
    teamColors,
    onPlayerClick,
    onOpenLiberoSwap,
    onOpenChallenge,
    onActionSelect,
    onOpenSubstitution,
    onPointScored,
    challengeEnabled = true
}) {
    const displayNames = useDisplayNames();
    const st = useScorerTranslation();
    if (!mobilePanelTeam) return null;

    const team = [leftTeam, rightTeam].find(candidate => candidate?.code === mobilePanelTeam);
    if (!team) return null;
    const isRallyOrLineup = workflowStep === 'RALLY' || workflowStep === 'LINEUP';
    const activeColor = teamColors[mobilePanelTeam];
    const contrastColor = getContrastColorHex(activeColor);

    return (
        <div className="scorer-team-drawer fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-end 2xl:hidden animate-fade-in pointer-events-auto">
            <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl relative overflow-hidden">
                {/* Drawer Header */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3
                        className="min-w-0 flex-1 truncate pr-3 text-base font-extrabold uppercase text-slate-800"
                        title={displayNames.teamName(team)}
                    >
                        {team.shortName?.trim() || getTeamCode(displayNames.teamName(team))}
                    </h3>
                    <button
                        onClick={onClose}
                        aria-label={st("Close team panel")}
                        className="min-h-11 min-w-11 p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Drawer Body - Team Roster */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2">
                    <TeamInfoPanel
                        team={team}
                        align={team.code === leftTeam.code ? 'left' : 'right'}
                        onPlayerClick={(side, pos) => {
                            onPlayerClick(side, pos);
                            onClose();
                        }}
                    />
                </div>

                {/* Drawer Footer - Action Controls */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
                    <div className="flex gap-2">
                        {/* Libero Button */}
                        <div className="flex flex-col gap-1 w-1/2">
                            <button
                                onClick={() => {
                                    onOpenLiberoSwap(mobilePanelTeam);
                                    onClose();
                                }}
                                disabled={isRallyOrLineup}
                                className="border text-[11px] font-bold py-2 rounded bg-white hover:bg-slate-50 disabled:opacity-50 animate-pulse"
                                style={{ borderColor: activeColor, color: '#000' }}
                            ><span className="flex items-center justify-center gap-1 px-1"><ArrowRightToLine size={14} className="shrink-0" aria-hidden="true" />{st("Libero in")}</span></button>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 w-1/2">
                            {/* Video Challenge */}
                            <div className="flex border rounded overflow-hidden bg-white" style={{ borderColor: activeColor }}>
                                <button
                                    onClick={() => {
                                        if (!challengeEnabled) return;
                                        onOpenChallenge(mobilePanelTeam);
                                        onClose();
                                    }}
                                    disabled={!challengeEnabled || challenges[mobilePanelTeam] <= 0 || isRallyOrLineup}
                                    className="flex-1 bg-white text-[10px] font-bold py-2 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                                    style={{ borderColor: activeColor, color: '#000' }}
                                    title={challengeEnabled ? st('Video challenge') : st('Challenge system is not enabled for this match')}
                                ><span className="flex items-center justify-center gap-1 px-1"><Video size={14} className="shrink-0" aria-hidden="true" />{st("Video chall.")}</span></button>
                                <div
                                    className="w-8 flex items-center justify-center text-[11px] font-bold"
                                    style={{ backgroundColor: activeColor, color: contrastColor }}
                                >
                                    {challenges[mobilePanelTeam]}
                                </div>
                            </div>

                            {/* Timeout */}
                            <div className="flex border rounded overflow-hidden bg-white" style={{ borderColor: activeColor }}>
                                <button
                                    onClick={() => {
                                        onActionSelect(mobilePanelTeam, 'TIMEOUT');
                                        onClose();
                                    }}
                                    disabled={timeouts[mobilePanelTeam] >= 2 || isRallyOrLineup}
                                    className="flex-1 bg-white text-[11px] font-bold py-2 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                                    style={{ borderColor: activeColor, color: '#000' }}
                                ><span className="flex items-center justify-center gap-1 px-1"><Timer size={14} className="shrink-0" aria-hidden="true" />{st("Timeout")}</span></button>
                                <div
                                    className="w-8 flex items-center justify-center text-[11px] font-bold"
                                    style={{ backgroundColor: activeColor, color: contrastColor }}
                                >
                                    {timeouts[mobilePanelTeam]}
                                </div>
                            </div>

                            {/* Substitution */}
                            <div className="flex border rounded overflow-hidden bg-white" style={{ borderColor: activeColor }}>
                                <button
                                    onClick={() => {
                                        onOpenSubstitution(mobilePanelTeam);
                                        onClose();
                                    }}
                                    disabled={isRallyOrLineup}
                                    className="flex-1 bg-white text-[11px] font-bold py-2 text-center border-r hover:bg-slate-50 disabled:opacity-50"
                                    style={{ borderColor: activeColor, color: '#000' }}
                                ><span className="flex items-center justify-center gap-1 px-1"><Replace size={14} className="shrink-0" aria-hidden="true" />{st("Substitution")}</span></button>
                                <div
                                    className="w-8 flex items-center justify-center text-[11px] font-bold"
                                    style={{ backgroundColor: activeColor, color: contrastColor }}
                                >
                                    {substitutions[mobilePanelTeam]}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Point Scored */}
                    <button
                        onClick={() => {
                            onPointScored(mobilePanelTeam);
                            onClose();
                        }}
                        disabled={workflowStep !== 'RALLY'}
                        className="w-full font-bold py-3 rounded-md text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                        style={{ backgroundColor: activeColor, color: contrastColor }}
                    ><span className="flex items-center justify-center gap-1 px-1"><CirclePlus size={14} className="shrink-0" aria-hidden="true" />{st("Point scored")}</span></button>
                </div>
            </div>
        </div>
    );
}
