export function readViewPreference(key, fallback = '') {
    try { return JSON.parse(sessionStorage.getItem(`volley:view:${key}`)) ?? fallback; }
    catch { return fallback; }
}

export function writeViewPreference(key, value) {
    try { sessionStorage.setItem(`volley:view:${key}`, JSON.stringify(value)); }
    catch { /* Viewing and filtering remain available when storage is disabled. */ }
}
