import { normalizeLanguage } from '../i18n/language.js';
const text = value => typeof value === 'string' ? value.trim() : '';

/** Select registered team names for display without changing canonical match data. */
export function getScorerTeamName(match, side, language = 'THA') {
    const key = side === 'away' ? 'teamAway' : 'teamHome';
    const prefix = side === 'away' ? 'away' : 'home';
    const suffix = normalizeLanguage(language) === 'ENG' ? 'En' : 'Th';
    const locale = suffix === 'En' ? 'en' : 'th';
    return text(match[`${key}Name${suffix}`])
        || text(match[`${prefix}_team_name_${locale}`])
        || text(match[key])
        || text(match[`${prefix}_team_name`])
        || text(match[`${prefix}_team`])
        || text(match[side === 'away' ? 'team_b_name' : 'team_a_name'])
        || text(match[`${key}Name${suffix === 'En' ? 'Th' : 'En'}`])
        || text(match[`${prefix}_team_name_${locale === 'en' ? 'th' : 'en'}`])
        || (side === 'away' ? 'AWAY' : 'HOME');
}

/** Preserve cached names when absent; honor explicit null/empty API updates. */
export function getScorerTeamNameFields(source = {}, previous = {}) {
    const fields = {};
    for (const [side, key] of [['home', 'teamHome'], ['away', 'teamAway']]) {
        for (const [locale, suffix] of [['th', 'Th'], ['en', 'En']]) {
            const field = `${key}Name${suffix}`;
            const apiField = `${side}_team_name_${locale}`;
            fields[field] = source[apiField] !== undefined ? source[apiField]
                : source[field] !== undefined ? source[field]
                    : previous[field] ?? previous[apiField] ?? null;
        }
    }
    return fields;
}
