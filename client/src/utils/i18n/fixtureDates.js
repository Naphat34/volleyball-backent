import { normalizeLanguage } from './language.js';

// Date-only fixture values represent a Bangkok calendar day, not a UTC instant.
export function fixtureDate(value, language = 'THA') {
    if (!value) return '';
    const text = typeof value === 'string' ? value : '';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00+07:00` : value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(normalizeLanguage(language) === 'ENG' ? 'en-GB' : 'th-TH', {
        timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(date);
}
export function fixtureTime(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value.slice(0, 5);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(date);
}
