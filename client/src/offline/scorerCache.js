// Keep cached reads consistent with commands committed to the local journal.
export function applyScorerCache(record, operation) {
    const { path, body, id, at } = operation, prefix = `/scorer/match/${record.id}`;
    const match = record.cache[prefix];
    if (path === 'state' || path === 'undo') {
        record.cache[`${prefix}/state`] = body.state;
        match.live_state = body.state;
        if (path === 'undo') {
            const keep = new Set(body.keepLocalIds || []);
            record.cache[`${prefix}/events`] = (record.cache[`${prefix}/events`] || []).filter(event => !event.offline || keep.has(event.local_event_id) || keep.has(event.id));
        }
    }
    if (path === 'event') {
        record.cache[`${prefix}/events`] = [{ ...body, id: body.local_event_id || id, local_event_id: body.local_event_id || id,
            match_id: record.id, set_id: body.set_number, skill: body.event_type, offline: true, created_at: new Date(at).toISOString() }, ...(record.cache[`${prefix}/events`] || [])];
    }
    if (path === 'lineup') {
        const roster = record.cache[`${prefix}/roster`];
        const players = [...(roster?.home?.players || []), ...(roster?.away?.players || [])];
        const player = value => typeof value === 'object' && value ? value : players.find(p => String(p.id) === String(value)) || { id: value };
        const lineup = { team_id: body.team_id, set_number: body.set_number, lineup: body.player_positions.map(player), libero: body.libero_id ? player(body.libero_id) : null };
        record.cache[`${prefix}/lineup`] = [lineup, ...(record.cache[`${prefix}/lineup`] || []).filter(row => !(String(row.team_id) === String(body.team_id) && (!row.set_number || Number(row.set_number) === Number(body.set_number))))];
    }
    if (path === 'roster') {
        const roster = record.cache[`${prefix}/roster`];
        if (roster) for (const team of ['home', 'away']) roster[team].players = body[`${team}Players`] || roster[team].players;
    }
    if (path === 'officials') Object.assign(match, body);
}

export function hydrateScorerCache(record) {
    if (!record.cache || record.cacheVersion === 1) return record;
    for (const operation of record.queue || []) applyScorerCache(record, operation);
    record.cacheVersion = 1;
    return record;
}

export function scorerStorageSnapshot(record) {
    const state = record.cache?.[`/scorer/match/${record.id}/state`];
    const values = { ...record.localStorage };
    if (state && typeof state === 'object') {
        for (const [key, value] of Object.entries(state)) values[`match_${record.id}_${key}`] = JSON.stringify(value);
    }
    return values;
}
