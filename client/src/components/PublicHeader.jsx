import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, Menu, Trophy, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function PublicHeader() {
    const { language, setLanguage, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    useEffect(() => { setOpen(false); }, [pathname]);
    useEffect(() => {
        const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
    const links = [['/', 'home'], ['/matches', 'matches'], ['/standings', 'standings'], ['/teams', 'teams'], ['/stats', 'stats']];
    const languageControls = <div className="ui-language" aria-label={language === 'THA' ? 'ภาษา' : 'Language'}>
        {['THA', 'ENG'].map(value => <button key={value} type="button" aria-pressed={language === value} onClick={() => setLanguage(value)}>{value === 'THA' ? 'TH' : 'EN'}</button>)}
    </div>;
    return <header className="public-header">
        <a className="ui-skip-link" href="#main-content">{language === 'THA' ? 'ข้ามไปเนื้อหา' : 'Skip to content'}</a>
        <div className="public-header-inner">
            <Link to="/" className="public-brand"><span className="public-brand-icon"><Trophy size={21} /></span><span>{t('nav.systemName')}<small>{language === 'THA' ? 'ศูนย์กลางการแข่งขัน' : 'Competition hub'}</small></span></Link>
            <nav aria-label={language === 'THA' ? 'เมนูหลัก' : 'Main navigation'} className="public-desktop-nav">
                {links.map(([to, key]) => <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} className={`public-nav-link ${pathname === to ? 'is-active' : ''}`}>{t(`nav.${key}`)}</Link>)}
            </nav>
            <div className="public-desktop-actions">{languageControls}<Link to="/login" className="ui-button ui-button-primary"><LogIn size={16} />{t('nav.login')}</Link></div>
            <button type="button" className="public-menu-toggle ui-button ui-button-secondary" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="public-mobile-menu" aria-label={language === 'THA' ? (open ? 'ปิดเมนู' : 'เปิดเมนู') : (open ? 'Close menu' : 'Open menu')}>{open ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {open && <nav id="public-mobile-menu" className="public-mobile-nav" aria-label={language === 'THA' ? 'เมนูมือถือ' : 'Mobile navigation'}>
            {links.map(([to, key]) => <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} className={`public-nav-link ${pathname === to ? 'is-active' : ''}`}>{t(`nav.${key}`)}</Link>)}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">{languageControls}<Link to="/login" className="ui-button ui-button-primary"><LogIn size={16} />{t('nav.login')}</Link></div>
        </nav>}
    </header>;
}
