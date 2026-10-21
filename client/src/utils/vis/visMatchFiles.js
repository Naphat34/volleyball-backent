import { api } from '../../api';
export function validateVisFile(value) {
    if (!value || value.format !== 'volley-vis' || value.version !== 1 || !value.backup?.config || !Array.isArray(value.backup.actions)) {
        throw new Error('รองรับไฟล์ JSON หรือ .seava ที่ส่งออกจาก VOLLEY VIS และมีข้อมูลสำรองครบถ้วนเท่านั้น');
    }
    return value;
}
export async function exportVisMatch(match) {
    const response = await api.getVisState(match.id);
    const roster = await api.getMatchRosterData(match.id);
    const backup = response.data.backup || { config: { title: match.competition_name || 'VIS Match', maxSets: response.data.state.maxSets,
        date: String(match.match_date || '').slice(0, 10) || null, location: match.location || '',
        home: { name: match.home_team, players: roster.data.home.players }, away: { name: match.away_team, players: roster.data.away.players } },
        match: response.data.backupMatch, actions: response.data.events.filter(event => event.action_type === 'VIS_STAT').sort((a, b) => Number(a.id) - Number(b.id)).map(event => ({ ...event, details: typeof event.details === 'string' ? JSON.parse(event.details) : event.details })) };
    const value = { format: 'volley-vis', version: 1, exportedAt: new Date().toISOString(), match, roster: roster.data, ...response.data, backup };
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `Vis_match_${match.match_number || match.id}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
