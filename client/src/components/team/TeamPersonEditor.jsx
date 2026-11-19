import {useEffect,useId,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {api} from '../../api';
import {useLanguage} from '../../context/LanguageContext';
import {GuardedButton} from '../ui/GuardedAction';
import {teamStaffRoles} from '../../utils/teamDataQuality';

export default function TeamPersonEditor({kind,row,team,people,onClose,onSaved}){
    const {language}=useLanguage(),th=language==='THA',t=(a,b)=>th?a:b,id=useId(),dialog=useRef(null),lock=useRef(false);
    const build=person=>({first_name:person?.first_name||'',last_name:person?.last_name||'',first_name_th:person?.first_name_th||'',last_name_th:person?.last_name_th||'',first_name_en:person?.first_name_en||'',last_name_en:person?.last_name_en||'',birth_date:String(person?.birth_date||'').slice(0,10),number:person?.number??'',gender:team.gender||person?.gender||'Male',position:person?.position||'OH',role:person?.role||'Head Coach',master_revision:person?.master_revision??0});
    const [editing,setEditing]=useState(row),[form,setForm]=useState(()=>build(row)),[baseline,setBaseline]=useState(()=>JSON.stringify(build(row))),[busy,setBusy]=useState(false),[error,setError]=useState(''),[duplicates,setDuplicates]=useState(null),[allow,setAllow]=useState(false),[reason,setReason]=useState('');
    const dirty=JSON.stringify(form)!==baseline;
    const close=()=>{if(lock.current)return;if(dirty&&!window.confirm(t('ทิ้งข้อมูลที่ยังไม่บันทึกหรือไม่?','Discard unsaved changes?')))return;onClose();};
    useEffect(()=>{const element=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow;element.showModal();document.body.style.overflow='hidden';return()=>{element.close();document.body.style.overflow=overflow;previous?.focus?.();};},[]);
    const change=(key,value)=>{setForm(previous=>({...previous,[key]:value}));setError('');setDuplicates(null);setAllow(false);};
    const save=async event=>{
        event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
        const payload=kind==='players'?{first_name:form.first_name_th||form.first_name_en||form.first_name,last_name:form.last_name_th||form.last_name_en||form.last_name,first_name_th:form.first_name_th,last_name_th:form.last_name_th,first_name_en:form.first_name_en,last_name_en:form.last_name_en,number:Number(form.number),birth_date:form.birth_date||null,gender:form.gender,position:form.position,master_revision:form.master_revision}:{first_name:form.first_name,last_name:form.last_name,role:form.role,gender:form.gender,master_revision:form.master_revision};
        try{const data={...payload,...(allow?{allow_similar:true,duplicate_reason:reason}:{})};if(kind==='players')await(editing?api.updatePlayer(editing.id,data):api.addPlayer(data));else await(editing?api.updateStaff(editing.id,data):api.addStaff(data));await onSaved();}
        catch(failure){setError(failure.response?.data?.error||failure.message);setDuplicates(failure.response?.data?.candidates?failure.response.data:null);}
        finally{lock.current=false;setBusy(false);}
    };
    return <dialog ref={dialog} className="tdc-dialog" aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();close();}}>
        <header><div><h2 id={`${id}-title`}>{editing?t('จัดการข้อมูล','Manage record'):kind==='players'?t('เพิ่มนักกีฬา','Add athlete'):t('เพิ่มเจ้าหน้าที่ทีม','Add team staff')}</h2><p>{t('บันทึกในทะเบียนกลางของทีม รายชื่อรายการแข่งขันเลือกและยืนยันแยกกัน','Save to the team master register. Competition rosters are selected and confirmed separately.')}</p></div><GuardedButton disabled={busy} aria-label={t('ปิด','Close')} onClick={close}><X size={20}/></GuardedButton></header>
        <form onSubmit={save} id={`${id}-form`} className="tdc-dialog-body">
            {error&&<p role="alert" className="tdc-error">{error}</p>}
            {duplicates&&<section className="tdc-warning"><strong>{t('พบข้อมูลที่อาจเป็นคนเดียวกัน','Potential existing person')}</strong>{duplicates.candidates.map(candidate=><article key={candidate.id}><span>{candidate.first_name} {candidate.last_name} {candidate.birth_date&&String(candidate.birth_date).slice(0,10)}</span><GuardedButton type="button" onClick={()=>{const person=people.find(item=>item.id===candidate.id);if(person){setEditing(person);const value=build(person);setForm(value);setBaseline(JSON.stringify(value));setError('');setDuplicates(null);setAllow(false);setReason('');}}}>{t('เปิดข้อมูลคนเดิม','Use existing record')}</GuardedButton></article>)}{duplicates.duplicate==='similar'&&<><label><input type="checkbox" checked={allow} onChange={event=>setAllow(event.target.checked)}/>{t('เป็นคนละคนกับข้อมูลเดิม','This is a different person')}</label>{allow&&<label>{t('เหตุผลที่ยืนยันว่าเป็นคนละคน','Reason this is a different person')}<input required minLength={5} maxLength={2000} value={reason} onChange={event=>setReason(event.target.value)}/></label>}</>}</section>}
            <fieldset disabled={busy} className="tdc-form-grid">
                {['first_name','last_name'].map(key=><label key={key}>{key==='first_name'?t('ชื่อจริง','First name'):t('นามสกุล','Last name')}<input required={kind==='staff'||!(form[key+'_th']||form[key+'_en'])} maxLength={kind==='players'?50:100} value={form[key]} onChange={event=>change(key,event.target.value)}/></label>)}
                {kind==='players'&&<>{[['first_name_th',t('ชื่อ (ไทย)','First name (Thai)')],['last_name_th',t('นามสกุล (ไทย)','Last name (Thai)')],['first_name_en',t('ชื่อ (อังกฤษ)','First name (English)')],['last_name_en',t('นามสกุล (อังกฤษ)','Last name (English)')]].map(([key,label])=><label key={key}>{label}<input maxLength={50} value={form[key]} onChange={event=>change(key,event.target.value)}/></label>)}<label>{t('หมายเลขเสื้อเริ่มต้น','Default jersey number')}<input type="number" required min="1" max="999" value={form.number} onChange={event=>change('number',event.target.value)}/></label><label>{t('วันเกิด (ค.ศ.)','Birth date (CE)')}<input type="date" max={new Date().toISOString().slice(0,10)} value={form.birth_date} onChange={event=>change('birth_date',event.target.value)}/></label><label>{t('ตำแหน่งการเล่น','Playing position')}<select value={form.position} onChange={event=>change('position',event.target.value)}>{['S','OH','OPP','MB','L'].map(value=><option key={value}>{value}</option>)}</select></label></>}
                {kind==='staff'&&<label>{t('หน้าที่','Role')}<select value={form.role} onChange={event=>change('role',event.target.value)}>{teamStaffRoles.map(role=><option key={role}>{role}</option>)}</select></label>}
                <label>{t('ประเภท','Gender')}<select disabled={kind==='players'&&['Male','Female'].includes(team.gender)} value={form.gender} onChange={event=>change('gender',event.target.value)}><option value="Male">{t('ชาย','Male')}</option><option value="Female">{t('หญิง','Female')}</option></select></label>
            </fieldset>
            <p className="tdc-note">{t('ไม่ลบประวัติเดิมเมื่อพักใช้งาน การแก้ข้อมูลนักกีฬาที่เลือกไว้แล้วอาจทำให้ต้องยืนยันรายชื่อรายการใหม่','Archiving preserves history. Changing a selected athlete may require competition roster reconfirmation.')}</p>
        </form>
        <footer><GuardedButton disabled={busy} onClick={close}>{t('ยกเลิก','Cancel')}</GuardedButton><GuardedButton className="tdc-primary" type="submit" form={`${id}-form`} disabled={busy||(!dirty&&Boolean(editing))||(allow&&reason.trim().length<5)}>{busy?t('กำลังบันทึก…','Saving…'):t('บันทึกทะเบียนกลาง','Save master data')}</GuardedButton></footer>
    </dialog>;
}
