import { attempts, playerPoints } from './visReportData.js';
import { eventDetails } from './visPresentation.js';

const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
export function buildMatchResult(data, report) {
    const setup = parse(data.match.vis_state);
    const timeline = [...report.events, ...(setup.controls || [])];
    const sets = Array.from({ length: 5 }, (_, index) => report.sets.find(set => set.number === index + 1));
    return report.teams.map(team => {
        const byTeam = event => String(event.team_id) === String(team.id);
        const roster = [...team.players].sort((a, b) => Number(a.number) - Number(b.number)).map(player => ({
            ...player,
            lineup: sets.map((set, index) => {
                const n = index + 1;
                const saved = (data.lineups || []).find(row => Number(row.set_number) === n && String(row.team_id) === String(team.id));
                const initial = saved ? Array.from({ length: 6 }, (_, slot) => saved[`player_id_p${slot + 1}`])
                    : (setup.setups?.[n] || (n === 1 ? setup : {})).lineups?.[team.key];
                const position = initial?.findIndex(id => Number(id) === Number(player.id));
                if (position >= 0) return { value: position + 1, starter: true };
                const libero = saved?.libero_id ?? saved?.libero_player_id ?? (setup.setups?.[n] || (n === 1 ? setup : {})).liberos?.[team.key];
                if (libero != null && Number(libero) === Number(player.id)) return { value: 'L', starter: false };
                const sub = timeline.find(event => byTeam(event) && Number(event.set_number ?? event.set_id) === n && Number(eventDetails(event).playerIn) === Number(player.id));
                if (sub) {
                    const replaced = team.players.find(p => Number(p.id) === Number(eventDetails(sub).playerOut));
                    return { value: replaced?.number ?? '-', starter: false };
                }
                return { value: '-', starter: false };
            }),
            setPoints: sets.map((set, index) => report.statEvents.filter(event => byTeam(event) && Number(event.player_id) === Number(player.id)
                && Number(event.set_number ?? event.set_id) === index + 1 && ['A', 'B', 'S'].includes(event.skill) && event.grade === '#').length),
        }));
        const performance = ['A', 'B', 'S'].map(skill => ({ skill, won: team.stats[skill]['#'], attempts: attempts(team.stats, skill),
            top: roster.filter(player => player.stats[skill]['#'] > 0).sort((a, b) => b.stats[skill]['#'] - a.stats[skill]['#'] || Number(a.number) - Number(b.number)).slice(0, 3) }));
        return { ...team, roster, performance, totalPoints: report.sets.length ? report.sets.reduce((sum, set) => sum + Number(set[team.key] || 0), 0) : null,
            best: roster.filter(player => playerPoints(player.stats) > 0).sort((a, b) => playerPoints(b.stats) - playerPoints(a.stats) || Number(a.number) - Number(b.number)).slice(0, 3) };
    });
}
