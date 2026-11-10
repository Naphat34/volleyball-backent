import { normalizeLanguage } from './language.js';
export function competitionName(record = {}, language = 'THA', short = false) {
    if (typeof record === 'string') return record;
    if (!record || typeof record !== 'object') return '';
    const locale = normalizeLanguage(language) === 'ENG' ? 'en' : 'th';
    const other = locale === 'en' ? 'th' : 'en';
    const pick = key => typeof record[key] === 'string' ? record[key].trim() : '';
    return (short ? pick(`short_title_${locale}`) || pick(`competition_short_title_${locale}`) : '')
        || pick(`title_${locale}`) || pick(`competition_name_${locale}`) || pick(`competition_title_${locale}`)
        || pick('title') || pick('competition_name') || pick('competition_title') || pick('competitionName') || pick('name')
        || pick(`title_${other}`) || pick(`competition_name_${other}`) || pick(`competition_title_${other}`);
}
export function localizedReference(record = {}, language = 'THA') {
    if (!record || typeof record !== 'object') return '';
    const locale = normalizeLanguage(language) === 'ENG' ? 'en' : 'th';
    const legacy = record.name || '';
    return record[`name_${locale}`] || (locale === 'en' && ['ประชาชน', 'ทั่วไป'].includes(legacy) ? 'Open' : legacy) || record.name_th || record.name_en || '';
}
export function competitionGroupName(base, records = [], language = 'THA') {
    const clean = title => String(title || '').replace(/\s*\((Male|Female|Mixed|Mix|Men|Women|ชาย|หญิง)\)\s*$/i, '').trim();
    const record = records.find(row => clean(row.title || row.name) === base);
    return record ? clean(competitionName(record, language)) : base;
}
