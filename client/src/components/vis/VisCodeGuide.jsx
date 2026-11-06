import { useState } from 'react';
import { visSkillNames } from '../../utils/vis/visPresentation';

export default function VisCodeGuide({ onStats, actionLog = [], matchData = {} }) {
    const [tab, setTab] = useState('guide');
    const [zoom, setZoom] = useState(100);
    const rows = (items) => <table><tbody>{items.map(([code, meaning]) => <tr key={code}><td><code>{code}</code></td><td>{meaning}</td></tr>)}</tbody></table>;
    return <aside className="vis-guide-panel" aria-label="คู่มือคีย์และสถิติ">
        <header className="vis-panel-title"><span>⠿ คีย์ / สถิติ</span><div className="vis-zoom"><button onClick={() => setZoom(value => Math.max(80, value - 10))} aria-label="ย่อคู่มือ">A−</button><span>{zoom}%</span><button onClick={() => setZoom(value => Math.min(140, value + 10))} aria-label="ขยายคู่มือ">A+</button></div></header>
        <div className="vis-guide-tabs"><button id="vis-guide-help" aria-pressed={tab === 'guide'} onClick={() => setTab('guide')}>รหัสคีย์</button><button aria-pressed={tab === 'stats'} onClick={() => setTab('stats')}>สถิติ</button></div>
        <div className="vis-guide-scroll" style={{ fontSize: `${12 * zoom / 100}px` }}>{tab === 'stats' ? <><h3>สถิติการแข่งขัน</h3><p>สรุปจากรายการที่บันทึกแล้ว {actionLog.length} รายการ</p>{['home', 'away'].map(key => <section key={key}><h3>{matchData[key + '_team']}</h3>{rows(Object.entries(visSkillNames).map(([code, name]) => [code, `${name} · ${actionLog.filter(event => event.skill === code && String(event.team_id) === String(matchData[key + '_team_id'])).length} ครั้ง`]))}</section>)}<button className="vis-guide-action" onClick={onStats}>เปิดสถิติเต็ม</button></> : <>
            <p className="vis-guide-hint"><b>VIS</b>S / A / B / R / D / E / OP# / T=</p><details className="vis-guide-manual"><summary>▤ คู่มือคีย์ (พร้อมตัวอย่าง)</summary><p>พิมพ์รหัสลงช่องด้านล่าง แล้วกด Enter เพื่อบันทึก เมื่อมีผลจบแต้ม ระบบจะเพิ่มคะแนนหนึ่งแต้มต่อแรลลี่</p><p>ใช้ Tab รับรหัสแนะนำ และกด Esc เพื่อข้ามคำแนะนำ</p></details>
            <h3>โครงสร้างรหัส (Combined Code)</h3><p>ทีม + เบอร์ผู้เล่น + ทักษะ + ผล</p>
            <h3>ตัวอย่างรหัสที่ใช้ได้</h3>{rows([['*7S#','เจ้าบ้าน #7 เสิร์ฟเอซ'],['a10A#','ทีมเยือน #10 ตบได้แต้ม'],['*4B#','เจ้าบ้าน #4 บล็อกได้แต้ม'],['a5S=','ทีมเยือน #5 เสิร์ฟเสีย'],['*OP#','คู่แข่งเสีย ให้แต้มเจ้าบ้าน'],['aT=','ทีมเยือนเสีย ให้แต้มเจ้าบ้าน']])}
            <h3>พิมพ์สั้น (ระบบเดาทีม/ทักษะ)</h3>{rows([['7', 'เริ่มแรลลี่ด้วยผู้เสิร์ฟ #7 ของทีมที่มีสิทธิ์เสิร์ฟ'], ['7 10#', 'เสิร์ฟ แล้วอีกฝั่ง #10 ตบได้แต้ม'], ['7#', 'เสิร์ฟเอซ'], ['4B#', 'บล็อกได้แต้ม ระบบเดาทีมจากผู้เล่น']])}<h3>คีย์ต่อเนื่องทั้งแรลลี่</h3>{rows([['*7S a10A#','เจ้าบ้าน #7 เสิร์ฟ ทีมเยือน #10 ตบได้แต้ม'],['*7S a4A/','ทีมเยือน #4 ตบติดบล็อก'],['Enter','บันทึกทั้งแรลลี่เมื่อมีผลจบแต้ม']])}
            <h3>ทีม</h3>{rows([['*','ทีมเจ้าบ้าน'],['a','ทีมเยือน']])}
            <h3>ทักษะ (Skill)</h3>{rows(Object.entries(visSkillNames))}
            <h3>ผลการเล่น</h3>{rows([['#','ได้แต้ม (S/A/B) หรือสมบูรณ์ (R/D/E)'],['+','เล่นต่อได้ดี'],['!','เล่นต่อได้'],['-','เล่นต่อยาก'],['=','ผิดพลาด / เสียแต้ม'],['/','ตบติดบล็อก (A)']])}
            <h3>ปุ่มลัด</h3>{rows([['Tab','เติมผู้เสิร์ฟ / รับรหัสแนะนำ'],['↑ / ↓','เลือกรหัสแนะนำ'],['Space','รับคำแนะนำ หรือเว้นวรรค'],['Esc','ไม่ใส่รหัสแนะนำ / ล้างช่องคีย์'],['↶ ย้อนกลับ','ยกเลิกรายการล่าสุดและคืนคะแนน']])}
        </>}</div>
    </aside>;
}

