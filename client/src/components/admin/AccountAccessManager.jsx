import { useEffect, useId, useRef, useState } from 'react';
import { Search, Plus, X, ChevronLeft, ChevronRight, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { api } from '../../api';
import { GuardedButton } from '../ui/GuardedAction';
import useAccessTranslation from '../../hooks/useAccessTranslation';
import { selectedCompetitionGroups, expandSelectedGroups } from '../../utils/competitionAccessGroups';
import './AccountAccessManager.css';

const accountStates=['pending','active','inactive','banned','rejected'];
const stateCopy={pending:'รออนุมัติ',active:'ใช้งาน',inactive:'ไม่ใช้งาน',banned:'ระงับบัญชี',rejected:'ไม่อนุมัติ'};
const emptyForm=()=>({username:'',password:'',role:'',firstname:'',lastname:'',competition_ids:[]});
export default function AccountAccessManager({users,groups,roles,names,system,loaded,scope,onReload}) {
    const ui=useAccessTranslation(),id=useId(),dialog=useRef(null),trigger=useRef(null),lock=useRef(false);
    const [query,setQuery]=useState(''),[roleFilter,setRoleFilter]=useState(''),[statusFilter,setStatusFilter]=useState('');
    const [page,setPage]=useState(1),[size,setSize]=useState(10),[editing,setEditing]=useState(null);
    const [form,setForm]=useState(emptyForm),[grantKeys,setGrantKeys]=useState([]),[baseline,setBaseline]=useState([]);
    const [status,setStatus]=useState(''),[savedStatus,setSavedStatus]=useState(''),[grantSearch,setGrantSearch]=useState('');
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
    const creating=editing==='new',allAccess=creating?form.role==='super_admin':editing?.role==='super_admin';
    const grantsDirty=JSON.stringify([...grantKeys].sort())!==JSON.stringify([...baseline].sort());
    const dirty=creating?Object.entries(form).some(([key,value])=>key==='competition_ids'?value.length:Boolean(value)):grantsDirty||status!==savedStatus;
    const filtered=users.filter(user=>(!scope.length||user.role==='super_admin'||user.competition_ids?.some(cid=>scope.some(value=>String(value)===String(cid))))
        &&(!roleFilter||user.role===roleFilter)&&(!statusFilter||user.status===statusFilter)
        &&[user.username,user.firstname,user.lastname,names[user.role],user.role].filter(Boolean).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const pages=Math.max(1,Math.ceil(filtered.length/size)),currentPage=Math.min(page,pages),rows=filtered.slice((currentPage-1)*size,currentPage*size);
    const availableRoles=[...new Set(users.map(user=>user.role))];
    const visibleGroups=groups.filter(group=>group.title.toLocaleLowerCase().includes(grantSearch.toLocaleLowerCase()));
    const picked=creating?selectedCompetitionGroups(groups,form.competition_ids):grantKeys;
    const choose=keys=>creating?setForm(previous=>({...previous,competition_ids:expandSelectedGroups(groups,keys)})):setGrantKeys(keys);
    const close=()=>{
        if(lock.current)return;
        if(dirty&&!window.confirm(ui('ทิ้งการเปลี่ยนแปลงที่ยังไม่บันทึกหรือไม่?')))return;
        setEditing(null);setError('');
    };
    useEffect(()=>{
        if(!editing)return;
        const element=dialog.current,overflow=document.body.style.overflow;
        element.showModal();document.body.style.overflow='hidden';
        return()=>{element.close();document.body.style.overflow=overflow;trigger.current?.focus();};
    },[editing]);
    const open=(user,event)=>{
        trigger.current=event.currentTarget;setError('');setNotice('');setGrantSearch('');
        setForm(emptyForm());
        const keys=user==='new'?[]:selectedCompetitionGroups(groups,user.competition_ids);
        setGrantKeys(keys);setBaseline(keys);setStatus(user.status||'');setSavedStatus(user.status||'');setEditing(user);
    };
    const run=async(action,message)=>{
        if(lock.current)return;
        lock.current=true;setBusy(true);setError('');setNotice('');
        try {
            await action();setNotice(message);
            try {await onReload();} catch {setError(ui('บันทึกแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณากดโหลดข้อมูล'));}
        } catch(failure){setError(failure.response?.data?.error||failure.message);}
        finally{lock.current=false;setBusy(false);}
    };
    const saveAccess=event=>{event.preventDefault();void run(async()=>{
        await api.accessSetCompetitions(editing.id,expandSelectedGroups(groups,grantKeys));setBaseline([...grantKeys]);
    },'บันทึกสิทธิ์แล้ว');};
    const saveStatus=event=>{
        event.preventDefault();
        if(['inactive','banned','rejected'].includes(status)&&!window.confirm(ui('ยืนยันเปลี่ยนสถานะบัญชี {0} เป็น {1}?',[editing.username,ui(stateCopy[status])])))return;
        void run(async()=>{await api.accessUpdateUser(editing.id,{status});setSavedStatus(status);},'เปลี่ยนสถานะแล้ว');
    };
    const create=event=>{event.preventDefault();void run(async()=>{
        await api.accessCreateUser({...form,competition_ids:allAccess?[]:form.competition_ids});setForm(emptyForm());setEditing(null);
    },'สร้างบัญชีแล้ว');};
    const resetFilters=()=>{setQuery('');setRoleFilter('');setStatusFilter('');setPage(1);};
    const roleTone=role=>role.includes('vims')?'vims':role.includes('scorer')?'score':role==='organizer'?'organizer':'system';
    return <section className="aam" aria-labelledby={`${id}-heading`}>
        <header className="aam-heading"><div><h2 id={`${id}-heading`}>{ui('บัญชีและสิทธิ์รายการ')} <span className="aam-count">{users.length}</span></h2><p>{ui('ค้นหาบัญชีและจัดการสิทธิ์ทีละบัญชีจากแผงด้านขวา')}</p></div><GuardedButton className="aam-primary" disabled={!loaded} onClick={event=>open('new',event)}><Plus size={16}/>{ui('เพิ่มบัญชี')}</GuardedButton></header>
        <div className="aam-filters"><label className="aam-search"><Search size={16}/><span className="sr-only">{ui('ค้นหาบัญชี')}</span><input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder={ui('ค้นหาชื่อบัญชี ชื่อผู้ใช้ หรือบทบาท')}/></label><label><span>{ui('บทบาท')}</span><select value={roleFilter} onChange={event=>{setRoleFilter(event.target.value);setPage(1);}}><option value="">{ui('ทุกบทบาท')}</option>{availableRoles.map(role=><option key={role} value={role}>{names[role]||role}</option>)}</select></label><label><span>{ui('สถานะบัญชี')}</span><select value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);setPage(1);}}><option value="">{ui('ทุกสถานะ')}</option>{accountStates.map(value=><option key={value} value={value}>{ui(stateCopy[value])}</option>)}</select></label>{(query||roleFilter||statusFilter)&&<GuardedButton onClick={resetFilters}>{ui('ล้างตัวกรอง')}</GuardedButton>}</div>
        <p className="aam-scope"><SlidersHorizontal size={14}/>{ui('รายการแข่งขันด้านบนใช้กรองบัญชีที่แสดง การมอบสิทธิ์ทำในปุ่มจัดการ')}</p>
        {!editing&&notice&&<p className="aam-success" role="status">{ui(notice)}</p>}
        {!editing&&error&&<p className="aam-error" role="alert">{ui(error)}</p>}
        <div className="aam-table-wrap"><table className="aam-table"><caption className="sr-only">{ui('บัญชีผู้ใช้ บทบาท สถานะ และสิทธิ์รายการแข่งขัน')}</caption><thead><tr><th>{ui('บัญชีผู้ใช้')}</th><th>{ui('บทบาท')}</th><th>{ui('รายการที่ได้รับสิทธิ์')}</th><th>{ui('สถานะบัญชี')}</th><th>{ui('การจัดการ')}</th></tr></thead><tbody>{rows.map(user=>{
            const assigned=groups.filter(group=>selectedCompetitionGroups(groups,user.competition_ids).includes(group.key));
            return <tr key={user.id}><td><div className="aam-identity"><span className="aam-avatar" aria-hidden="true">{user.username?.slice(0,1).toUpperCase()}</span><div><strong>{user.username}</strong>{(user.firstname||user.lastname)&&<small>{[user.firstname,user.lastname].filter(Boolean).join(' ')}</small>}</div></div></td><td><span className={`aam-role is-${roleTone(user.role)}`}>{names[user.role]||user.role}</span></td><td className="aam-competitions">{user.role==='super_admin'?<span className="aam-all"><ShieldCheck size={14}/>{ui('เข้าถึงทุกรายการ')}</span>:assigned.length?<div><span className="aam-competition" title={assigned.map(group=>group.title).join('\n')}>{assigned[0].title}</span>{assigned.length>1&&<span className="aam-more">{ui('+{0} รายการ',[assigned.length-1])}</span>}</div>:<span className="aam-muted">{ui('ยังไม่มอบสิทธิ์รายการ')}</span>}</td><td><span className={`aam-state is-${user.status}`}><i aria-hidden="true"/>{ui(stateCopy[user.status]||user.status)}</span></td><td><GuardedButton aria-label={ui('จัดการบัญชี {0}',[user.username])} onClick={event=>open(user,event)}>{ui('จัดการ')}</GuardedButton></td></tr>;
        })}{!rows.length&&<tr><td colSpan={5} className="aam-empty">{loaded?ui('ไม่พบบัญชีตามตัวกรองที่เลือก'):ui('กำลังโหลดบัญชีผู้ใช้…')}</td></tr>}</tbody></table></div>
        <footer className="aam-pagination"><span>{ui('แสดง {0}–{1} จาก {2} บัญชี',[filtered.length?(currentPage-1)*size+1:0,Math.min(currentPage*size,filtered.length),filtered.length])}</span><label>{ui('ต่อหน้า')}<select value={size} onChange={event=>{setSize(Number(event.target.value));setPage(1);}}>{[10,25,50].map(value=><option key={value}>{value}</option>)}</select></label><div><GuardedButton aria-label={ui('หน้าก่อนหน้า')} disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={16}/></GuardedButton><span>{currentPage} / {pages}</span><GuardedButton aria-label={ui('หน้าถัดไป')} disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}><ChevronRight size={16}/></GuardedButton></div></footer>
        {editing&&<dialog ref={dialog} className="aam-drawer" aria-labelledby={`${id}-drawer-title`} onCancel={event=>{event.preventDefault();close();}}>
            <header><div><p>{ui(creating?'เพิ่มบัญชี':'จัดการบัญชี')}</p><h2 id={`${id}-drawer-title`}>{creating?ui('สร้างบัญชีใหม่'):editing.username}</h2></div><GuardedButton aria-label={ui('ปิดรายละเอียด')} disabled={busy} onClick={close}><X size={20}/></GuardedButton></header>
            <div className="aam-drawer-body">
                {error&&<p className="aam-error" role="alert">{ui(error)}</p>}{notice&&<p className="aam-success" role="status">{ui(notice)}</p>}
                {!creating&&<div className="aam-account-summary"><span className="aam-avatar" aria-hidden="true">{editing.username?.slice(0,1).toUpperCase()}</span><div><strong>{editing.username}</strong><span className={`aam-role is-${roleTone(editing.role)}`}>{names[editing.role]||editing.role}</span></div></div>}
                <form id={`${id}-form`} onSubmit={creating?create:saveAccess}>
                    {creating&&<fieldset disabled={busy} className="aam-create-fields"><legend>{ui('ข้อมูลบัญชี')}</legend>{['username','password',...(['scorer','referee'].includes(form.role)?['firstname','lastname']:[])].map(field=><label key={field}>{ui({username:'ชื่อบัญชี',password:'รหัสผ่านอย่างน้อย 8 ตัว',firstname:'ชื่อจริง',lastname:'นามสกุล'}[field])}<input autoFocus={field==='username'} type={field==='password'?'password':'text'} autoComplete={field==='password'?'new-password':field==='username'?'off':field==='firstname'?'given-name':'family-name'} minLength={field==='password'?8:undefined} maxLength={field==='username'?50:undefined} required value={form[field]} onChange={event=>setForm({...form,[field]:event.target.value})}/></label>)}<label>{ui('บทบาท')}<select required value={form.role} onChange={event=>setForm({...form,role:event.target.value,competition_ids:event.target.value==='super_admin'?[]:form.competition_ids})}><option value="">{ui('เลือกบทบาท')}</option>{roles.map(role=><option key={role} value={role}>{names[role]||role}</option>)}</select></label></fieldset>}
                    <fieldset disabled={busy} className="aam-grants"><legend>{ui('สิทธิ์การแข่งขัน')}</legend>{allAccess?<p className="aam-all"><ShieldCheck size={18}/>{ui('บัญชีผู้ดูแลระบบกลางเข้าถึงทุกรายการโดยอัตโนมัติ')}</p>:<><p>{ui('เลือกชื่อรายการครั้งเดียว ครอบคลุมทั้งประเภทชายและหญิงของรายการเดียวกัน')}</p><label className="aam-search"><Search size={16}/><span className="sr-only">{ui('ค้นหารายการแข่งขัน')}</span><input type="search" value={grantSearch} onChange={event=>setGrantSearch(event.target.value)} placeholder={ui('ค้นหารายการแข่งขัน')}/></label><span className="aam-selected">{ui('เลือกแล้ว {0} รายการ',[picked.length])}</span><div className="aam-grant-options">{visibleGroups.map(group=><label key={group.key}><input type="checkbox" checked={picked.includes(group.key)} onChange={event=>choose(event.target.checked?[...picked,group.key]:picked.filter(key=>key!==group.key))}/><span>{group.title}</span></label>)}{!visibleGroups.length&&<p className="aam-muted">{ui('ไม่พบรายการแข่งขัน')}</p>}</div>{creating&&!system&&!form.competition_ids.length&&<p className="aam-muted">{ui('เลือกอย่างน้อย 1 รายการที่คุณดูแลก่อนสร้างบัญชีผู้บันทึก')}</p>}</>}</fieldset>
                </form>
                {!creating&&<form className="aam-status-form" onSubmit={saveStatus}><h3>{ui('สถานะบัญชี')}</h3>{system?<><label>{ui('สถานะใหม่')}<select disabled={busy} value={status} onChange={event=>setStatus(event.target.value)}>{accountStates.map(value=><option key={value} value={value}>{ui(stateCopy[value])}</option>)}</select></label><p>{ui('การปิดใช้งานหรือระงับบัญชีจะทำให้บัญชีเข้าใช้งานไม่ได้')}</p><GuardedButton type="submit" disabled={busy||status===savedStatus}>{ui('บันทึกสถานะบัญชี')}</GuardedButton><small>{ui('สถานะบัญชีและสิทธิ์รายการบันทึกแยกกัน')}</small></>:<p>{ui(stateCopy[savedStatus])} · {ui('เฉพาะผู้ดูแลระบบกลางเท่านั้นที่เปลี่ยนสถานะบัญชีได้')}</p>}</form>}
            </div>
            <footer><span>{dirty?ui('มีการเปลี่ยนแปลงที่ยังไม่บันทึก'):''}</span><div><GuardedButton disabled={busy} onClick={close}>{ui('ยกเลิกการแก้ไข')}</GuardedButton>{(!allAccess||creating)&&<GuardedButton className="aam-primary" type="submit" form={`${id}-form`} disabled={busy||(creating?(!form.username.trim()||!form.password||!form.role||(!system&&!form.competition_ids.length)):!grantsDirty)}>{busy?ui('กำลังบันทึก…'):ui(creating?'สร้างบัญชี':'บันทึกสิทธิ์')}</GuardedButton>}</div></footer>
        </dialog>}
    </section>;
}
