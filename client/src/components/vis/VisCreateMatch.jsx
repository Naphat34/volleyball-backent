import { GuardedButton } from '../ui/GuardedAction';
import { X as UiX, ArrowUpRight as UiArrowUpRight } from 'lucide-react';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useEffect, useState } from 'react';
import { api } from '../../api';
import VisRosterEditor from './VisRosterEditor';
import VisAthleteLinks from './VisAthleteLinks';
import { getStoredUser } from '../../auth/authStorage';
import { readRosterExcel, rosterFromRows, downloadRosterTemplate } from '../../utils/vis/visRosterImport';

export default function VisCreateMatch({ matchId, onClose, onSaved, sources = [] }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const [form, setForm] = useState({ title: '', date: '', time: '', location: '', gender: '', maxSets: 5, home: { name: '', players: [] }, away: { name: '', players: [] } });
    const [step, setStep] = useState(1), [busy, setBusy] = useState(Boolean(matchId)), [error, setError] = useState('');
    const [match, setMatch] = useState(null), [paste, setPaste] = useState({ home: '', away: '' });
    const [athleteLinks, setAthleteLinks] = useState([]);
    const [savedConfig, setSavedConfig] = useState(null);
    const [creationId] = useState(() => crypto.randomUUID());
    useEffect(() => {
        if (!matchId) return;
        let active = true;
        api.getCustomVis(matchId).then(({ data }) => { if (active) { setForm(data.config); setSavedConfig(data.config); setMatch(data.match); setAthleteLinks(data.athleteLinks || []); } })
            .catch(() => { if (active) setError('โหลดแมตช์ไม่สำเร็จ'); }).finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [matchId]);
    const locked = match && (match.offline_released || !['draft', 'ready'].includes(match.vis_lifecycle));
    const input = 'w-full rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white';
    const btn = 'rounded bg-sky-800 px-3 py-2 text-sm text-white disabled:opacity-40';
    const team = (key, fields) => setForm(previous => ({ ...previous, [key]: { ...previous[key], ...fields, ...(fields.name_th !== undefined || fields.name_en !== undefined ? {name:fields.name_th || fields.name_en || previous[key].name_th || previous[key].name_en || previous[key].name} : {}) } }));
    const teamSources = sources.flatMap(source => ['home', 'away'].map(key => ({ id: source.id, key, name: source[`${key}_team`] }))).filter(source => source.name);
    const run = async action => { setBusy(true); setError(''); try { await action(); } catch (error) { setError(error.response?.data?.error || error.message || 'บันทึกไม่สำเร็จ'); } finally { setBusy(false); } };
    const validateRosters = () => {
        for (const key of ['home', 'away']) {
            const players = form[key].players;
            if (players.some(p => !String(p.number ?? '').trim() || !p.first_name.trim() || !p.last_name.trim())) throw Error(`${key === 'home' ? 'เจ้าบ้าน' : 'ทีมเยือน'}: กรุณาระบุเบอร์ ชื่อ และนามสกุลให้ครบ หรือลบแถวที่ไม่ใช้`);
            rosterFromRows([['number', 'first_name', 'last_name', 'position', 'captain'], ...players.map(p => [p.number, p.first_name, p.last_name, p.position, p.is_captain ? 1 : 0])]);
            if (players.filter(p => p.is_captain).length > 1) throw Error('กำหนดกัปตันได้ทีมละหนึ่งคน');
        }
    };
    const next = () => {
        try { if (step === 2 && !locked) validateRosters(); setError(''); setStep(step + 1); }
        catch (error) { setError(error.message); }
    };
    const save = start => run(async () => {
        validateRosters();
        if (!form.title.trim() || !form.home.name.trim() || !form.away.name.trim()) throw Error('กรุณาระบุชื่อแมตช์และชื่อทั้งสองทีม');
        if (start && ['home', 'away'].some(key => form[key].players.filter(p => p.position !== 'L').length < 6)) throw Error('ก่อนเริ่มต้องมีผู้เล่นทั่วไปอย่างน้อยทีมละ 6 คน');
        const response = matchId ? await api.updateCustomVis(matchId, form) : await api.createCustomVis({ ...form, creationId });
        onSaved(response.data.match.id, start);
    });
    return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 text-white"><section role="dialog" aria-modal="true" aria-label={ui("สร้างและจัดการแมตช์ VIMS")} className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-700 p-4"><h2 className="font-bold">{matchId ? ui('จัดการแมตช์สร้างเอง') : ui('+ สร้างแมตช์ VIMS')} · {step}/3</h2><GuardedButton disabled={busy} onClick={onClose} aria-label={ui("ปิด")}><UiX size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton></header>
        <div className="space-y-4 overflow-y-auto p-4">
            {error && <p role="alert" className="rounded bg-red-950 p-3 text-sm text-red-200">{ui(error)}</p>}
            {match && <div className="space-y-2 rounded bg-slate-800 p-3 text-sm"><p>{ui("สถานะ:")}{' '}{({ draft: 'ฉบับร่าง', ready: 'พร้อมแข่งขัน', playing: 'กำลังแข่งขัน', review: 'รอตรวจสอบผล', confirmed: 'ยืนยันผลแล้ว', cancelled: 'ยกเลิก' })[match.vis_lifecycle]}</p><p>{ui("การเผยแพร่จะแสดงชื่อทีม ชื่อนักกีฬา เบอร์ คะแนน และสถิติ ให้ทุกคนที่มีลิงก์เข้าถึงได้")}</p>
                {match.is_offline_vis && <p className="text-amber-200">{ui("แมตช์ในเครื่อง: กรุณาซิงค์และคืนสิทธิ์ แล้วเปิดแมตช์เซิร์ฟเวอร์เพื่อตรวจสอบยืนยันผลหรือเผยแพร่")}</p>}
                <GuardedButton disabled={busy || match.is_offline_vis || match.vis_lifecycle === 'cancelled'} className={btn} onClick={() => run(async () => { const response = await api.publishCustomVis(matchId, !match.published); setMatch({ ...match, ...response.data }); })}>{match.published ? ui('ปิดการเผยแพร่') : ui('เปิดเผยแพร่ Livescore สาธารณะ')}</GuardedButton>
                {match.published && <a className="ml-3 text-sky-300 underline" href={`/vis-live/${match.public_token}`} target="_blank" rel="noreferrer"><><UiArrowUpRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" />{ui("เปิดลิงก์สาธารณะ ↗").replace(/↗\uFE0F?/gu, '').trim()}</></a>}
                {match.vis_lifecycle === 'confirmed' && <GuardedButton disabled={busy} className={`${btn} ml-2`} onClick={() => run(async () => { await api.reopenCustomVis(matchId); onSaved(matchId, true); })}>{ui("เปิดตรวจแก้ไขผล")}</GuardedButton>}
                {!['confirmed', 'cancelled'].includes(match.vis_lifecycle) && <GuardedButton disabled={busy} className={`${btn} ml-2 !bg-red-900`} onClick={() => run(async () => { const response = await api.getVisState(matchId); await api.saveVisCommand(matchId, { operationId: crypto.randomUUID(), revision: response.data.state.revision, command: { type: 'CANCEL' } }); onSaved(matchId, false); })}>{ui("ยกเลิกแมตช์ (เก็บประวัติ)")}</GuardedButton>}
                {locked && <p className="text-xs text-slate-400">{ui("ข้อมูลทีมและรายชื่อถูกล็อกหลังเริ่มบันทึก ย้อนรายการและยืนยันผลได้ในหน้าคีย์")}</p>}
            </div>}
            {step === 1 && <div className="grid gap-3 md:grid-cols-2">{[['title', 'ชื่อแมตช์ / รายการแข่งขัน', 'text'], ['date', 'วันที่แข่งขัน', 'date'], ['time', 'เวลา', 'time'], ['location', 'สนาม', 'text']].map(([key, label, type]) => <label key={key} className="text-sm">{ui(label)}<input disabled={busy || locked} type={type} maxLength={160} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className={input} /></label>)}
                <label>{ui("จำนวนเซตสูงสุด")}<select disabled={busy || locked} className={input} value={form.maxSets} onChange={event => setForm({ ...form, maxSets: Number(event.target.value) })}><option value={3}>{ui("3 เซต (ชนะ 2)")}</option><option value={5}>{ui("5 เซต (ชนะ 3)")}</option></select></label>
                <label>{ui("ประเภท")}<select disabled={busy || locked} className={input} value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })}><option value="">{ui("ไม่ระบุ")}</option><option value="Male">{ui("ทีมชาย")}</option><option value="Female">{ui("ทีมหญิง")}</option><option value="Mixed">{ui("ทีมผสม")}</option></select></label>
            </div>}
            {step === 2 && <><GuardedButton disabled={busy} className={btn} onClick={() => run(downloadRosterTemplate)}>{ui("ดาวน์โหลดแบบฟอร์ม Excel (.xlsx)")}</GuardedButton><p className="text-xs text-slate-400">{ui("คอลัมน์ number, first_name, last_name, position, captain · ตำแหน่ง S/OH/MB/OPP/L · captain ใส่ 1 · นำเข้าแทนที่รายชื่อทีมที่เลือก")}</p>
                <div className="grid gap-4 lg:grid-cols-2">{['home', 'away'].map(key => <section key={key} className="space-y-2 rounded border border-slate-700 p-3"><h3>{key === 'home' ? ui('* เจ้าบ้าน') : ui('a ทีมเยือน')}</h3><input className={input} disabled={busy || locked} value={form[key].name} placeholder={ui("ชื่อทีม")} aria-label={ui(`ชื่อทีม {0}`, [key])} onChange={event => team(key, { name: event.target.value })} />
                    <div className="grid grid-cols-2 gap-2">{[['name_th','ชื่อทีม (ไทย)'],['name_en','Team name (English)']].map(([field,label]) => <label key={field}>{ui(label)}<input className={input} disabled={busy || locked} maxLength={100} value={form[key][field] || ''} onChange={event => team(key,{[field]:event.target.value})} /></label>)}</div><VisRosterEditor players={form[key].players} disabled={busy || locked} teamLabel={key === 'home' ? 'เจ้าบ้าน' : 'ทีมเยือน'} onChange={players => team(key, { players })} />
                    <select className={input} disabled={busy || locked} defaultValue="" aria-label={ui(`คัดลอกทีมเดิม {0}`, [key])} onChange={event => { const source = teamSources[Number(event.target.value)]; if (event.target.value !== '' && source) run(async () => { const response = await api.getMatchRosterData(source.id); team(key, { name: source.name, staff: response.data[source.key].staff || [], players: response.data[source.key].players.map(p => ({ first_name_th:p.first_name_th || '', last_name_th:p.last_name_th || '', first_name_en:p.first_name_en || '', last_name_en:p.last_name_en || '', number: Number(p.number), first_name: p.first_name || '', last_name: p.last_name || '', position: p.position || '', is_captain: Boolean(p.is_captain) })) }); }); event.target.value = ''; }}><option value="">{ui("คัดลอกทีมและรายชื่อจากแมตช์เดิม…")}</option>{teamSources.map((source, index) => <option key={`${source.id}-${source.key}`} value={index}>{source.name} · {source.id}</option>)}</select>
                    <label className="block text-xs">{ui("นำเข้าจาก Excel")}<input disabled={busy || locked} type="file" accept=".xlsx" className="mt-1 block max-w-full" onChange={event => { const file = event.target.files?.[0]; if (file) run(async () => team(key, { players: await readRosterExcel(file, key) })); event.target.value = ''; }} /></label>
                    <textarea disabled={busy || locked} className={`${input} min-h-24 font-mono`} value={paste[key]} aria-label={ui(`วางรายชื่อ {0}`, [key])} onChange={event => setPaste({ ...paste, [key]: event.target.value })} placeholder={ui('วางตารางจาก Excel พร้อมหัวคอลัมน์\nnumber\tfirst_name\tlast_name\tposition')} />
                    <GuardedButton disabled={busy || locked} className={btn} onClick={() => { try { team(key, { players: rosterFromRows(paste[key].split(/\r?\n/).map(row => row.split('\t'))) }); setError(''); } catch (error) { setError(error.message); } }}>{ui("ตรวจสอบและใช้รายชื่อที่วาง")}</GuardedButton>
                    <p className="text-xs text-sky-200">{ui("ตัวอย่างก่อนบันทึก ·")}{' '}{form[key].players.length}{' '}{ui("คน")}</p><div className="max-h-64 overflow-y-auto"><table className="w-full text-left text-xs"><thead><tr><th>{ui("เบอร์")}</th><th>{ui("ชื่อ")}</th><th>{ui("ตำแหน่ง")}</th></tr></thead><tbody>{form[key].players.map((p, index) => <tr key={index} className="border-b border-slate-800"><td className="py-1">{p.number}</td><td>{displayNames.personFirstName(p)} {displayNames.personLastName(p)}{p.is_captain ? ui(' (C)') : ''}</td><td>{p.position || '-'}</td></tr>)}</tbody></table></div>
                </section>)}</div></>}
            {step === 2 && matchId && !match?.is_offline_vis && getStoredUser()?.role === 'admin' && JSON.stringify(form) === JSON.stringify(savedConfig) && <VisAthleteLinks matchId={matchId} config={savedConfig} links={athleteLinks} onLinked={setAthleteLinks} />}
            {step === 3 && <div className="space-y-3 rounded bg-slate-800 p-4"><h3 className="text-lg font-bold">{(form.title) || (ui('ยังไม่ระบุชื่อแมตช์'))}</h3><p>{(form.home.name) || (ui('เจ้าบ้าน'))} ({form.home.players.length}{' '}{ui("คน) —")}{' '}{(form.away.name) || (ui('ทีมเยือน'))} ({form.away.players.length}{' '}{ui("คน)")}</p><p>{form.date} {form.time} · {(form.location) || (ui('ยังไม่ระบุสนาม'))}{' '}{ui("· สูงสุด")}{' '}{form.maxSets}{' '}{ui("เซต")}</p><p className="text-xs text-slate-400">{ui("แมตช์นี้แยกจากตารางคะแนนรายการแข่งขันและทะเบียนทีมหลัก เริ่มต้นเป็นส่วนตัว เปิดเผยแพร่ได้จากปุ่มจัดการแมตช์")}</p></div>}
        </div>
        <footer className="flex justify-between gap-2 border-t border-slate-700 p-4"><GuardedButton disabled={busy || step === 1} onClick={() => setStep(step - 1)} className={btn}>{ui("ย้อนกลับ")}</GuardedButton><div className="flex gap-2">{step < 3 ? <GuardedButton disabled={busy} onClick={next} className={btn}>{ui("ถัดไป")}</GuardedButton> : !locked && <><GuardedButton disabled={busy} onClick={() => save(false)} className={btn}>{ui("บันทึกฉบับร่าง")}</GuardedButton><GuardedButton disabled={busy} onClick={() => save(true)} className={btn}>{ui("บันทึกและเริ่มคีย์")}</GuardedButton></>}</div></footer>
    </section></div>;
}
