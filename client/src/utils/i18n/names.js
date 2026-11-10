import { normalizeLanguage } from './language.js';

const clean = value => typeof value === 'string' && !['0', '-0'].includes(value.trim()) ? value.trim() : '';

/** Pick a whole registered name in one language; never combine Thai and English parts. */
export function personNameParts(person = {}, language = 'THA') {
    if (!person) return { first: '', last: '', full: '' };
    const locale = normalizeLanguage(language) === 'ENG' ? 'en' : 'th';
    const other = locale === 'en' ? 'th' : 'en';
    const pair = suffix => ({ first: clean(person[`first_name${suffix}`] || person[`firstname${suffix}`]), last: clean(person[`last_name${suffix}`] || person[`lastname${suffix}`]) });
    const selected = pair(`_${locale}`);
    const selectedFull = clean(person[`name_${locale}`] || person[`full_name_${locale}`]);
    if (selected.first || selected.last) return { ...selected, full: [selected.first, selected.last].filter(Boolean).join(' ') };
    if (selectedFull) return { first: selectedFull, last: '', full: selectedFull };
    const legacy = pair('');
    const legacyFull = clean(person.name || person.full_name || person.player_name || person.display_name || person.athlete_name);
    if (legacy.first || legacy.last) return { ...legacy, full: [legacy.first, legacy.last].filter(Boolean).join(' ') };
    if (legacyFull) return { first: legacyFull, last: '', full: legacyFull };
    const fallback = pair(`_${other}`);
    const full = [fallback.first, fallback.last].filter(Boolean).join(' ') || clean(person[`name_${other}`] || person[`full_name_${other}`]);
    return { ...fallback, first: fallback.first || (!fallback.last ? full : ''), full };
}

export const personName = (person, language) => personNameParts(person, language).full;

export function editablePersonNames(person = {}) {
    const locale = /[ก-๙]/.test([person.first_name, person.last_name, person.firstname, person.lastname].join(' ')) ? 'th' : 'en';
    const fields = {};
    for (const part of ['first_name', 'last_name']) {
        for (const language of ['th', 'en']) fields[`${part}_${language}`] = person[`${part}_${language}`] ?? (language === locale ? person[part] || person[part.replace('_', '')] || '' : '');
    }
    return fields;
}

export function teamName(team = {}, language = 'THA') {
    if (typeof team === 'string') return team;
    const locale = normalizeLanguage(language) === 'ENG' ? 'en' : 'th';
    return clean(team?.[`name_${locale}`] || team?.[`team_name_${locale}`])
        || clean(team?.name || team?.team_name)
        || clean(team?.[locale === 'en' ? 'name_th' : 'name_en']);
}
