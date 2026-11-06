import { getTeamCode } from './scorerHelpers.js';

export const historyTeamName = (match, side) => {
    const key = side === 'home' ? 'teamHome' : 'teamAway';
    return match[`${key}Code`]?.trim() || getTeamCode(match[key]);
};

export function abbreviateHistoryTeams(description, match) {
    const names = ['home', 'away'].map(side => [
        match[side === 'home' ? 'teamHome' : 'teamAway'], historyTeamName(match, side)
    ]).filter(([name]) => name).sort((a, b) => b[0].length - a[0].length);
    if (!names.length) return description;
    const replacements = new Map(names);
    const pattern = names.map(([name]) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return String(description || '').replace(new RegExp(pattern, 'g'), name => replacements.get(name));
}
