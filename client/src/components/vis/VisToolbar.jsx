import VisThemeToggle from './VisThemeToggle';
import { BookOpen, Columns3, Rows3, RotateCcw, PanelsTopLeft, Video, ClipboardList, ChartColumn, Share2, Download, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { exportVisMatch } from '../../utils/vis/visMatchFiles';

export default function VisToolbar({ match, onClose, layout, onLayout, orientation, onOrientation, onReset,
    exportOptions, showGuide, onToggleGuide, showCourt, onToggleCourt, showVideo, onToggleVideo, onSettings, onStats, onHelp, liveEnabled, pending, isSaving, retrySave, onConfirm }) {
    const [notice, setNotice] = useState('');
    const [exporting, setExporting] = useState(false);
    const button = 'vis-tool-button';
    const selected = value => `${button} ${value ? 'vis-tool-selected' : ''}`;
    const share = async () => {
        const url = new URL(`/adminvis/match/${match.is_offline_vis && match.server_id ? match.server_id : match.id}`, window.location.origin).href;
        try { await navigator.clipboard.writeText(url); setNotice('คัดลอกลิงก์แล้ว · ผู้เปิดต้องเข้าสู่ระบบและมีสิทธิ์ VIS ของแมตช์นี้'); }
        catch { setNotice(`ลิงก์สำหรับผู้มีสิทธิ์ VIS: ${url}`); }
    };
    const exportMatch = async () => {
        setExporting(true); setNotice('');
        try {
            await exportVisMatch(match, exportOptions);
            setNotice('ดาวน์โหลดข้อมูลแมตช์ JSON แล้ว');
        } catch (error) { setNotice(error.response?.data?.error || 'ส่งออกไม่สำเร็จ กรุณาลองใหม่'); }
        finally { setExporting(false); }
    };
    return <header className="vis-toolbar">
        <nav aria-label="แถบเครื่องมือ VIS" className="vis-toolbar-nav">
            <button className={button} onClick={onClose}>← รายการแมตช์</button>
            <button className={button} onClick={onHelp}><HelpCircle size={13} />วิธีใช้</button>
            <div className="vis-toolbar-spacer" /><VisThemeToggle />
            <select className="vis-layout-select" aria-label="ขนาดแผง" value={layout} onChange={event => onLayout(event.target.value)}><option value="code">โค้ดหลัก</option><option value="video">วิดีโอหลัก</option><option value="equal">แบ่งเท่ากัน</option></select>
            <div className="vis-tool-group" role="group" aria-label="จัดเรียงแผง">
                <button className={selected(orientation === 'row')} aria-pressed={orientation === 'row'} title="จัดแผงซ้าย–ขวา" onClick={() => onOrientation('row')}><Columns3 size={17} /></button>
                <button className={selected(orientation === 'column')} aria-pressed={orientation === 'column'} title="จัดแผงบน–ล่าง" onClick={() => onOrientation('column')}><Rows3 size={17} /></button>
                <button className={button} title="คืนค่าเริ่มต้น" onClick={onReset}><RotateCcw size={17} /></button>
            </div>
            <div className="vis-tool-group">
                <button className={selected(showCourt)} aria-pressed={showCourt} onClick={onToggleCourt} title="แสดงสนาม" aria-label="แสดงสนาม"><PanelsTopLeft size={19} /></button>
                <button className={selected(showVideo)} aria-pressed={showVideo} onClick={onToggleVideo} title="แผงวิดีโอ" aria-label="แผงวิดีโอ"><Video size={19} /></button>
                <button className={selected(showGuide)} aria-pressed={showGuide} onClick={onToggleGuide} title="คีย์ / สถิติ" aria-label="คีย์ / สถิติ"><BookOpen size={17} /></button>
                <button className={button} onClick={onSettings} title="ตั้งค่าแมตช์" aria-label="ตั้งค่าแมตช์"><ClipboardList size={17} /></button>
                <button className={button} onClick={onStats} title="สถิติเต็ม" aria-label="สถิติเต็ม"><ChartColumn size={17} /></button>
                <button className={button} onClick={share} title="แชร์" aria-label="แชร์"><Share2 size={17} /></button>
                <button className={button} disabled={exporting || isSaving || Boolean(pending)} onClick={exportMatch} title={exporting ? 'กำลังส่งออก…' : 'ส่งออก JSON'} aria-label="ส่งออก JSON"><Download size={17} /></button>
            </div>
            {match.is_custom_vis && !match.is_offline_vis && match.vis_lifecycle === 'review' && <button className={button} disabled={isSaving || Boolean(pending)} onClick={onConfirm}>ยืนยันผล</button>}
            {liveEnabled && (!match.is_custom_vis || match.published) && <a className="vis-live-link" href={match.is_custom_vis ? `/vis-live/${match.public_token}` : `/match-centre/${match.is_offline_vis && match.server_id ? match.server_id : match.id}`} target="_blank" rel="noreferrer">LIVE: {match.match_number || 'VIS'}</a>}
            {pending && !isSaving && <button className={button} onClick={retrySave}>ลองส่งรายการค้าง</button>}
        </nav>
        {notice && <div role="status" className="vis-toolbar-notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="ปิดข้อความ">✕</button></div>}
    </header>;
}
