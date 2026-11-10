export function visMatchFinished({ phase, setsWon = {}, maxSets = 5 }) {
    const count = [3, 5].includes(Number(maxSets)) ? Number(maxSets) : 5;
    return phase === 'MATCH_FINISHED' || Math.max(Number(setsWon.home) || 0, Number(setsWon.away) || 0) >= Math.floor(count / 2) + 1;
}

export function visSetScoreSlots({ maxSets = 5, completedSets = [], currentSet = 1, score = {}, started = false, finished = false }) {
    const count = [3, 5].includes(Number(maxSets)) ? Number(maxSets) : 5;
    return Array.from({ length: count }, (_, index) => {
        const set = index + 1;
        const completed = completedSets.find(item => Number(item.set ?? item.set_number ?? item.number) === set);
        const active = !finished && Number(currentSet) === set;
        const values = completed || (active && started ? score : null);
        const value = key => {
            const raw = values?.[key] ?? values?.[`${key}_score`];
            return raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
        };
        return { set, home: value('home'), away: value('away'), completed: Boolean(completed), active };
    });
}
