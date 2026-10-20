import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveAccess, navigateAccess } from '../offline/accessRouting';

export default function OfflineMatchGate({ session, children }) {
    const { pathname } = useLocation(), navigate = useNavigate();
    const workspace = /^\/adminvis\/match\/[\w-]+$/.test(pathname) ? 'vis' : /^\/scorer\/\d+$/.test(pathname) ? 'scorer' : null;
    const gateKey = session.kind === 'offline' && workspace ? `${session.user.id}:${pathname}` : null;
    const [approved, setApproved] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
    useEffect(() => {
        if (!gateKey) return;
        let active = true;
        setError('');
        void resolveAccess({ workspace, search: `?returnTo=${encodeURIComponent(pathname)}` }).then(result => {
            if (!active) return;
            if (result.kind === 'ready' && result.path === pathname) setApproved(gateKey);
            else navigateAccess(navigate, result);
        }).catch(error => { if (active) setError(error.message); });
        return () => { active = false; };
    }, [gateKey, workspace, pathname, navigate, retry]);
    if (!gateKey || approved === gateKey) return children;
    return <main className="min-h-screen bg-slate-950 p-6 text-white"><p role={error ? 'alert' : 'status'}>{error || 'กำลังตรวจแมตช์และสิทธิ์บันทึกในเครื่อง…'}</p>{error && <button className="mt-4 underline" onClick={() => setRetry(value => value + 1)}>ลองตรวจใหม่</button>}</main>;
}
