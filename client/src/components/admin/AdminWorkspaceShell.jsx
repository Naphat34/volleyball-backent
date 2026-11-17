import PublicAnchor from '../ui/PublicAnchor.jsx';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Menu, X, LogOut, ArrowUpRight, ShieldCheck, Sun, Moon } from 'lucide-react';
import { api } from '../../api';
import { clearAuthSession } from '../../auth/authStorage';
import { useLanguage } from '../../context/LanguageContext';
import { useVisTheme } from '../vis/visThemeContext';
import { GuardedButton } from '../ui/GuardedAction';
import { workspaceFor } from '../../utils/adminWorkspace';
import VolleyBrand from '../ui/VolleyBrand';
import '../../pages/admin/AdminConsole.css';
import './AdminWorkspace.css';

export default function AdminWorkspaceShell({ user, sections, activeKey, onSelect, title, subtitle, headerActions, children }) {
    const workspace = workspaceFor(user?.role) || {label:'Organizer',accent:'system'};
    const { language, setLanguage } = useLanguage();
    const { theme, setTheme } = useVisTheme();
    const navigate = useNavigate(), sidebarId = useId(), menuRef = useRef(null);
    const [open,setOpen] = useState(false), [online,setOnline] = useState(navigator.onLine);
    const [desktop,setDesktop] = useState(() => window.matchMedia('(min-width: 1050px)').matches);
    useEffect(() => {
        const media = window.matchMedia('(min-width: 1050px)'), change = () => setDesktop(media.matches);
        const status = () => setOnline(navigator.onLine);
        media.addEventListener('change', change); window.addEventListener('online',status);window.addEventListener('offline',status);
        return () => {media.removeEventListener('change',change);window.removeEventListener('online',status);window.removeEventListener('offline',status);};
    },[]);
    useEffect(() => {
        if(!open)return;
        const escape = event => {if(event.key==='Escape'){setOpen(false);menuRef.current?.focus();}};
        window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
    },[open]);
    const logout = async () => {try {await api.logout();} finally {clearAuthSession();navigate('/login',{replace:true});}};
    const select = item => {setOpen(false);onSelect?.(item.key);};
    return <div className="admin-console aw-shell" data-admin-theme={theme} data-workspace={workspace.accent}>
        <PublicAnchor className="aw-skip" href="#workspace-content">ข้ามไปเนื้อหา</PublicAnchor>
        {open&&!desktop&&<button className="aw-scrim" aria-label="ปิดเมนู" onClick={()=>setOpen(false)}/>}
        <aside id={sidebarId} className={`aw-sidebar${open?' is-open':''}`} inert={!desktop&&!open} aria-hidden={!desktop&&!open}>
            <Link className="aw-brand" to={workspace.home||'/admin'} aria-label="VOLLEY"><VolleyBrand tone="dark"/></Link>
            <div className="aw-workspace-label"><ShieldCheck size={17}/><span>{workspace.label}</span><span className="aw-role-dot"/></div>
            <nav aria-label={`เมนู ${workspace.label}`}>
                {sections.map(section=><div className="aw-nav-section" key={section.label}><p>{section.label}</p>{section.items.map(item=>{
                    const content=<><span className="aw-nav-icon">{item.icon||<LayoutDashboard size={18}/>}</span><span>{item.label}</span>{item.badge>0&&<b>{item.badge}</b>}{item.href&&<ArrowUpRight size={14}/> }</>;
                    return item.href?<Link className="aw-nav-item" key={item.key} to={item.href} onClick={()=>setOpen(false)}>{content}</Link>:
                        <button className={`aw-nav-item${activeKey===item.key?' is-active':''}`} key={item.key} aria-current={activeKey===item.key?'page':undefined} onClick={()=>select(item)}>{content}</button>;
                })}</div>)}
            </nav>
            <div className="aw-sidebar-footer"><GuardedButton onClick={logout}><LogOut size={16}/>ออกจากระบบ</GuardedButton></div>
        </aside>
        <div className="aw-main">
            <header className="aw-topbar">
                <button ref={menuRef} className="aw-menu-toggle" aria-label={open?'ปิดเมนู':'เปิดเมนู'} aria-expanded={open} aria-controls={sidebarId} onClick={()=>setOpen(!open)}>{open?<X size={20}/>:<Menu size={20}/>}</button>
                <div className="aw-breadcrumb"><span>Workspace</span><span>/</span><strong>{workspace.label}</strong></div>
                <div className="aw-top-actions"><span className={`aw-connection${online?'':' is-offline'}`} role="status"><i/>{online?'ออนไลน์':'ออฟไลน์'}</span>
                    <select aria-label="ภาษา" value={language} onChange={e=>setLanguage(e.target.value)}><option value="THA">TH</option><option value="ENG">EN</option></select>
                    <button aria-label={theme==='dark'?'ใช้ธีมสว่าง':'ใช้ธีมมืด'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</button>
                    <div className="aw-profile"><span>{String(user?.username||'V').slice(0,1).toUpperCase()}</span><div><strong>{user?.username}</strong><small>{workspace.label}</small></div></div>
                </div>
            </header>
            <main id="workspace-content" className="aw-content dashboard-content"><div className="aw-page-heading"><div className="aw-heading-copy"><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{headerActions&&<div className="aw-heading-actions">{headerActions}</div>}</div>{children}</main>
        </div>
    </div>;
}
