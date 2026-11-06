import { useLayoutEffect, useState } from 'react';
import { VisThemeContext } from './visThemeContext';
import './VisTheme.css';

const storageKey = 'volley-vis-theme';
const initialTheme = () => {
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* Themes remain available when storage is disabled. */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function VisTheme({ children }) {
    const [theme, setTheme] = useState(initialTheme);
    useLayoutEffect(() => {
        const previous = document.documentElement.getAttribute('data-vis-theme');
        document.documentElement.setAttribute('data-vis-theme', theme);
        try { localStorage.setItem(storageKey, theme); } catch { /* Keep the current session preference. */ }
        return () => {
            if (previous === null) document.documentElement.removeAttribute('data-vis-theme');
            else document.documentElement.setAttribute('data-vis-theme', previous);
        };
    }, [theme]);
    useLayoutEffect(() => {
        const sync = event => {
            if (event.key === storageKey && ['light', 'dark'].includes(event.newValue)) setTheme(event.newValue);
        };
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);
    return <VisThemeContext.Provider value={{ theme, setTheme }}>{children}</VisThemeContext.Provider>;
}
