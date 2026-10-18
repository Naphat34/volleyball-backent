export const getTeamCode = (teamName) => {
    if (!teamName) return '';
    if (teamName.includes('-')) return teamName.split('-')[0].trim().toUpperCase();
    return teamName.substring(0, 3).toUpperCase();
};

// Keep the wire format identical for automatic saves and explicit workflow saves.
const liveStateFields = [
    'matchData', 'workflowStep', 'score', 'setsWon', 'timeouts', 'challenges',
    'substitutions', 'servingTeam', 'isHomeLeft', 'homeRoster', 'awayRoster',
    'homeLineup', 'awayLineup', 'homeLiberos', 'awayLiberos', 'homeLiberoSwaps',
    'awayLiberoSwaps', 'teamColors', 'showTimeoutTimer', 'timeoutStartTime',
    'matchDuration', 'isTimerRunning', 'setTimerStartedAt', 'subTracker', 'referees', 'matchSignatures',
    'currentChallengeReview', 'firstServeSet1', 'lineupSetup'
];

export const buildScorerLiveState = (state, overrides = {}) => ({
    ...Object.fromEntries(liveStateFields.map(key => [key, state[key]])),
    updatedAt: Date.now(),
    ...overrides
});

export const replaceLineupPlayer = (lineup, position, player, originalPos) => {
    const nextLineup = [...lineup];
    nextLineup[position] = { ...player, originalPos };
    return nextLineup;
};

export const isLineupSetupLocked = (currentSet, setup, team, field) => (
    Number(currentSet) > 1
    || Boolean(setup?.[team]?.[field])
    || Boolean(setup?.approvals?.[`${team}Captain`] || setup?.approvals?.[`${team}Coach`])
);

export const saveRosterApproval = (setup, field, signature) => {
    if (!['homeCaptain', 'homeCoach', 'awayCaptain', 'awayCoach'].includes(field)
        || !signature || setup?.approvals?.[field]) return setup;
    return { ...setup, approvals: { ...setup?.approvals, [field]: signature } };
};
