import {useCallback,useEffect,useState} from 'react';
import {api} from '../../api';
import {useLanguage} from '../../context/LanguageContext';
import {GuardedButton} from '../ui/GuardedAction';

const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
export default function TeamRosterRequests(){
    const {language}=useLanguage(),t=(a,b)=>language==='THA'?a:b;
    const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notes,setNotes]=useState({});
    const load=useCallback(async()=>{setData((await api.getTeamRosterRequests()).data);},[]);
    useEffect(()=>{load().catch(e=>setError(e.response?.data?.error||e.message));},[load]);
    const decide=async(row,decision)=>{
        if(busy||!window.confirm(t('ยืนยันดำเนินการคำขอนี้หรือไม่?','Confirm this roster decision?')))return;
        setBusy(true);setError('');try{await api.decideTeamRosterRequest({request_id:row.id,decision,reason:notes[row.id]});await load();}catch(e){setError(e.response?.data?.error||e.message);}finally{setBusy(false);}
    };
    const person=(kind,id)=>{const row=data[kind].find(item=>Number(item.id)===Number(id));return row?`${row.first_name} ${row.last_name||''}`:`#${id}`;};
    const roster=value=>{const parsed=parse(value);return <div><ul>{(parsed.players||[]).map(row=><li key={row.player_id}>#{row.number} · {person('players',row.player_id)} · {row.role}{Number(row.is_captain)===1?' · C':''}{Number(row.is_libero1)===1?' · L1':''}{Number(row.is_libero2)===1?' · L2':''}</li>)}</ul><p>{t('เจ้าหน้าที่ทีม','Team staff')}: {(parsed.staff_ids||[]).map(id=>person('staff',id)).join(', ')||'—'}</p></div>;};
    return <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{t('คำขอแก้ไขรายชื่อทีม','Team roster change requests')}</h2><GuardedButton disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>{t('โหลดข้อมูลล่าสุด','Refresh')}</GuardedButton></div><p>{t('เฉพาะ Super Admin เท่านั้นที่อนุมัติได้ รายชื่อในแมตช์ที่เริ่มหรือจบแล้วจะเก็บไว้ตามเดิม','Only Super Admin can approve changes. Started and completed match rosters retain their snapshots.')}</p>{error&&<p role="alert">{error}</p>}{!data&&<p>{t('กำลังโหลด…','Loading…')}</p>}{data?.requests.length===0&&<p>{t('ไม่มีคำขอ','No requests')}</p>}{data?.requests.map(row=><article key={row.id} className="rounded-xl border p-4 space-y-3"><h3 className="font-bold">{row.team_name} · {row.competition_title}</h3><p>#{row.id} · {row.requested_username} · {{pending:t('รอพิจารณา','Pending'),approved:t('อนุมัติ','Approved'),rejected:t('ไม่อนุมัติ','Rejected')}[row.status]}</p><p>{row.reason}</p><details><summary>{t('เปรียบเทียบรายชื่อเดิมกับคำขอ','Compare current roster and proposal')}</summary><div className="grid gap-4 md:grid-cols-2"><div><h4>{t('ก่อนส่งคำขอ','Before request')}</h4>{roster(row.before_data)}</div><div><h4>{t('รายชื่อที่เสนอ','Proposed roster')}</h4>{roster(row.proposal)}</div></div></details>{row.status==='pending'?<><label className="block">{t('เหตุผลการพิจารณา (อย่างน้อย 5 ตัวอักษร)','Decision reason (at least 5 characters)')}<textarea className="block w-full rounded border bg-transparent p-2" maxLength={2000} value={notes[row.id]||''} onChange={e=>setNotes(previous=>({...previous,[row.id]:e.target.value}))}/></label><div className="flex gap-3">{['approved','rejected'].map(decision=><GuardedButton key={decision} disabled={busy||(notes[row.id]||'').trim().length<5} onClick={()=>decide(row,decision)}>{decision==='approved'?t('อนุมัติรายชื่อ','Approve roster'):t('ไม่อนุมัติ','Reject')}</GuardedButton>)}</div></>:<p>{row.decision_reason}</p>}</article>)}</section>;
}
