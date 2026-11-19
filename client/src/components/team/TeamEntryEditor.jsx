import {useEffect,useId,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {api} from '../../api';
import {useLanguage} from '../../context/LanguageContext';
import useDisplayNames from '../../hooks/useDisplayNames';
import {GuardedButton} from '../ui/GuardedAction';

export default function TeamEntryEditor({entryId,data,onClose,onSaved,onReloadData}){
    const {language}=useLanguage(),th=language==='THA',t=(a,b)=>th?a:b,names=useDisplayNames(),dialog=useRef(null),lock=useRef(false),id=useId();
    const [snapshot,setSnapshot]=useState(null),[players,setPlayers]=useState([]),[staff,setStaff]=useState([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState(''),[retry,setRetry]=useState(0);
    const entry=snapshot?.entry,locked=entry&&(entry.roster_locked_at||Number(entry.has_live_match)||Number(entry.has_completed_match));
    const dirty=snapshot&&(JSON.stringify(players)!==JSON.stringify(snapshot.players)||JSON.stringify(staff)!==JSON.stringify(snapshot.staff_ids));
    const close=()=>{if(lock.current)return;if(dirty&&!window.confirm(t('ทิ้งการเลือกรายชื่อที่ยังไม่บันทึกหรือไม่?','Discard unsaved roster selection?')))return;onClose();};
    useEffect(()=>{const element=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;element.showModal();document.body.style.overflow='hidden';return()=>{element.close();document.body.style.overflow=overflow;previous?.focus?.();};},[]);
    useEffect(()=>{let active=true;setLoading(true);setError('');api.getTeamEntrySelection(entryId).then(response=>{if(active){setSnapshot(response.data);setPlayers(response.data.players);setStaff(response.data.staff_ids);}}).catch(failure=>{if(active)setError(failure.response?.data?.error||failure.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[entryId,retry]);
    const eligibility=id=>snapshot?.eligibility.find(item=>item.id===id)?.reason;
    const reasons={inactive:t('พักใช้งาน','Archived'),gender:t('ประเภทไม่ตรงรายการ','Gender does not match'),age:t('เกินรุ่นอายุ','Age limit exceeded'),birth_date:t('ตรวจวันเกิด','Check birth date'),unknown_age_group:t('ยังไม่กำหนดกติกาอายุ','Unknown age category')};
    const chosen=new Set(players.map(row=>row.player_id)),numbers=players.map(row=>Number(row.number));
    const invalid=players.some(row=>eligibility(row.player_id)||!Number.isInteger(Number(row.number))||Number(row.number)<1||Number(row.number)>999)||new Set(numbers).size!==numbers.length;
    const toggle=person=>setPlayers(previous=>chosen.has(person.id)?previous.filter(row=>row.player_id!==person.id):[...previous,{player_id:person.id,master_revision:snapshot.eligibility.find(item=>item.id===person.id)?.revision,number:person.number,role:person.position||'OH',is_captain:0,is_libero1:0,is_libero2:0}]);
    const change=(pid,key,value)=>setPlayers(previous=>previous.map(row=>row.player_id===pid?{...row,[key]:value,...(key==='role'&&!['L','L1','L2'].includes(value)?{is_libero1:0,is_libero2:0}:{})}:row));
    const save=async confirm=>{
        if(lock.current||!snapshot)return;
        if(confirm&&!window.confirm(t(`ยืนยันรายชื่อ ${players.length} คน สำหรับ ${entry.competition_title} ${entry.age_group_name}?`,`Confirm ${players.length} athletes for ${entry.competition_title} ${entry.age_group_name}?`)))return;
        lock.current=true;setBusy(true);setError('');
        const payload={revision:entry.roster_revision,players,staff_ids:staff,confirm,reason};
        try{if(locked)await api.requestTeamEntryChange(entryId,payload);else await api.saveTeamEntrySelection(entryId,payload);await onSaved();}
        catch(failure){setError(failure.response?.data?.error||failure.message);}
        finally{lock.current=false;setBusy(false);}
    };
    return <dialog ref={dialog} className="tdc-dialog is-wide" aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();close();}}>
        <header><div><h2 id={`${id}-title`}>{t('รายชื่อประจำรายการ','Competition roster')}</h2><p>{entry?.competition_title} · {entry?.age_group_name} · {entry?.competition_gender}</p></div><GuardedButton disabled={busy} aria-label={t('ปิด','Close')} onClick={close}><X size={20}/></GuardedButton></header>
        <div className="tdc-dialog-body">{loading&&<p role="status">{t('กำลังโหลดรายชื่อ…','Loading selection…')}</p>}{error&&<p className="tdc-error" role="alert">{error} <GuardedButton disabled={busy||loading} onClick={async()=>{await onReloadData?.();setRetry(value=>value+1);}}>{t('โหลดข้อมูลล่าสุด','Reload current data')}</GuardedButton></p>}
            {snapshot&&!loading&&<>
                <p className={locked?'tdc-warning':'tdc-note'}>{locked?t('รายชื่อล็อกแล้ว การเลือกในหน้านี้เป็นข้อเสนอให้ Super Admin อนุมัติ และจะไม่ย้อนเปลี่ยนแมตช์ที่เริ่มหรือจบแล้ว','This roster is locked. Changes are proposals for Super Admin approval and do not change started or completed match snapshots.'):t('เลือกอย่างน้อย 6 คน ระบุหมายเลขเสื้อ กัปตันและ Libero ตามรายการ แล้วตรวจและยืนยัน','Select at least 6 athletes. Set entry jersey numbers, captain and Liberos, then review and confirm.')}</p>
                <div className="tdc-toolbar"><input type="search" aria-label={t('ค้นหานักกีฬา','Search athletes')} value={search} onChange={event=>setSearch(event.target.value)} placeholder={t('ค้นหาชื่อหรือเบอร์','Name or number')}/><strong>{players.length} / {entry.max_players||'—'} {t('คน','athletes')}</strong><span>{t('ฉบับ','Revision')} {entry.roster_revision}</span></div>
                <fieldset disabled={busy}><div className="tdc-scroll"><table><thead><tr>{[t('เลือก','Select'),t('นักกีฬา','Athlete'),t('สิทธิ์','Eligibility'),t('เบอร์รายการ','Entry number'),t('ตำแหน่ง','Position'),'C','L1','L2'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data.players.filter(person=>[names.personName(person),person.number].join(' ').toLowerCase().includes(search.toLowerCase())).map(person=>{
                    const selected=players.find(row=>row.player_id===person.id),issue=eligibility(person.id);
                    return <tr key={person.id}><td><input type="checkbox" aria-label={t('เลือก ','Select ')+names.personName(person)} disabled={Boolean(issue)&&!selected} checked={Boolean(selected)} onChange={()=>toggle(person)}/></td><td>{names.personName(person)}<small>#{person.number}</small></td><td>{issue?<span className="tdc-badge">{reasons[issue]||issue}</span>:<span className="tdc-ok">{t('ผ่าน','Eligible')}</span>}</td><td>{selected&&<input aria-label={`${t("หมายเลขเสื้อ","Number")} ${person.id}`} type="number" min="1" max="999" value={selected.number} onChange={event=>change(person.id,'number',Number(event.target.value))}/>}</td><td>{selected&&<select aria-label={`${t("ตำแหน่ง","Position")} ${person.id}`} value={selected.role} onChange={event=>change(person.id,'role',event.target.value)}>{['S','OH','OPP','MB','L'].map(value=><option key={value}>{value}</option>)}</select>}</td>{['is_captain','is_libero1','is_libero2'].map(key=><td key={key}>{selected&&<input type="checkbox" aria-label={`${key} ${person.id}`} disabled={key!=='is_captain'&&!['L','L1','L2'].includes(selected.role)} checked={Number(selected[key])===1} onChange={event=>change(person.id,key,event.target.checked?1:0)}/>}</td>)}</tr>;
                })}</tbody></table></div><h3>{t('เจ้าหน้าที่ประจำรายการ','Entry team staff')}</h3><div className="tdc-staff-options">{data.staff.map(person=><label key={person.id}><input type="checkbox" disabled={Number(person.is_active)===0&&!staff.includes(person.id)} checked={staff.includes(person.id)} onChange={event=>setStaff(previous=>event.target.checked?[...previous,person.id]:previous.filter(pid=>pid!==person.id))}/><span>{names.personName(person)} · {person.role} {Number(person.is_active)===0&&t('(พักใช้งาน)','(Archived)')}</span></label>)}</div></fieldset>
                {invalid&&<p className="tdc-warning">{t('ตรวจข้อมูลนักกีฬาที่เลือกและหมายเลขเสื้อซ้ำก่อนบันทึก','Review selected athletes and duplicate jersey numbers before saving.')}</p>}
                {locked&&<label className="tdc-request-reason">{t('เหตุผลขอแก้ไข (Super Admin เท่านั้นที่อนุมัติได้)','Change reason (only Super Admin may approve)')}<textarea value={reason} minLength={5} maxLength={2000} onChange={event=>setReason(event.target.value)}/></label>}
            </>}
        </div>
        <footer><GuardedButton disabled={busy} onClick={close}>{t('ยกเลิก','Cancel')}</GuardedButton>{!locked&&<GuardedButton disabled={busy||loading||invalid||!dirty} onClick={()=>save(false)}>{t('บันทึกฉบับร่าง','Save draft')}</GuardedButton>}<GuardedButton className="tdc-primary" disabled={busy||loading||!snapshot||invalid||players.length<6||Boolean(entry?.max_players&&players.length>entry.max_players)||(locked&&(!dirty||reason.trim().length<5))} onClick={()=>save(true)}>{locked?t('ส่งคำขอแก้ไข','Request change'):t('ตรวจและยืนยันรายชื่อ','Review and confirm')}</GuardedButton></footer>
    </dialog>;
}
