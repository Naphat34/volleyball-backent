import { eventDetails } from './visPresentation.js';

const parse = value => {
    if (typeof value !== 'string') return value || {};
    try { return JSON.parse(value); } catch { return {}; }
};
const timestamp = (value, fallback) => {
    if (value == null || value === '') return fallback;
    const parsed = typeof value === 'number' ? value : new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : fallback;
};

export function buildSeavaExport(source, roster, saved, options = {}) {
    const match = { ...source, ...roster.match };
    const state = saved.state;
    const backupConfig = saved.backup?.config;
    const initial = saved.backup?.match || saved.backupMatch || match;
    const setup = parse(initial.vis_state);
    const now = options.now ?? Date.now();
    const id = String(match.id);
    const players = key => roster[key]?.players || backupConfig?.[key]?.players || [];
    const jersey = (key, playerId) => {
        const player = players(key).find(item => String(item.id) === String(playerId));
        if (!player) throw Error(`Cannot export lineup: player ${playerId} is missing from ${key} roster.`);
        return Number(player.number);
    };
    const team = key => {
        const name = match[`${key}_team_name`] || match[`${key}_team`] || backupConfig?.[key]?.name || '';
        return { name: match[`${key}_team_name_en`] || name, nameTh: name,
            shortName: match[`${key}_team_code`] || match[`${key}_team_short_name`] || '',
            color: options.colors?.[key] || match[`${key}_color`] || (key === 'home' ? '#8b5cf6' : '#3b82f6'),
            liberoColor: match[`${key}_libero_color`] || '', coach: match[`${key}_coach_name`] || match[`${key}_coach`] || '',
            players: players(key).map(player => ({ number: Number(player.number),
                name: player.name_en || [player.first_name_en, player.last_name_en].filter(Boolean).join(' ') || player.name || [player.first_name, player.last_name].filter(Boolean).join(' '),
                nameTh: player.name_th || player.name || [player.first_name, player.last_name].filter(Boolean).join(' '),
                role: player.role || player.position || '', captain: Boolean(Number(player.is_captain) || player.captain === true) })) };
    };
    const home = team('home'), away = team('away');
    const first = setup.setups?.[1] || setup;
    const lineups = Object.fromEntries(Object.entries(setup.setups || (setup.lineups ? { 1: setup } : {})).map(([set, entry]) => [set,
        Object.fromEntries(['home', 'away'].map(key => [key, (entry.lineups?.[key] || []).map(playerId => jersey(key, playerId))]))]));
    if (!Object.keys(lineups).length) lineups[1] = { home: [], away: [] };
    const config = {
        title: match.title || [home.shortName || home.nameTh, 'vs', away.shortName || away.nameTh].join(' ') + [match.round_name, match.pool_name && `สาย ${match.pool_name}`].filter(Boolean).map(value => ` · ${value}`).join(''),
        competition: match.competition_name || backupConfig?.title || '', division: match.division || match.age_group_name || '',
        venue: match.stadium_name || match.location || backupConfig?.location || '',
        date: String(match.match_date || backupConfig?.date || '').slice(0, 10), time: String(match.start_time || backupConfig?.time || '').slice(0, 5),
        matchNo: String(match.match_number || ''), round: match.round_name || '', pool: match.pool_name || '',
        gender: ({ Female: 'W', Male: 'M', Mixed: 'X' })[match.gender] || match.gender || '', report: [],
        bestOf: Number(state.maxSets) || 5, pointsPerSet: 25, decidingSetPoints: 15, maxTimeouts: 2,
        maxSubs: state.substitutionLimit || 6, rosterMin: 6, rosterMax: Number(match.competition_max_players) || 14,
        timeoutSeconds: 30, maxChallenges: 2, firstServe: state.firstServingTeam || first.servingTeam || null,
        home, away, lineups, court: { homeTop: state.firstSetHomeLeft !== false },
    };
    const actions = saved.backup?.actions || (saved.events || []).filter(event => event.action_type === 'VIS_STAT');
    const controls = setup.controls || [];
    const timeline = [
        ...actions.map(event => ({ event, order: Number(event.id), tie: 0 })),
        ...controls.map((event, index) => ({ event, order: Number(event.afterEventId) || 0, tie: index + 1 })),
    ].sort((a, b) => a.order - b.order || a.tie - b.tie);
    const createdAt = timestamp(match.created_at, timeline.length ? timestamp(timeline[0].event.created_at, now) : now);
    const events = [];
    const append = (code, ts, eventId) => events.push({ id: String(eventId), seq: events.length, ts, code, mt: ts, stream: 'scout', matchId: id });
    const sets = [...new Set([...Object.keys(lineups).map(Number), ...timeline.map(({ event }) => Number(event.set_number || event.set_id || 1))])].sort((a, b) => a - b);
    let latest = createdAt;
    for (const set of sets) {
        const entries = timeline.filter(({ event }) => Number(event.set_number || event.set_id || 1) === set);
        const setTime = entries.length ? timestamp(entries[0].event.created_at, latest) : latest;
        for (const key of ['home', 'away']) if (lineups[set]?.[key]?.length) append(`${key === 'home' ? '*' : 'a'}L${lineups[set][key].join(',')}`, setTime, `lineup-${id}-${set}-${key}`);
        for (const { event } of entries) {
            const details = eventDetails(event);
            const key = event.team || (String(event.team_id) === String(initial.home_team_id ?? match.home_team_id) ? 'home' : 'away');
            const prefix = key === 'home' ? '*' : 'a';
            let code;
            if (event.skill === 'TIMEOUT') code = `${prefix}TO`;
            else if (event.skill === 'SUBSTITUTION') code = `${prefix}SUB${jersey(key, details.playerOut)},${jersey(key, details.playerIn)}`;
            else {
                const number = details.jersey_number ?? (event.player_id == null ? null : jersey(key, event.player_id));
                code = event.event_code || details.event_code || `${prefix}${number == null ? '' : String(number).padStart(2, '0')}${event.skill}${event.grade || ''}`;
            }
            latest = timestamp(event.created_at, latest);
            append(code, latest, `${id}-${event.id}`);
        }
        if (state.completedSets?.some(entry => Number(entry.set ?? entry.set_number) === set)) append(`#E${set}`, latest, `set-end-${id}-${set}`);
    }
    const backup = saved.backup || {
        config: { title: config.competition || config.title, maxSets: config.bestOf, date: config.date || null, time: config.time || null, location: config.venue, gender: match.gender || '',
            ...Object.fromEntries(['home', 'away'].map(key => [key, { name: config[key].nameTh || config[key].name, players: players(key) }])) },
        match: initial, actions: actions.map(event => ({ ...event, details: eventDetails(event) })),
    };
    return { format: 'seava-vis', version: 1, match: { id, liveId: match.public_token || '', origin: match.is_offline_vis ? 'local' : 'server', config,
        createdAt, updatedAt: timestamp(match.updated_at, Math.max(createdAt, latest)), serverRev: Number(state.revision) || 0 }, events, backup };
}
