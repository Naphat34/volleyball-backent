import { GuardedButton } from '../ui/GuardedAction';
import useUiTranslation from '../../hooks/useUiTranslation';
import useVisTranslation from './useVisTranslation';
import { useVisTheme } from './visThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function VisThemeToggle({ compact = false }) {
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const { theme, setTheme } = useVisTheme();
    const { language } = useLanguage();
    const dark = theme === 'dark';
    const label = language === 'THA' ? vt('โหมดมืด') : 'Dark mode';
    return <GuardedButton type="button" className={`vis-theme-toggle${compact ? ' vis-theme-toggle-compact' : ''}`} role="switch" aria-label={ui(label)} title={ui(label)}
        aria-checked={dark} onClick={() => setTheme(dark ? 'light' : 'dark')}>
        <span className="vis-theme-toggle-thumb" aria-hidden="true" />
    </GuardedButton>;
}
