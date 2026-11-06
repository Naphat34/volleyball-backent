export const hasMatchPlayActivity = (snapshot = {}) => {
    const scoreHome = Number(snapshot.score?.home) || 0;
    const scoreAway = Number(snapshot.score?.away) || 0;
    const setsWonHome = Number(snapshot.setsWon?.home) || 0;
    const setsWonAway = Number(snapshot.setsWon?.away) || 0;
    const matchDuration = Number(snapshot.matchDuration) || 0;
    const completedSets = Array.isArray(snapshot.completedSets) ? snapshot.completedSets : [];
    const matchEvents = Array.isArray(snapshot.matchEvents) ? snapshot.matchEvents : [];

    return (
        scoreHome > 0 ||
        scoreAway > 0 ||
        setsWonHome > 0 ||
        setsWonAway > 0 ||
        matchDuration > 0 ||
        completedSets.length > 0 ||
        matchEvents.some(event => {
            const eventType = String(event?.type || event?.event_type || '').toUpperCase();
            return ![
                'LINEUP_CONFIRM',
                'ROSTER_CONFIRM',
                'SETUP_CONFIRM',
                'MATCH_SETUP',
                'COIN_TOSS_WINNER',
                'COURT_SIDE_LEFT',
                'FIRST_SERVE'
            ].includes(eventType);
        })
    );
};

export const hasCompletedCoinToss = (snapshot = {}) => {
    const matchEvents = Array.isArray(snapshot.matchEvents) ? snapshot.matchEvents : [];

    return (
        Boolean(snapshot.servingTeam) ||
        Boolean(snapshot.firstServeSet1) ||
        matchEvents.some(event => {
            const eventType = String(event?.type || event?.event_type || '').toUpperCase();
            return ['COIN_TOSS_WINNER', 'COURT_SIDE_LEFT', 'FIRST_SERVE'].includes(eventType);
        })
    );
};

export const normalizeWorkflowStepForMatch = (step, snapshot = {}) => {
    if (!step) return hasCompletedCoinToss(snapshot) ? 'LINEUP' : 'COIN_TOSS';
    if (step === 'LINEUP' && !hasCompletedCoinToss(snapshot) && !hasMatchPlayActivity(snapshot)) return 'COIN_TOSS';
    if (step === 'SIGNATURES') return hasCompletedCoinToss(snapshot) ? 'LINEUP' : 'COIN_TOSS';
    if (step === 'MATCH_FINISHED' && !hasMatchPlayActivity(snapshot)) {
        return hasCompletedCoinToss(snapshot) ? 'LINEUP' : 'COIN_TOSS';
    }
    return step;
};

