const activeSetSteps = new Set(['SERVING', 'RALLY', 'CHALLENGE_REVIEW', 'SET_ENDING']);

export const getSetElapsedSeconds = (timer, now = Date.now()) => {
    const duration = Math.max(0, Number(timer.matchDuration) || 0);
    const startedAt = Number(timer.setTimerStartedAt);
    if (!timer.isTimerRunning || !Number.isFinite(startedAt) || startedAt <= 0) return duration;
    return Math.max(0, Math.floor((now - startedAt) / 1000));
};

export const restoreSetTimer = (snapshot = {}, now = Date.now()) => {
    const matchDuration = Math.max(0, Number(snapshot.matchDuration) || 0);
    // Active play must resume even if an older client saved a stale running flag.
    const isTimerRunning = snapshot.workflowStep
        ? activeSetSteps.has(snapshot.workflowStep)
        : snapshot.isTimerRunning === true;
    const savedStart = Number(snapshot.setTimerStartedAt);
    const setTimerStartedAt = isTimerRunning
        ? (Number.isFinite(savedStart) && savedStart > 0 ? savedStart : now - matchDuration * 1000)
        : null;
    const timer = { matchDuration, isTimerRunning, setTimerStartedAt };
    return { ...timer, matchDuration: getSetElapsedSeconds(timer, now) };
};
