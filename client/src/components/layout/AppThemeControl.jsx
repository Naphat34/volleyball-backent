import { useLocation } from 'react-router-dom';
import VisThemeToggle from '../vis/VisThemeToggle';

export default function AppThemeControl() {
    const { pathname } = useLocation();
    // Authentication screens do not display a theme switch.
    if (/^\/(login|register)(?:\/|$)/.test(pathname)) return null;
    // These consoles already expose the same shared preference in their navbar.
    if (/^\/(admin(?:vis|scorer)?|team-dashboard|scorer\/\d+|vis-live\/[^/]+)(?:\/|$)/.test(pathname)) return null;
    return <div className="app-theme-control print:hidden"><VisThemeToggle /></div>;
}
