export const themeStorageKey = 'volley-theme';
export const isTheme = value => value === 'light' || value === 'dark';
export function readThemePreference(storage) {
    try {
        for (const key of [themeStorageKey, 'volley-vis-theme', 'volley-admin-theme', 'volley-admin-vims-theme']) {
            const value = storage.getItem(key);
            if (isTheme(value)) return value;
        }
    } catch { /* Storage can be disabled by the browser. */ }
    return null;
}
export const resolveTheme = (preference, systemDark) => isTheme(preference) ? preference : systemDark ? 'dark' : 'light';
