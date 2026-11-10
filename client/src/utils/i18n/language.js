export function normalizeLanguage(value) {
    return ['ENG', 'EN', 'ENGLISH'].includes(String(value || '').trim().toUpperCase()) ? 'ENG' : 'THA';
}

export function readLanguage() {
    try { return normalizeLanguage(localStorage.getItem('language')); }
    catch { return 'THA'; }
}
