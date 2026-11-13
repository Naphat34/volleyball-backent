import { GuardedButton } from './GuardedAction';
import { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function FullscreenToggle({ className = '', size = 18 }) {
    const { language } = useLanguage();
    const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
    const [error, setError] = useState('');
    const th = language === 'THA';
    const supported = Boolean(document.documentElement.requestFullscreen);
    const label = fullscreen ? (th ? 'ออกจากโหมดเต็มหน้าจอ' : 'Exit full screen') : (th ? 'ขยายเต็มหน้าจอ' : 'Enter full screen');

    useEffect(() => {
        const changed = () => { setFullscreen(Boolean(document.fullscreenElement)); setError(''); };
        document.addEventListener('fullscreenchange', changed);
        return () => document.removeEventListener('fullscreenchange', changed);
    }, []);

    const toggle = async () => {
        setError('');
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch {
            setError(th ? 'ไม่สามารถเปลี่ยนโหมดเต็มหน้าจอได้' : 'Unable to change full-screen mode');
        }
    };
    const Icon = fullscreen ? Minimize : Maximize;
    return <>
        <GuardedButton type="button" className={className} onClick={toggle} disabled={!supported}
            aria-label={label} aria-pressed={fullscreen} title={label}>
            <Icon size={size} aria-hidden="true" />
        </GuardedButton>
        {error && <span role="status" className="text-xs">{error}</span>}
    </>;
}
