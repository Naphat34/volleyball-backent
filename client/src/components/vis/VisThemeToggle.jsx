import { Moon, Sun } from 'lucide-react';
import { useVisTheme } from './visThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function VisThemeToggle({ iconOnly = false }) {
    const { theme, setTheme } = useVisTheme();
    const { language } = useLanguage();
    const dark = theme === 'dark';
    const label = language === 'THA' ? (dark ? 'โหมดสว่าง' : 'โหมดมืด') : (dark ? 'Light mode' : 'Dark mode');
    return <button type="button" className="vis-theme-toggle" aria-label={label} title={label}
        aria-pressed={dark} onClick={() => setTheme(dark ? 'light' : 'dark')}>
        {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}{!iconOnly && label}
    </button>;
}
