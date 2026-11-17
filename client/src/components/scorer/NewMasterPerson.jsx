import {useState} from 'react';
import {GuardedButton} from '../ui/GuardedAction';

const roles=[['Team Manager','ผู้จัดการทีม'],['Head Coach','ผู้ฝึกสอนหลัก'],['Assistant Coach','ผู้ช่วยผู้ฝึกสอน 1'],['Assistant Coach 2','ผู้ช่วยผู้ฝึกสอน 2'],['Doctor','แพทย์ประจำทีม'],['Therapist/Trainer','นักกายภาพ/เทรนเนอร์']];
export default function NewMasterPerson({kind,side,teamName,gender,requiresBirthDate=false,disabled,available=[],onAdd,t}){
    const [open,setOpen]=useState(false),[error,setError]=useState('');
    const empty=()=>({first_name:'',last_name:'',number:'',position:'',gender:['Male','Female'].includes(gender)?gender:'',birth_date:'',role:kind==='staff'?'Head Coach':''});
    const [person,setPerson]=useState(empty);
    const athlete=kind==='players';
    const change=(key,value)=>{setPerson(previous=>({...previous,[key]:value}));setError('');};
    const add=()=>{
        const first=person.first_name.trim(),last=person.last_name.trim();
        if(!first||(!athlete&&!person.role)||athlete&&(!['Male','Female'].includes(person.gender)||!Number.isInteger(Number(person.number))||Number(person.number)<1||Number(person.number)>999)){
            setError(t('กรุณาระบุชื่อ เพศ และหมายเลขเสื้อ 1–999 สำหรับนักกีฬา หรือตำแหน่งสำหรับเจ้าหน้าที่','Enter a first name, athlete gender and shirt number (1–999), or a staff position.'));return;
        }
        if(available.some(row=>String(row.first_name||'').trim().toLowerCase()===first.toLowerCase()&&String(row.last_name||'').trim().toLowerCase()===last.toLowerCase())){
            setError(t('มีชื่อนี้ในรายชื่อทีมแล้ว กรุณาเลือกบุคคลเดิม หรือให้ผู้ดูแลตรวจสอบ','This name already exists in the team. Select the registered person or ask an administrator to review.'));return;
        }
        if(athlete&&requiresBirthDate&&!person.birth_date){setError(t('รายการนี้กำหนดรุ่นอายุ กรุณาระบุวันเกิดก่อนเพิ่มนักกีฬา','This age-group competition requires a birth date.'));return;}
        onAdd({...person,first_name:first,last_name:last,id:`new-${crypto.randomUUID()}`,create_master:true});
        setOpen(false);setPerson(empty());setError('');
    };
    return <div className="smm-master-create">
        {!open?<GuardedButton type="button" disabled={disabled} onClick={()=>setOpen(true)}>{athlete?t('สร้างนักกีฬาใหม่และเพิ่มเข้าแมตช์','Create athlete and add to match'):t('สร้างเจ้าหน้าที่ทีมใหม่และเพิ่มเข้าแมตช์','Create team staff and add to match')}</GuardedButton>:<fieldset disabled={disabled}>
            <legend>{athlete?t('นักกีฬาใหม่','New athlete'):t('เจ้าหน้าที่ทีมใหม่','New team staff')} · {teamName}</legend>
            <p className="smm-hint">{t('ข้อมูลหลักจะถูกสร้างพร้อมเพิ่มเข้าแมตช์เมื่อกดบันทึกด้านล่าง ใช้งานได้ทันทีโดยไม่รอตรวจรับ','Master data is created and added to this match when you save below. It is immediately available without approval.')}</p>
            <div className="smm-form-grid">
                {['first_name','last_name'].map((key,index)=><label className="smm-field" key={key}>{index?t('นามสกุล','Last name'):t('ชื่อ *','First name *')}<input aria-label={`${t('ข้อมูลหลักใหม่','New master')} ${side} ${kind} ${key}`} maxLength="50" value={person[key]} onChange={event=>change(key,event.target.value)}/></label>)}
                {athlete?<>
                    <label className="smm-field">{t('หมายเลขเสื้อเริ่มต้น *','Initial shirt number *')}<input aria-label={`${t('ข้อมูลหลักใหม่','New master')} ${side} number`} type="number" min="1" max="999" value={person.number} onChange={event=>change('number',event.target.value)}/></label>
                    <label className="smm-field">{t('เพศ *','Gender *')}<select aria-label={`${t('ข้อมูลหลักใหม่','New master')} ${side} gender`} value={person.gender} onChange={event=>change('gender',event.target.value)}><option value="">{t('เลือกเพศ','Select gender')}</option><option value="Male">{t('ชาย','Male')}</option><option value="Female">{t('หญิง','Female')}</option></select></label>
                    <label className="smm-field">{t('วันเกิด (จำเป็นสำหรับรุ่นอายุ)','Birth date (required for age groups)')}<input aria-label={`${t('ข้อมูลหลักใหม่','New master')} ${side} birth_date`} type="date" value={person.birth_date} onChange={event=>change('birth_date',event.target.value)}/></label>
                    <label className="smm-field">{t('ตำแหน่งการเล่นเริ่มต้น','Initial playing position')}<select value={person.position} onChange={event=>change('position',event.target.value)}>{['','S','OH','MB','OPP'].map(value=><option key={value} value={value}>{value||'—'}</option>)}</select></label>
                </>:<label className="smm-field">{t('ตำแหน่งเจ้าหน้าที่ทีม *','Team staff position *')}<select aria-label={`${t('ข้อมูลหลักใหม่','New master')} ${side} staff_role`} value={person.role} onChange={event=>change('role',event.target.value)}>{roles.map(([value,label])=><option key={value} value={value}>{t(label,value)}</option>)}</select></label>}
            </div>
            {error&&<p role="alert" className="smm-error">{error}</p>}
            <div className="smm-actions"><GuardedButton type="button" disabled={disabled} onClick={add}>{t('เพิ่มในรายการรอบันทึก','Add to pending changes')}</GuardedButton><GuardedButton type="button" disabled={disabled} onClick={()=>{setOpen(false);setError('');setPerson(empty());}}>{t('ยกเลิก','Cancel')}</GuardedButton></div>
        </fieldset>}
    </div>;
}
