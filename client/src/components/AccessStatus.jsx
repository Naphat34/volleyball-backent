import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAccessSession from '../hooks/useAccessSession';

export default function AccessStatus() {
    const session = useAccessSession(), { state } = useLocation();
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update); window.addEventListener('offline', update);
        return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }, []);
    return <aside className="mb-4 rounded-lg border border-slate-500 bg-slate-900 p-3 text-sm text-slate-100" aria-label="สถานะบัญชีและการเชื่อมต่อ">
        <p>บัญชี: {session.user?.username || 'ยังไม่ปลดล็อก'} · {session.kind === 'offline' ? 'ปลดล็อกด้วย PIN · ทำงานในเครื่อง' : session.kind === 'online' ? 'เข้าสู่ระบบออนไลน์' : 'กรุณาปลดล็อกหรือต่ออายุสิทธิ์'}</p>
        <p>เครือข่ายเครื่อง: {online ? 'มีเครือข่าย (ยังไม่ยืนยันการติดต่อเซิร์ฟเวอร์)' : 'ไม่มีเครือข่าย'} · งานในเครื่องต้องกดซิงค์ การกลับมามีสัญญาณจะไม่เปลี่ยนโหมดหรือย้ายหน้าอัตโนมัติ</p>
        {state?.accessNotice && <p role="status" className="mt-2 text-amber-200">{state.accessNotice}</p>}
    </aside>;
}
