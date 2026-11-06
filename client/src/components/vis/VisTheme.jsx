import { useCallback, useLayoutEffect, useState } from 'react';
import { VisThemeContext } from './visThemeContext';
import { isTheme, readThemePreference, resolveTheme, themeStorageKey } from '../../utils/theme';
import './VisTheme.css';
const systemDark = () => Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
const initialPreference = () => { try { return readThemePreference(window.localStorage); } catch { return null; } };
export default function VisTheme({ children }) {
    const [preference, setPreference] = useState(initialPreference);
    const [system, setSystem] = useState(systemDark);
    const theme = resolveTheme(preference, system);
    const setTheme = useCallback(value => setPreference(previous => {
        const next = typeof value === 'function' ? value(resolveTheme(previous, systemDark())) : value;
        return isTheme(next) ? next : previous;
    }), []);
    useLayoutEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-app-theme', theme);
        root.setAttribute('data-vis-theme', theme);
        root.classList.toggle('dark', theme === 'dark');
        root.style.colorScheme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1220' : '#f5f7fb');
        if (preference) { try { localStorage.setItem(themeStorageKey, preference); } catch { /* Keep session preference. */ } }
    }, [theme, preference]);
    useLayoutEffect(() => {
        const sync = event => { if (event.key === themeStorageKey) setPreference(isTheme(event.newValue) ? event.newValue : null); };
        const media = window.matchMedia?.('(prefers-color-scheme: dark)');
        const systemChanged = event => setSystem(event.matches);
        media?.addEventListener('change', systemChanged);
        window.addEventListener('storage', sync);
        return () => { window.removeEventListener('storage', sync); media?.removeEventListener('change', systemChanged); };
    }, []);
    return <VisThemeContext.Provider value={{ theme, setTheme }}>{children}</VisThemeContext.Provider>;
}
