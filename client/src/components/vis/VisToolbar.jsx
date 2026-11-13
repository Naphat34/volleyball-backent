import { GuardedButton } from '../ui/GuardedAction';
import VisThemeToggle from './VisThemeToggle';
import { ListOrdered, BookOpen, Columns3, Rows3, RotateCcw, PanelsTopLeft, Video, ClipboardList, ChartColumn, Share2, Download, HelpCircle, ArrowLeft as UiArrowLeft, X as UiX } from 'lucide-react';
import useUiTranslation from '../../hooks/useUiTranslation';
import useVisTranslation from './useVisTranslation';

import { useState } from 'react';
import { exportVisMatch } from '../../utils/vis/visMatchFiles';

export default function VisToolbar({ match, onClose, orientation, onOrientation, onReset,
    exportOptions, showCode, onToggleCode, showGuide, onToggleGuide, showCourt, onToggleCourt, showVideo, onToggleVideo, onSettings, onStats, onHelp, liveEnabled, pending, isSaving, retrySave, onConfirm }) {
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const [notice, setNotice] = useState('');
    const [exporting, setExporting] = useState(false);
    const button = 'vis-tool-button';
    const selected = value => `${button} ${value ? 'vis-tool-selected' : ''}`;
    const share = async () => {
        const url = new URL(`/adminvis/match/${match.is_offline_vis && match.server_id ? match.server_id : match.id}`, window.location.origin).href;
        try { await navigator.clipboard.writeText(url); setNotice('คัดลอกลิงก์แล้ว · ผู้เปิดต้องเข้าสู่ระบบและมีสิทธิ์ VIMS ของแมตช์นี้'); }
        catch { setNotice(`${vt("ลิงก์สำหรับผู้มีสิทธิ์ VIMS: ")}${url}`); }
    };
    const exportMatch = async () => {
        setExporting(true); setNotice('');
        try {
            await exportVisMatch(match, exportOptions);
            setNotice('ดาวน์โหลดข้อมูลแมตช์ JSON แล้ว');
        } catch (error) { setNotice(error.response?.data?.error || vt('ส่งออกไม่สำเร็จ กรุณาลองใหม่')); }
        finally { setExporting(false); }
    };
    return <header className="vis-toolbar">
        <nav aria-label={vt("แถบเครื่องมือ VIMS")} className="vis-toolbar-nav">
            <GuardedButton className={button} onClick={onClose}><><UiArrowLeft size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" />{vt("← รายการแมตช์").replace(/←\uFE0F?/gu, '').trim()}</></GuardedButton>
            <GuardedButton className={button} onClick={onHelp}><HelpCircle size={13} />{vt("วิธีใช้")}</GuardedButton>
            <div className="vis-toolbar-spacer" /><VisThemeToggle compact />
            <div className="vis-tool-group" role="group" aria-label={vt("จัดเรียงแผง")}>
                <GuardedButton className={selected(orientation === 'row')} aria-pressed={orientation === 'row'} title={vt("จัดแผงซ้าย–ขวา")} onClick={() => onOrientation('row')}><Columns3 size={17} /></GuardedButton>
                <GuardedButton className={selected(orientation === 'column')} aria-pressed={orientation === 'column'} title={vt("จัดแผงบน–ล่าง")} onClick={() => onOrientation('column')}><Rows3 size={17} /></GuardedButton>
                <GuardedButton className={button} title={vt("คืนค่าเริ่มต้น")} onClick={onReset}><RotateCcw size={17} /></GuardedButton>
            </div>
            <div className="vis-tool-group">
                <GuardedButton className={selected(showCourt)} aria-pressed={showCourt} onClick={onToggleCourt} title={vt("แสดงสนาม")} aria-label={vt("แสดงสนาม")}><PanelsTopLeft size={19} /></GuardedButton>
                <GuardedButton className={selected(showCode)} aria-pressed={showCode} onClick={onToggleCode} title={vt("โค้ดและประวัติ")} aria-label={vt("โค้ดและประวัติ")}><ListOrdered size={17} /></GuardedButton>
                <GuardedButton className={selected(showVideo)} aria-pressed={showVideo} onClick={onToggleVideo} title={vt("แผงวิดีโอ")} aria-label={vt("แผงวิดีโอ")}><Video size={19} /></GuardedButton>
                <GuardedButton className={selected(showGuide)} aria-pressed={showGuide} onClick={onToggleGuide} title={vt("คีย์ / สถิติ")} aria-label={vt("คีย์ / สถิติ")}><BookOpen size={17} /></GuardedButton>
                <GuardedButton className={button} onClick={onSettings} title={vt("ตั้งค่าแมตช์")} aria-label={vt("ตั้งค่าแมตช์")}><ClipboardList size={17} /></GuardedButton>
                <GuardedButton className={button} onClick={onStats} title={vt("สถิติเต็ม")} aria-label={vt("สถิติเต็ม")}><ChartColumn size={17} /></GuardedButton>
                <GuardedButton className={button} onClick={share} title={vt("แชร์")} aria-label={vt("แชร์")}><Share2 size={17} /></GuardedButton>
                <GuardedButton className={button} disabled={exporting || isSaving || Boolean(pending)} onClick={exportMatch} title={exporting ? vt('กำลังส่งออก…') : vt('ส่งออก JSON')} aria-label={vt("ส่งออก JSON")}><Download size={17} /></GuardedButton>
            </div>
            {match.is_custom_vis && !match.is_offline_vis && match.vis_lifecycle === 'review' && <GuardedButton className={button} disabled={isSaving || Boolean(pending)} onClick={onConfirm}>{vt("ยืนยันผล")}</GuardedButton>}
            {liveEnabled && (!match.is_custom_vis || match.published) && <a className="vis-live-link" href={match.is_custom_vis ? `/vis-live/${match.public_token}` : `/match-centre/${match.is_offline_vis && match.server_id ? match.server_id : match.id}`} target="_blank" rel="noreferrer">{ui("LIVE:")}{' '}{(match.match_number) || (ui('VIMS'))}</a>}
            {pending && !isSaving && <GuardedButton className={button} onClick={retrySave}>{vt("ลองส่งรายการค้าง")}</GuardedButton>}
        </nav>
        {notice && <div role="status" className="vis-toolbar-notice"><span>{vt(notice)}</span><GuardedButton onClick={() => setNotice('')} aria-label={vt("ปิดข้อความ")}><UiX size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton></div>}
    </header>;
}
