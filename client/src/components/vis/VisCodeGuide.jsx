import { X as UiX, Grip as SystemGrip } from 'lucide-react';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useLanguage } from '../../context/LanguageContext';
import useVisTranslation from './useVisTranslation';
import { useState } from 'react';
import { visSkillNames } from '../../utils/vis/visPresentation';

export default function VisCodeGuide({ onStats, onClosePanel, actionLog = [], matchData = {} }) {
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const { language } = useLanguage();
    const teamName = key => matchData[key + (language === 'ENG' ? '_team_name_en' : '_team_name_th')]?.trim() || matchData[key + '_team'];
    const [tab, setTab] = useState('guide');
    const [zoom, setZoom] = useState(100);
    const rows = (items) => <table><tbody>{items.map(([code, meaning]) => <tr key={code}><td><code>{code}</code></td><td>{vt(meaning)}</td></tr>)}</tbody></table>;
    return <aside className="vis-guide-panel" aria-label={vt("คู่มือคีย์และสถิติ")}>
        <header className="vis-panel-title"><span><SystemGrip size={14} className="inline-block" aria-hidden="true" />{vt("⠿ คีย์ / สถิติ").replace("⠿", "").trim()}</span><div className="vis-zoom"><button onClick={() => setZoom(value => Math.max(80, value - 10))} aria-label={vt("ย่อคู่มือ")}>{ui("A−")}</button><span>{zoom}%</span><button onClick={() => setZoom(value => Math.min(140, value + 10))} aria-label={vt("ขยายคู่มือ")}>{ui("A+")}</button></div>{onClosePanel && <button type="button" className="vis-panel-close" aria-label={vt("ปิดแผงคู่มือและสถิติ")} title={vt("ปิดแผง")} onClick={onClosePanel}><UiX size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></button>}</header>
        <div className="vis-guide-tabs"><button id="vis-guide-help" aria-pressed={tab === 'guide'} onClick={() => setTab('guide')}>{vt("รหัสคีย์")}</button><button aria-pressed={tab === 'stats'} onClick={() => setTab('stats')}>{vt("สถิติ")}</button></div>
        <div className="vis-guide-scroll" style={{ fontSize: `${12 * zoom / 100}px` }}>{tab === 'stats' ? <><h3>{vt("สถิติการแข่งขัน")}</h3><p>{vt("สรุปจากรายการที่บันทึกแล้ว ")}{actionLog.length}{vt(" รายการ")}</p>{['home', 'away'].map(key => <section key={key}><h3>{teamName(key)}</h3>{rows(Object.entries(visSkillNames).map(([code, name]) => [code, `${vt(name)} · ${actionLog.filter(event => event.skill === code && String(event.team_id) === String(matchData[key + '_team_id'])).length}${vt(" ครั้ง")}`]))}</section>)}<button className="vis-guide-action" onClick={onStats}>{vt("เปิดสถิติเต็ม")}</button></> : <>
            <p className="vis-guide-hint"><b>{ui("VIMS")}</b>{ui("S / A / B / R / D / E / OP# / T=")}</p><details className="vis-guide-manual"><summary>{vt("▤ คู่มือคีย์ (พร้อมตัวอย่าง)")}</summary><p>{vt("พิมพ์รหัสลงช่องด้านล่าง แล้วกด Enter เพื่อบันทึก เมื่อมีผลจบแต้ม ระบบจะเพิ่มคะแนนหนึ่งแต้มต่อแรลลี่")}</p><p>{vt("ใช้ Tab รับรหัสแนะนำ และกด Esc เพื่อข้ามคำแนะนำ")}</p></details>
            <h3>{vt("โครงสร้างรหัส (Combined Code)")}</h3><p>{vt("ทีม + เบอร์ผู้เล่น + ทักษะ + ผล")}</p>
            <h3>{vt("ตัวอย่างรหัสที่ใช้ได้")}</h3>{rows([['*7S#',vt('เจ้าบ้าน #7 เสิร์ฟเอซ')],['a10A#',vt('ทีมเยือน #10 ตบได้แต้ม')],['*4B#',vt('เจ้าบ้าน #4 บล็อกได้แต้ม')],['a5S=',vt('ทีมเยือน #5 เสิร์ฟเสีย')],['*OP#',vt('คู่แข่งเสีย ให้แต้มเจ้าบ้าน')],['aT=',vt('ทีมเยือนเสีย ให้แต้มเจ้าบ้าน')]])}
            <h3>{vt("พิมพ์สั้น (ระบบเดาทีม/ทักษะ)")}</h3>{rows([['7', vt('เริ่มแรลลี่ด้วยผู้เสิร์ฟ #7 ของทีมที่มีสิทธิ์เสิร์ฟ')], ['7 10#', vt('เสิร์ฟ แล้วอีกฝั่ง #10 ตบได้แต้ม')], ['7#', vt('เสิร์ฟเอซ')], ['4B#', vt('บล็อกได้แต้ม ระบบเดาทีมจากผู้เล่น')]])}<h3>{vt("คีย์ต่อเนื่องทั้งแรลลี่")}</h3>{rows([['*7S a10A#',vt('เจ้าบ้าน #7 เสิร์ฟ ทีมเยือน #10 ตบได้แต้ม')],['*7S a4A/',vt('ทีมเยือน #4 ตบติดบล็อก')],['Enter',vt('บันทึกทั้งแรลลี่เมื่อมีผลจบแต้ม')]])}
            <h3>{vt("ทีม")}</h3>{rows([['*',vt('ทีมเจ้าบ้าน')],['a',vt('ทีมเยือน')]])}
            <h3>{vt("ทักษะ (Skill)")}</h3>{rows(Object.entries(visSkillNames))}
            <h3>{vt("ผลการเล่น")}</h3>{rows([['#',vt('ได้แต้ม (S/A/B) หรือสมบูรณ์ (R/D/E)')],['+',vt('เล่นต่อได้ดี')],['!',vt('เล่นต่อได้')],['-',vt('เล่นต่อยาก')],['=',vt('ผิดพลาด / เสียแต้ม')],['/',vt('ตบติดบล็อก (A)')]])}
            <h3>{vt("ปุ่มลัด")}</h3>{rows([['Tab',vt('เติมผู้เสิร์ฟ / รับรหัสแนะนำ')],['↑ / ↓',vt('เลือกรหัสแนะนำ')],['Space',vt('รับคำแนะนำ หรือเว้นวรรค')],['Esc',vt('ไม่ใส่รหัสแนะนำ / ล้างช่องคีย์')],[vt('↶ ย้อนกลับ'),vt('ยกเลิกรายการล่าสุดและคืนคะแนน')]])}
        </>}</div>
    </aside>;
}

