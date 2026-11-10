import useUiTranslation from '../../hooks/useUiTranslation';
import { useState } from 'react';
import { api } from '../../api';
import { validateVisFile } from '../../utils/vis/visMatchFiles';
export default function VisOpenMatchFile({ mode, onClose, onOpened }) {
    const ui = useUiTranslation();
    const [file, setFile] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [url, setUrl] = useState('');
    const [creationId] = useState(() => crypto.randomUUID());
    const load = async source => {
        setBusy(true); setError(''); setFile(null);
        try {
            let text;
            if (typeof source === 'string') {
                const parsed = new URL(source);
                if (parsed.protocol !== 'https:') throw Error('กรุณาใช้ลิงก์ไฟล์ https://');
                const response = await fetch(parsed.href, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
                if (!response.ok) throw Error('เปิดไฟล์บนเว็บไม่สำเร็จ');
                const content = await response.blob();
                if (content.size > 5 * 1024 * 1024) throw Error('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
                text = await content.text();
            } else {
                if (source.size > 5 * 1024 * 1024) throw Error('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
                text = await source.text();
            }
            setFile(validateVisFile(JSON.parse(text)));
        } catch (error) { setError(error instanceof SyntaxError ? 'ไฟล์ไม่ใช่ JSON ที่อ่านได้' : error.message || 'โหลดไฟล์ไม่สำเร็จ'); }
        finally { setBusy(false); }
    };
    const open = async () => {
        setBusy(true); setError('');
        try { const response = await api.createCustomVis({ creationId, importBackup: file.backup }); onOpened(response.data.match.id); }
        catch (error) { setError(error.response?.data?.error || 'นำเข้าแมตช์ไม่สำเร็จ'); }
        finally { setBusy(false); }
    };
    return <div className="vd-overlay"><section role="dialog" aria-modal="true" aria-label={ui("เปิดไฟล์แมตช์")} className="vd-dialog"><header><h2>{mode === 'web' ? ui('☁ ไฟล์บนเว็บ') : mode === 'seava' ? ui('เปิดไฟล์ .seava') : ui('นำเข้า JSON')}</h2><button disabled={busy} onClick={onClose} aria-label={ui("ปิด")}>✕</button></header>
        <p>{ui("เปิดไฟล์สำรอง VOLLEY VIMS เป็นแมตช์ส่วนตัวใหม่ พร้อมรายชื่อ ไลน์อัป และประวัติแรลลี่ ผลคะแนนจะคำนวณใหม่และต้องตรวจสอบก่อนยืนยัน")}</p>
        {mode === 'web' ? <form onSubmit={event => { event.preventDefault(); load(url); }}><input aria-label={ui("ลิงก์ไฟล์ JSON")} type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder={ui("https://…/match.json")} /><button disabled={busy}>{ui("โหลดไฟล์")}</button><p className="vd-muted">{ui("เว็บต้นทางต้องอนุญาตให้อ่านไฟล์จากเว็บไซต์นี้ (CORS)")}</p></form>
            : <input aria-label={ui("เลือกไฟล์แมตช์")} type="file" disabled={busy} accept={mode === 'seava' ? '.seava' : '.json,application/json'} onChange={event => { if (event.target.files?.[0]) load(event.target.files[0]); }} />}
        {error && <p role="alert" className="vd-error">{ui(error)}</p>}
        {file && <div className="vd-file-preview"><strong>{file.backup.config.title}</strong><p>{file.backup.config.home.name} — {file.backup.config.away.name}</p><p>{ui("ผู้เล่น")}{' '}{file.backup.config.home.players.length} / {file.backup.config.away.players.length}{' '}{ui("คน · เหตุการณ์")}{' '}{file.backup.actions.length}{' '}{ui("รายการ")}</p><button className="vd-primary" disabled={busy} onClick={open}>{busy ? ui('กำลังนำเข้า…') : ui('นำเข้าและเปิดแมตช์')}</button></div>}
        <small>{ui("ไฟล์ .seava จากโปรแกรมอื่นอาจมีโครงสร้างต่างกัน ระบบจะแจ้งหากไม่รองรับ")}</small>
    </section></div>;
}
