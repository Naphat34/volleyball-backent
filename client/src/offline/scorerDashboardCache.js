import { localRead } from './localRead.js';

const DATABASE = 'volley-scorer-dashboard-v1', STORE = 'snapshots', VERSION = 1;
const keyFor = (userId, role, kind) => `${String(userId)}:${String(role).toLowerCase()}:${kind}`;
const validScope = (userId, role, kind) => userId != null && String(userId) !== '' && Boolean(role) && ['server', 'manual'].includes(kind);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
const matchFields = ['id', 'competition_id', 'competition_name', 'competition_title', 'match_number', 'match_date', 'raw_start_time', 'start_time', 'start_date', 'location', 'round_name', 'pool_name', 'age_group_name', 'category', 'gender', 'competition_gender', 'home_team', 'away_team', 'home_team_name', 'away_team_name', 'home_team_id', 'away_team_id', 'home_set_score', 'away_set_score', 'status', 'max_sets', 'is_manual_scorer', 'manual_lifecycle', 'manual_owner_id', 'manual_published', 'first_serve_team_id', 'dashboard_stale'];
function cacheMatch(match) {
    const result = pick(match, matchFields);
    Object.assign(result, pick(match, ['competition_name_th', 'competition_name_en', 'competition_title_th', 'competition_title_en']));
    for (const key of ['official_summary', 'vis_summary']) {
        if (!match[key]) continue;
        result[key] = pick(match[key], ['currentSet', 'status', 'hasActivity']);
        for (const score of ['score', 'setsWon']) if (match[key][score]) result[key][score] = pick(match[key][score], ['home', 'away']);
    }
    return result;
}

function access(mode, operation) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        let blocked = false;
        request.onblocked = () => { blocked = true; reject(Error('Local dashboard storage is blocked')); };
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            if (blocked) { db.close(); return; }
            const tx = db.transaction(STORE, mode);
            let result;
            let action;
            try { action = operation(tx.objectStore(STORE)); }
            catch (failure) { tx.abort(); db.close(); reject(failure); return; }
            action.onsuccess = () => { result = action.result; };
            tx.oncomplete = () => { db.close(); resolve(result); };
            tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || Error('Dashboard cache transaction failed')); };
        };
    });
}

export async function readDashboardCache(userId, role, kind) {
    if (!validScope(userId, role, kind)) return null;
    const value = await localRead(access('readonly', store => store.get(keyFor(userId, role, kind))));
    if (!value || value.version !== VERSION || value.key !== keyFor(userId, role, kind)
        || !Array.isArray(value.matches) || !Array.isArray(value.competitions)
        || !value.matches.every(row => row && typeof row === 'object' && row.id != null)
        || !value.competitions.every(row => row && typeof row === 'object' && row.id != null)
        || !value.updatedAt || !Number.isFinite(Date.parse(value.updatedAt))) return null;
    return value;
}

export async function writeDashboardCache(userId, role, kind, snapshot) {
    if (!validScope(userId, role, kind)) throw Error('Invalid dashboard cache scope');
    if (!Array.isArray(snapshot.matches) || !Array.isArray(snapshot.competitions)) throw Error('Invalid dashboard snapshot');
    const value = { key: keyFor(userId, role, kind), version: VERSION,
        matches: snapshot.matches.map(cacheMatch),
        competitions: snapshot.competitions.map(row => pick(row, ['id', 'title', 'title_th', 'title_en', 'short_title_th', 'short_title_en', 'competition_title', 'competition_title_th', 'competition_title_en', 'competition_name', 'competition_name_th', 'competition_name_en', 'gender', 'status', 'age_group_name', 'age_group_id'])),
        updatedAt: snapshot.updatedAt || new Date().toISOString(),
        partialCompetitionIds: snapshot.partialCompetitionIds || [] };
    await access('readwrite', store => store.put(value));
    return value;
}

// Only successful competition reads replace that competition's prior rows.
export function mergeRefereeMatches(competitions, results, previous, titleOf = competition => competition.title || '') {
    const partialCompetitionIds = [];
    const matches = competitions.flatMap((competition, index) => {
        const result = results[index];
        if (result?.status === 'fulfilled' && Array.isArray(result.value?.data)) {
            return result.value.data.map(match => ({ ...match, competition_id: competition.id, competition_name: titleOf(competition),
                competition_name_th: competition.title_th || match.competition_name_th || match.competition_title_th,
                competition_name_en: competition.title_en || match.competition_name_en || match.competition_title_en,
                dashboard_stale: false }));
        }
        partialCompetitionIds.push(String(competition.id));
        return previous.filter(match => String(match.competition_id) === String(competition.id)).map(match => ({ ...match, dashboard_stale: true }));
    });
    return { matches, partialCompetitionIds };
}

export function readDashboardPreferences(userId, role) {
    try {
        const value = JSON.parse(sessionStorage.getItem(`scorer-dashboard-view:${userId}:${role}`) || '{}');
        return {
            search: typeof value.search === 'string' ? value.search : '',
            status: ['scheduled', 'live', 'completed', 'cancelled'].includes(value.status) ? value.status : '',
            team: typeof value.team === 'string' ? value.team : '',
            sort: ['number', 'date', 'match', 'competition', 'score', 'status'].includes(value.sort?.field) ? { field: value.sort.field, descending: value.sort.descending === true } : { field: 'number', descending: false },
            page: Number.isSafeInteger(value.page) && value.page > 0 ? value.page : 1,
            pageSize: [10, 25, 50].includes(value.pageSize) ? value.pageSize : 10,
        };
    } catch { return { search: '', status: '', team: '', sort: { field: 'number', descending: false }, page: 1, pageSize: 10 }; }
}

export function writeDashboardPreferences(userId, role, preferences) {
    try { sessionStorage.setItem(`scorer-dashboard-view:${userId}:${role}`, JSON.stringify(preferences)); } catch { /* Browsing remains available when storage is restricted. */ }
}
