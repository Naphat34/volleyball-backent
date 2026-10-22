import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../api';
import './ScorerCreateMatch.css';

const emptyTeam = color => ({ name: '', color, players: [] });
const initialForm = () => ({ title: '', date: '', time: '', location: '', matchNumber: '', gender: '', maxSets: 5, pointsPerSet: 25, decidingSetPoints: 15, hasChallenge: false, home: emptyTeam('#2563eb'), away: emptyTeam('#dc2626') });

export default function ScorerCreateMatch({ matchId, sources = [], onClose, onSaved }) {
    const dialog = useRef(null), inFlight = useRef(false);
    const [creationId] = useState(() => crypto.randomUUID());
    const [form, setForm] = useState(initialForm), [step, setStep] = useState(1);
    const [busy, setBusy] = useState(Boolean(matchId)), [error, setError] = useState('');
    const sourceTeams = sources.filter(m => m.manual_lifecycle !== 'draft').flatMap(m => ['home', 'away'].map(side => ({ id: m.id, side, name: m[`${side}_team`] }))).filter(t => t.name);
    useEffect(() => {
        const element = dialog.current, trigger = document.activeElement, overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden'; element.showModal();
        return () => { element.close(); document.body.style.overflow = overflow; trigger?.focus(); };
    }, []);
    useEffect(() => {
        if (!matchId) return;
        let active = true;
        api.getManualScorerMatch(matchId).then(({ data }) => { if (active) setForm({ ...data.config, matchNumber: data.config.matchNumber ?? '' }); })
            .catch(error => { if (active) setError(error.response?.data?.error || error.message); })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [matchId]);
    const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
    const team = (side, fields) => setForm(previous => ({ ...previous, [side]: { ...previous[side], ...fields } }));
    const player = (side, index, fields) => team(side, { players: form[side].players.map((p, i) => i === index ? { ...p, ...fields } : p) });
    const run = async action => {
        if (inFlight.current) return;
        inFlight.current = true; setBusy(true); setError('');
        try { await action(); } catch (error) { setError(error.response?.data?.error || error.message); }
        finally { inFlight.current = false; setBusy(false); }
    };
    const validate = ready => {
        if (!form.home.name.trim() || !form.away.name.trim()) throw Error('กรุณาระบุชื่อทีมทั้งสอง');
        if (form.home.name.trim() === form.away.name.trim()) throw Error('ชื่อทีมทั้งสองต้องต่างกัน');
        for (const side of ['home', 'away']) {
            const roster = form[side].players, numbers = roster.map(p => Number(p.number));
            if (roster.some(p => !p.first_name.trim() || !Number.isInteger(Number(p.number)) || Number(p.number) < 1 || Number(p.number) > 999)) throw Error('กรุณากรอกชื่อและหมายเลขเสื้อ 1–999 ให้ครบทุกรายชื่อ หรือลบแถวที่ไม่ได้ใช้');
            if (new Set(numbers).size !== numbers.length) throw Error('พบหมายเลขเสื้อซ้ำในทีมเดียวกัน');
            if (roster.filter(p => p.is_captain).length > 1 || roster.filter(p => p.position === 'L').length > 2) throw Error('กำหนดกัปตันได้หนึ่งคน และ Libero ไม่เกินสองคนต่อทีม');
            if (ready && (roster.filter(p => p.position !== 'L').length < 6 || roster.filter(p => p.is_captain).length !== 1)) throw Error('ก่อนเปิดบันทึกคะแนน ต้องมีผู้เล่นทั่วไปอย่างน้อย 6 คนและกัปตันหนึ่งคนต่อทีม');
        }
    };
    const save = ready => run(async () => {
        validate(ready);
        const body = { ...form, ready, creationId };
        const { data } = matchId ? await api.updateManualScorerMatch(matchId, body) : await api.createManualScorerMatch(body);
        // Before kickoff, discard cached setup so edits reopen with the saved roster/rules.
        for (const key of Object.keys(localStorage)) if (key.startsWith(`match_${data.match.id}_`)) localStorage.removeItem(key);
        onSaved(data.match.id, ready);
    });
    const copyTeam = (side, value) => {
        const source = sourceTeams[Number(value)];
        if (value === '' || !source) return;
        void run(async () => {
            const { data } = await api.getMatchRosterData(source.id);
            const players = data[source.side].players.map(p => ({ number: p.number, first_name: p.first_name || '', last_name: p.last_name || '', position: p.position === 'L' || p.is_libero1 || p.is_libero2 ? 'L' : ['S','OH','MB','OPP'].includes(p.position) ? p.position : '', is_captain: Boolean(p.is_captain) }));
            team(side, { name: source.name, players });
        });
    };
    return <dialog ref={dialog} className="scm-dialog" aria-labelledby="scm-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
        <header><div><h2 id="scm-title">{matchId ? 'จัดการแมตช์สร้างเอง' : 'สร้างแมตช์เอง'}</h2><p>ออนไลน์ · ส่วนตัวเมื่อสร้าง · แยกจากตารางคะแนนทางการ</p></div><button type="button" disabled={busy} aria-label="ปิด" onClick={onClose}><X size={20} /></button></header>
        <nav aria-label="ขั้นตอนสร้างแมตช์">{['ข้อมูลและกติกา', 'ทีมและนักกีฬา', 'ตรวจสอบ'].map((label, i) => <span key={label} aria-current={step === i + 1 ? 'step' : undefined}>{i + 1}. {label}</span>)}</nav>
        <form onSubmit={event => { event.preventDefault(); if (busy) return; if (step < 3) { setError(''); setStep(step + 1); } else void save(false); }}>
            <div className="scm-content"><fieldset disabled={busy} className="scm-fields">
                {error && <p role="alert" className="scm-error">{error}</p>}
                {step === 1 && <div className="scm-grid">
                    {[['title','ชื่อรายการ / แมตช์','text',160],['date','วันที่','date'],['time','เวลา','time'],['location','สนาม','text',100],['matchNumber','หมายเลขแมตช์','number']].map(([key,label,type,max]) => <label key={key}>{label}<input type={type} value={form[key]} maxLength={max} min={type === 'number' ? 1 : undefined} max={type === 'number' ? 999999 : undefined} onChange={event => update(key,event.target.value)} /></label>)}
                    <label>ประเภท<select value={form.gender} onChange={event => update('gender',event.target.value)}><option value="">ไม่ระบุ</option><option value="Male">ชาย</option><option value="Female">หญิง</option><option value="Mixed">ผสม</option></select></label>
                    <label>จำนวนเซต<select value={form.maxSets} onChange={event => update('maxSets',Number(event.target.value))}><option value={3}>ชนะ 2 ใน 3 เซต</option><option value={5}>ชนะ 3 ใน 5 เซต</option></select></label>
                    <label>คะแนนต่อเซต<input type="number" min="5" max="99" required value={form.pointsPerSet} onChange={event => update('pointsPerSet',event.target.value)} /></label>
                    <label>คะแนนเซตตัดสิน<input type="number" min="5" max="99" required value={form.decidingSetPoints} onChange={event => update('decidingSetPoints',event.target.value)} /></label>
                    <label className="scm-check"><input type="checkbox" checked={form.hasChallenge} onChange={event => update('hasChallenge',event.target.checked)} />เปิดใช้ Challenge</label>
                    <p>ทุกเซตต้องชนะห่าง 2 คะแนน · กติกาและรายชื่อในหน้านี้แก้ได้ก่อนบันทึกผลโยนเหรียญ</p>
                </div>}
                {step === 2 && <div className="scm-roster-teams">{['home','away'].map(side => <section className="scm-team" key={side}>
                    <h3>{side === 'home' ? 'ทีมเจ้าบ้าน' : 'ทีมเยือน'}</h3>
                    <label>ชื่อทีม *<input maxLength={100} value={form[side].name} onChange={event => team(side,{name:event.target.value})} /></label>
                    <label>คัดลอกทีมและรายชื่อ<select value="" onChange={event => copyTeam(side,event.target.value)}><option value="">เลือกจากแมตช์ที่แสดงบนแดชบอร์ด…</option>{sourceTeams.map((t,i) => <option key={`${t.id}-${t.side}`} value={i}>{t.name} · #{t.id}</option>)}</select></label>
                    <label>สีเสื้อ<input type="color" value={form[side].color} onChange={event => team(side,{color:event.target.value})} /></label>
                    <p>รายชื่อเป็นสำเนาสำหรับแมตช์นี้ การแก้ไขไม่กระทบทีมต้นฉบับ</p>
                    <div className="scm-roster-scroll" role="region" aria-label={`ตารางนักกีฬา ${side === 'home' ? 'เจ้าบ้าน' : 'ทีมเยือน'}`} tabIndex={0}>
                        <table className="scm-roster-table">
                            <caption className="sr-only">รายชื่อนักกีฬา {form[side].name || (side === 'home' ? 'เจ้าบ้าน' : 'ทีมเยือน')}</caption>
                            <thead><tr><th scope="col">ลำดับ</th><th scope="col">เบอร์ *</th><th scope="col">ตำแหน่ง</th><th scope="col">ชื่อ *</th><th scope="col">นามสกุล</th><th scope="col">กัปตัน</th><th scope="col">จัดการ</th></tr></thead>
                            <tbody>{form[side].players.length === 0 ? <tr><td colSpan={7} className="scm-roster-empty">ยังไม่มีรายชื่อ กดเพิ่มนักกีฬาหรือคัดลอกทีมด้านบน</td></tr> : form[side].players.map((p,i) => <tr key={i}>
                                <th scope="row">{i+1}</th>
                                <td><input aria-label={`เบอร์ นักกีฬาคนที่ ${i+1}`} type="number" min="1" max="999" value={p.number} onChange={event => player(side,i,{number:event.target.value})} /></td>
                                <td><select aria-label={`ตำแหน่ง นักกีฬาคนที่ ${i+1}`} value={p.position} onChange={event => player(side,i,{position:event.target.value})}><option value="">ไม่ระบุ</option>{['S','OH','MB','OPP','L'].map(position => <option key={position}>{position}</option>)}</select></td>
                                <td><input aria-label={`ชื่อ นักกีฬาคนที่ ${i+1}`} maxLength={50} value={p.first_name} onChange={event => player(side,i,{first_name:event.target.value})} /></td>
                                <td><input aria-label={`นามสกุล นักกีฬาคนที่ ${i+1}`} maxLength={50} value={p.last_name} onChange={event => player(side,i,{last_name:event.target.value})} /></td>
                                <td className="scm-captain-cell"><input aria-label={`กัปตัน นักกีฬาคนที่ ${i+1}`} type="checkbox" checked={p.is_captain} onChange={event => team(side,{players:form[side].players.map((item,j) => ({...item,is_captain:j===i ? event.target.checked : false}))})} /></td>
                                <td><button type="button" className="scm-remove-player" aria-label={`ลบนักกีฬาคนที่ ${i+1}`} onClick={() => team(side,{players:form[side].players.filter((_,j) => j !== i)})}>ลบ</button></td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                    <button type="button" disabled={form[side].players.length>=30} onClick={() => team(side,{players:[...form[side].players,{number:'',first_name:'',last_name:'',position:'',is_captain:false}]})}>+ เพิ่มนักกีฬา ({form[side].players.length}/30)</button>
                </section>)}</div>}
                {step === 3 && <section className="scm-summary"><h3>{form.title || 'แมตช์สร้างเอง'}</h3><p>{form.home.name || 'ยังไม่ระบุทีม'} ({form.home.players.length} คน) — {form.away.name || 'ยังไม่ระบุทีม'} ({form.away.players.length} คน)</p><p>{form.date || 'ยังไม่ระบุวันที่'} {form.time} · {form.location || 'ยังไม่ระบุสนาม'}</p><p>ชนะ {Math.ceil(form.maxSets/2)} ใน {form.maxSets} เซต · เซตละ {form.pointsPerSet} คะแนน · เซตตัดสิน {form.decidingSetPoints} คะแนน</p><p>Challenge: {form.hasChallenge ? 'เปิด' : 'ปิด'}</p><p>บันทึกฉบับร่างได้แม้รายชื่อยังไม่ครบ ก่อนเปิดบันทึกคะแนนต้องมีผู้เล่นทั่วไปอย่างน้อยทีมละ 6 คนและกัปตันทีมละหนึ่งคน</p><p>ผลแมตช์นี้ไม่รวมตารางคะแนนรายการแข่งขันทางการ และยังไม่เผยแพร่ Livescore จนกว่าจะกดเผยแพร่จากแดชบอร์ด</p></section>}
            </fieldset></div>
            <footer><button type="button" disabled={busy || step===1} onClick={() => {setError('');setStep(step-1);}}>ย้อนกลับ</button><div>{busy && <span role="status">กำลังบันทึก…</span>}{step < 3 ? <button className="scm-primary" disabled={busy} type="submit">ถัดไป</button> : <><button disabled={busy} type="submit">บันทึกฉบับร่าง</button><button disabled={busy} type="button" className="scm-primary" onClick={() => void save(true)}>บันทึกและเปิด Scorer</button></>}</div></footer>
        </form>
    </dialog>;
}
