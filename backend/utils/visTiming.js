function normalizeVisTiming(value, setNumber) {
    if (!value || Number(value.setNumber) !== Number(setNumber)) return null;
    const recorded = Date.parse(value.recordedAt);
    if (!Number.isFinite(recorded)) return null;
    const start = Date.parse(value.setStartedAt);
    return { setNumber: Number(setNumber), recordedAt: new Date(recorded).toISOString(),
        setStartedAt: Number.isFinite(start) && start <= recorded ? new Date(start).toISOString() : null };
}

function projectVisTiming(actions, completedSets, maxSets = 5) {
    const completed = new Set(completedSets.map(set => Number(set.set ?? set.number)));
    const groups = new Map();
    for (const action of actions) {
        if (action.action_type !== 'VIS_STAT') continue;
        const set = Number(action.set_number ?? action.set_id ?? 1);
        let details;
        try { details = typeof (action.details ?? action.description) === 'string' ? JSON.parse(action.details ?? action.description) : action.details || {}; } catch { details = {}; }
        const timing = normalizeVisTiming(details.visTiming, set);
        const recorded = Date.parse(timing?.recordedAt || action.created_at);
        if (!Number.isFinite(recorded)) continue;
        if (!groups.has(set)) groups.set(set, { set, startedAt: timing?.setStartedAt || new Date(recorded).toISOString(), lastAt: new Date(recorded).toISOString(), endedAt: null });
        const row = groups.get(set);
        // The first winning event freezes the set. Later statistical corrections do not extend it.
        if (!row.endedAt) row.lastAt = new Date(Math.max(Date.parse(row.lastAt), recorded)).toISOString();
        const score = details.visContext?.scoreAfter || { home: action.score_home, away: action.score_away };
        if (!row.endedAt && completed.has(set) && Math.max(Number(score.home), Number(score.away)) >= (set === Number(maxSets) ? 15 : 25)
            && Math.abs(Number(score.home) - Number(score.away)) >= 2) row.endedAt = row.lastAt;
    }
    const sets = [...groups.values()].sort((a, b) => a.set - b.set).map(row => {
        const endedAt = completed.has(row.set) ? row.endedAt || row.lastAt : null;
        return { set: row.set, startedAt: row.startedAt, endedAt,
            durationSeconds: endedAt ? Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(row.startedAt)) / 1000)) : null };
    });
    const finished = sets.filter(set => set.endedAt);
    const breakSeconds = finished.filter(set => completed.has(set.set + 1) && set.set + 1 !== Number(maxSets)).length * 180;
    return { sets, breakSeconds, totalSeconds: finished.length && finished.length === completed.size ? finished.reduce((sum, set) => sum + set.durationSeconds, 0) + breakSeconds : null };
}
module.exports = { normalizeVisTiming, projectVisTiming };
