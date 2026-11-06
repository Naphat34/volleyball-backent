export function dashboardSetResult(match) {
    const officialSets = match.official_summary?.setsWon || { home: match.home_set_score, away: match.away_set_score };
    if (!match.is_custom_vis && (['live', 'completed'].includes(match.status)
        || Number(officialSets.home) > 0 || Number(officialSets.away) > 0)) {
        return `${match.official_summary?.setsWon?.home ?? match.home_set_score ?? 0} - ${match.official_summary?.setsWon?.away ?? match.away_set_score ?? 0}`;
    }
    const vis = match.vis_summary;
    const started = ['recording', 'review', 'confirmed'].includes(vis?.status)
        || Number(vis?.setsWon?.home) > 0 || Number(vis?.setsWon?.away) > 0
        || Number(vis?.score?.home) > 0 || Number(vis?.score?.away) > 0;
    if (!started) return '-';
    return `${vis?.setsWon?.home ?? 0} - ${vis?.setsWon?.away ?? 0}`;
}
export function officialCompletedSetScores(match) {
    let sets = match.set_scores;
    if (typeof sets === 'string') {
        try { sets = JSON.parse(sets); } catch { return []; }
    }
    if (!Array.isArray(sets)) return [];
    return sets.flatMap(value => {
        const parts = typeof value === 'string' ? value.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/) : null;
        if (!parts || Number(parts[1]) === Number(parts[2])) return [];
        return [`${Number(parts[1])}:${Number(parts[2])}`];
    });
}

