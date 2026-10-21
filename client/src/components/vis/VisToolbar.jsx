import { useState } from 'react';
import { exportVisMatch } from '../../utils/vis/visMatchFiles';

export default function VisToolbar({ match, onClose, layout, onLayout, orientation, onOrientation, onReset,
    showCourt, onToggleCourt, showVideo, onToggleVideo, onSettings, onStats, liveEnabled, pending, isSaving, retrySave, onConfirm }) {
    const [notice, setNotice] = useState('');
    const [exporting, setExporting] = useState(false);
    const button = 'shrink-0 rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:border-sky-500 hover:bg-slate-700 disabled:opacity-40';
    const selected = value => `${button} ${value ? '!border-sky-500 !bg-sky-950 !text-sky-200' : ''}`;
    const share = async () => {
        const url = new URL(`/adminvis/match/${match.is_offline_vis && match.server_id ? match.server_id : match.id}`, window.location.origin).href;
        try { await navigator.clipboard.writeText(url); setNotice('คัดลอกลิงก์แล้ว · ผู้เปิดต้องเข้าสู่ระบบและมีสิทธิ์ VIS ของแมตช์นี้'); }
        catch { setNotice(`ลิงก์สำหรับผู้มีสิทธิ์ VIS: ${url}`); }
    };
    const exportMatch = async () => {
        setExporting(true); setNotice('');
        try {
            await exportVisMatch(match);
            setNotice('ดาวน์โหลดข้อมูลแมตช์ JSON แล้ว');
        } catch (error) { setNotice(error.response?.data?.error || 'ส่งออกไม่สำเร็จ กรุณาลองใหม่'); }
        finally { setExporting(false); }
    };
    return <header className="shrink-0 border-b border-slate-700 bg-slate-950 px-2 py-2">
        <nav aria-label="แถบเครื่องมือ VIS" className="flex flex-wrap items-center gap-1.5">
            <button className={button} onClick={onClose}>← รายการแมตช์</button>
            <div className="flex gap-1" role="group" aria-label="ขนาดแผง">
                {[['code', '</>', 'Code หลัก'], ['video', '▶', 'Video หลัก'], ['equal', '◫', 'แบ่งเท่ากัน']].map(([value, icon, title]) => <button key={value} className={selected(layout === value)} aria-pressed={layout === value} title={title} aria-label={title} onClick={() => onLayout(value)}>{icon}</button>)}
            </div>
            <div className="flex gap-1" role="group" aria-label="จัดเรียงแผง">
                <button className={selected(orientation === 'row')} aria-pressed={orientation === 'row'} title="จัดแผงซ้าย–ขวา" onClick={() => onOrientation('row')}>▥</button>
                <button className={selected(orientation === 'column')} aria-pressed={orientation === 'column'} title="จัดแผงบน–ล่าง" onClick={() => onOrientation('column')}>☰</button>
                <button className={button} title="คืนค่าเริ่มต้น" onClick={onReset}>↺</button>
            </div>
            <button className={selected(showCourt)} aria-pressed={showCourt} onClick={onToggleCourt}>▣ สนาม</button>
            <button className={selected(showVideo)} aria-pressed={showVideo} onClick={onToggleVideo}>🎥 แผงวิดีโอ</button>
            <button className={button} onClick={onSettings}>📋 ตั้งค่าแมตช์</button>
            <button className={button} onClick={onStats}>📊 สถิติเต็ม</button>
            <button className={button} onClick={share}>⇪ แชร์</button>
            <button className={button} disabled={exporting || isSaving || Boolean(pending)} onClick={exportMatch}>⤓ {exporting ? 'กำลังส่งออก…' : 'ส่งออก JSON'}</button>
            {match.is_custom_vis && !match.is_offline_vis && match.vis_lifecycle === 'review' && <button className={`${button} !border-emerald-500 !text-emerald-300`} disabled={isSaving || Boolean(pending)} onClick={onConfirm}>ตรวจสอบแล้ว · ยืนยันผล</button>}
            {liveEnabled && (!match.is_custom_vis || match.published) && <a className={`${button} ml-auto !text-emerald-300`} href={match.is_custom_vis ? `/vis-live/${match.public_token}` : `/match-centre/${match.is_offline_vis && match.server_id ? match.server_id : match.id}`} target="_blank" rel="noreferrer" title="เปิด Livescore">LIVE: {match.match_number || (match.is_custom_vis ? 'VIS' : match.id)}</a>}
            {pending && !isSaving && <button className={`${button} !border-amber-500 !text-amber-200`} onClick={retrySave}>ลองส่งรายการค้างอีกครั้ง</button>}
        </nav>
        {notice && <div role="status" className="mt-2 flex items-center justify-between gap-2 break-all text-xs text-sky-200"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="ปิดข้อความ">✕</button></div>}
    </header>;
}
