import PublicAnchor from '../../components/ui/PublicAnchor.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../api';
import { getStoredUser } from '../../auth/authStorage';
import { workspaceFor } from '../../utils/adminWorkspace';
import { authorizedAdminMatchLocation } from '../../utils/adminMatchRoutes';
import AdminWorkspaceShell from '../../components/admin/AdminWorkspaceShell';
import { GuardedButton } from '../../components/ui/GuardedAction';
import './AdminMatchDetail.css';

const statuses={scheduled:'ยังไม่เริ่ม',live:'กำลังแข่งขัน',completed:'จบการแข่งขัน',cancelled:'ยกเลิก',submitted:'รอตรวจรับ',confirmed:'ยืนยันแล้ว',returned:'ส่งกลับแก้ไข',reopened:'เปิดแก้ไข',approved:'อนุมัติ',pending:'รออนุมัติ',rejected:'ไม่อนุมัติ'};
const adminTabs=[['overview','ภาพรวม'],['roster','รายชื่อแข่งขัน'],['score','คะแนนและใบบันทึก'],['history','การตรวจรับและประวัติ']];
const person=p=>[p?.first_name_th||p?.first_name,p?.last_name_th||p?.last_name].filter(Boolean).join(' ')||'—';
const date=value=>value?new Date(value).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}):'—';
const label=status=>statuses[status]||status||'ยังไม่ส่งตรวจ';
const domainLabel=domain=>domain==='score'?'คะแนน':'สถิติ VIMS';
const eventLabels={POINT:'ได้คะแนน',SUBSTITUTION:'เปลี่ยนตัว',SUB:'เปลี่ยนตัว',TIMEOUT:'เวลานอก',SANCTION:'บทลงโทษ',FIRST_SERVE:'เสิร์ฟแรก',SET_END:'จบเซต'};

function Table({headers,children,empty}){return <div className="amd-table-scroll"><table><thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{empty?<tr><td colSpan={headers.length} className="amd-empty">{empty}</td></tr>:children}</tbody></table></div>;}
export default function AdminMatchDetail(){
    const {matchId}=useParams(),navigate=useNavigate(),[params,setParams]=useSearchParams();
    const location=useLocation();
    const requestVersion=useRef(0);
    const invalidateRequest=useCallback(()=>{requestVersion.current++;},[]);
    const [user,setUser]=useState(getStoredUser()),[data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[reason,setReason]=useState('');
    const organizer=user?.role==='organizer';
    const tabs=organizer?[['overview','ภาพรวมและความพร้อม'],['roster','รายชื่อแข่งขัน'],['score','ผลการแข่งขันและเอกสาร'],['history','สถานะการตรวจรับ']]:adminTabs;
    const tab=tabs.some(([key])=>key===params.get('tab'))?params.get('tab'):'overview';
    const eventPage=Math.max(1,Number(params.get('page'))||1);
    const workspace=workspaceFor(user?.role),home=user?.role==='super_admin'?'/access-center':workspace?.home||'/access-center';
    const reload=useCallback(async()=>{
        const version=++requestVersion.current;
        setLoading(true);setError('');setData(null);
        try{const session=(await api.accessSession()).data;const detail=(await api.accessMatchDetail(matchId,eventPage)).data;if(version===requestVersion.current){setUser(session);setData(detail);}}
        catch(e){if(version===requestVersion.current)setError(e.response?.data?.error||'โหลดรายละเอียดไม่สำเร็จ');}finally{if(version===requestVersion.current)setLoading(false);}
    },[matchId,eventPage]);
    useEffect(()=>{void reload();return invalidateRequest;},[reload,invalidateRequest]);
    useEffect(()=>{
        if(!data)return;
        const canonical=authorizedAdminMatchLocation(data.match,location);
        if(canonical)navigate(`${canonical.pathname}${canonical.search||''}${canonical.hash||''}`,{replace:true});
    },[data,location,navigate]);
    const selectTab=key=>{setParams(key==='overview'?{}:{tab:key});setNotice('');setReason('');};
    const action=async(domain,kind)=>{
        const review=data.latest[domain];if(!review||busy)return;
        setBusy(true);setError('');setNotice('');
        try{await api.accessReview('match',data.match.id,domain,kind,{revision:review.revision,reason,
            ...(kind==='publish'?{published:!data.publication.published}:{})});await reload();setReason('');setNotice('ดำเนินการแล้ว');}
        catch(e){const message=e.response?.data?.error||'ดำเนินการไม่สำเร็จ';if(e.response?.status===409)await reload();setError(message);}
        finally{setBusy(false);}
    };
    const match=data?.match||{},roster=data?.roster||{};
    const team=id=>String(id)===String(roster.home?.team_id)?roster.home.name:String(id)===String(roster.away?.team_id)?roster.away.name:'—';
    const player=id=>Object.values(roster).flatMap(r=>r.players).find(p=>String(p.id)===String(id));
    const playerLabel=id=>{const p=player(id);return p?`#${p.number} ${person(p)}`:id?`นักกีฬา ID ${id}`:'—';};
    const sections=[{label:'พื้นที่ทำงาน',items:[{key:'back',label:'แมตช์ในขอบเขต',href:`${home}?view=matches`,icon:<ArrowLeft size={18}/>},
        {key:'detail',label:'รายละเอียดแมตช์',icon:<ClipboardList size={18}/>}]}];
    if(organizer)sections.push({label:'จัดการแข่งขัน',items:[{key:'schedule',label:'จัดการตารางแข่งขัน',href:'/admin?view=matches',icon:<ClipboardList size={18}/>},{key:'registrations',label:'จัดการรายการและการสมัคร',href:'/admin?view=competitions',icon:<ClipboardList size={18}/>} ]});
    return <AdminWorkspaceShell user={user} sections={sections} activeKey="detail" title="รายละเอียดแมตช์" subtitle={organizer?'ติดตามความพร้อม ผลการแข่งขัน และสถานะตรวจรับในรายการที่ได้รับสิทธิ์':'ตรวจสอบข้อมูลการแข่งขันและงานตรวจรับตามสิทธิ์ส่วนงาน'}
        headerActions={<GuardedButton className="amd-refresh" disabled={loading||busy} onClick={reload}><RefreshCw size={16}/>โหลดข้อมูล</GuardedButton>}>
        <div className="amd-page" aria-busy={loading||busy}>
            <Link className="amd-back" to={`${home}?view=matches`}><ArrowLeft size={16}/>กลับรายการแมตช์</Link>
            {error&&<p role="alert" className="amd-alert">{error}</p>}{notice&&<p role="status" className="amd-notice">{notice}</p>}
            {loading&&<p role="status" className="amd-empty">กำลังโหลดรายละเอียด…</p>}
            {data&&<>
                {organizer&&<div className="amd-document-links"><Link to="/admin?view=matches">จัดการตารางแข่งขัน</Link><Link to="/admin?view=competitions">จัดการรายการและการสมัคร</Link></div>}
                <section className="amd-match-card"><div className="amd-match-meta"><span>แมตช์ {match.match_number||match.id}</span><span className="aw-status">{label(match.status)}</span><span className="amd-readonly"><ShieldCheck size={14}/>อ่านอย่างเดียว</span></div>
                    <h2>{roster.home.name||'รอระบุทีม'} <span>พบ</span> {roster.away.name||'รอระบุทีม'}</h2><p>{match.competition_name||match.title_th||'—'}</p>
                    <div className="amd-match-tags">{[match.age_group_name,match.competition_gender||match.gender,match.round_name,match.pool_name&&`สาย ${match.pool_name}`].filter(Boolean).map((v,i)=><span key={i}>{v}</span>)}</div>
                </section>
                <nav className="amd-tabs" aria-label="มุมมองรายละเอียดแมตช์">{tabs.map(([key,name])=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>selectTab(key)}>{name}</button>)}</nav>
                {tab==='overview'&&<>
                    <div className="amd-overview-grid"><section className="amd-panel"><h2>ข้อมูลการแข่งขัน</h2><dl className="amd-facts">
                        <div><dt>วันที่แข่งขัน</dt><dd>{match.match_date?new Date(match.match_date).toLocaleDateString('th-TH',{dateStyle:'long'}):'ยังไม่กำหนด'}</dd></div>
                        <div><dt>เวลา</dt><dd>{match.start_time?.slice(0,5)||'ยังไม่กำหนด'}</dd></div><div><dt>สนาม / คอร์ต</dt><dd>{[match.stadium_name||match.location,match.court_number].filter(Boolean).join(' / ')||'ยังไม่กำหนด'}</dd></div>
                        <div><dt>ผู้บันทึกคะแนน</dt><dd>{[match.scorer_firstname,match.scorer_lastname].filter(Boolean).join(' ')||match.scorer_name||'ยังไม่ระบุ'}</dd></div>
                        <div><dt>ผลการแข่งขัน</dt><dd>{match.status==='scheduled'?'ยังไม่มีผลการแข่งขัน':`${match.home_set_score??0} – ${match.away_set_score??0} เซต`}</dd></div>
                    </dl></section><section className="amd-panel"><h2>ความพร้อมก่อนแข่งขัน</h2>{['home','away'].map(side=>{const r=roster[side];return <div className="amd-readiness" key={side}><strong>{r.name}</strong><p>การสมัคร: {label(r.registration_status)||'ยังไม่มีข้อมูล'}</p><p>นักกีฬา {r.players.length} คน · เจ้าหน้าที่ {r.staff.length} คน</p><p>{r.roster_locked_at?`ล็อกรายชื่อเมื่อ ${date(r.roster_locked_at)}`:'ยังไม่มีเวลาล็อกรายชื่อ'}</p><p>{data.lineups.some(l=>String(l.team_id)===String(r.team_id))?'มีไลน์อัปที่บันทึกแล้ว':'ยังไม่มีไลน์อัปที่บันทึก'}</p>{r.has_sync_error&&<p className="amd-warning">มีปัญหาการซิงค์รายชื่อ กรุณาตรวจสอบ</p>}{!r.players.length&&<p className="amd-warning">ยังไม่มีรายชื่อนักกีฬา</p>}</div>;})}<p className="amd-note">ข้อมูลในส่วนนี้ใช้ตรวจสอบความพร้อม ไม่ใช่การรับรองว่าผ่านกติกาครบทุกข้อ</p></section></div>
                    <section className="amd-panel"><h2>ผู้ตัดสินและผู้บันทึก</h2><Table headers={['หน้าที่','ชื่อ–นามสกุล','ความพร้อม']}>{(data.officials||[]).map(o=><tr key={o.role}><td>{o.role}</td><td>{o.name||'ยังไม่ระบุ'}</td><td>{o.name?'กำหนดแล้ว':'ยังไม่กำหนด'}</td></tr>)}</Table></section>
                    <section className="amd-panel"><h2>สถานะงานและการเผยแพร่</h2><div className="amd-review-summary">{['score','vims'].map(domain=><article key={domain}><span>{domainLabel(domain)}</span><strong>{label(data.latest[domain]?.status)}</strong><small>{data.latest[domain]?`ฉบับ ${data.latest[domain].revision}`:'ยังไม่มีฉบับส่งตรวจ'}</small></article>)}<article><span>การเผยแพร่</span><strong>{data.publication.published?'เปิดดูได้':'ยังไม่เผยแพร่'}</strong><small>{data.publication.kind==='official'?'แมตช์ทางการเปิดอ่านตามรูปแบบเดิม':'แมตช์ส่วนตัวที่ผูกรายการแล้ว'}</small></article></div><p className="amd-note">สถิติ VIMS {data.statisticCount} เหตุการณ์ · สถานะแข่งขันและสถานะตรวจรับแยกจากกัน</p></section>
                </>}
                {tab==='roster'&&<><div className="amd-roster-grid">{['home','away'].map(side=>{const r=roster[side];return <section className="amd-panel" key={side}><h2>{r.name}</h2><p className="amd-note">{r.source==='match_snapshot'?`รายชื่อประจำแมตช์ · การตั้งค่าฉบับ ${r.setup_revision}`:`รายชื่อลงทะเบียน · Entry ${r.entry_id||'—'}`} · {r.players.length} คน</p>
                    <Table headers={['หมายเลข','ชื่อ–นามสกุล','หน้าที่']} empty={!r.players.length&&'ยังไม่มีรายชื่อสำหรับแมตช์นี้'}>{r.players.map((p,i)=><tr key={p.id||i}><td><strong>{p.number||'—'}</strong></td><td>{person(p)}</td><td>{[Number(p.is_captain)===1&&'C',Number(p.is_libero1)===1&&'L1',Number(p.is_libero2)===1&&'L2'].filter(Boolean).join(' / ')||p.role||p.position||'—'}</td></tr>)}</Table>
                    <h3>เจ้าหน้าที่ทีม</h3><p className="amd-note">แหล่งข้อมูล: {{entry:'รายชื่อประจำรายการ',team:'ทะเบียนทีม',match_snapshot:'ข้อมูลประจำแมตช์',none:'ไม่มีข้อมูล'}[r.staff_source]}</p><Table headers={['ชื่อ–นามสกุล','ตำแหน่ง']} empty={!r.staff.length&&'ยังไม่มีข้อมูลเจ้าหน้าที่'}>{r.staff.map((p,i)=><tr key={p.id||i}><td>{person(p)}</td><td>{p.role}</td></tr>)}</Table>
                </section>;})}</div><section className="amd-panel"><h2>ไลน์อัปที่บันทึก</h2><Table headers={['เซต','ทีม','ตำแหน่ง P1–P6','ลิเบอโร']} empty={!data.lineups.length&&'ยังไม่มีไลน์อัป'}>{data.lineups.map((l,i)=><tr key={i}><td>{l.set_number}</td><td>{team(l.team_id)}</td><td>{[1,2,3,4,5,6].map(n=>{const p=player(l[`player_id_p${n}`]);return p?`#${p.number}`:'—';}).join(' · ')}</td><td>{playerLabel(l.libero_id)}</td></tr>)}</Table></section></>}
                {tab==='score'&&<>
                    {data.correction.reviewRevision&&<p className="amd-notice">มีการแก้ไขย้อนหลังสำหรับฉบับ {data.correction.reviewRevision} · {date(data.correction.correctedAt)}{data.correction.signaturesRetained?' · คงลายเซ็นเดิมพร้อมระบุว่ามีการแก้ไข':''}</p>}
                    <section className="amd-panel"><h2>คะแนนรายเซต</h2>{match.status==='scheduled'&&<p className="amd-note">ยังไม่มีผลการแข่งขัน</p>}<Table headers={['เซต',roster.home.name,roster.away.name,'เริ่ม','จบ']} empty={!data.sets.length&&'ยังไม่มีข้อมูลเซต'}>{data.sets.map(s=><tr key={s.id}><td>{s.set_number}</td><td>{s.home_score}</td><td>{s.away_score}</td><td>{date(s.start_time)}</td><td>{date(s.end_time)}</td></tr>)}</Table></section>
                    <section className="amd-panel"><h2>ใบบันทึกและเอกสาร</h2><p>คะแนนฉบับปัจจุบัน: {data.latest.score?`${data.latest.score.revision} · ${label(data.latest.score.status)}`:'ยังไม่ส่งตรวจ'}</p><p className="amd-note">เอกสารเปิดจากข้อมูลปัจจุบัน ไม่ใช่สำเนาเอกสารของฉบับเก่า ตรวจเลขฉบับและสถานะก่อนนำไปใช้งาน</p><div className="amd-document-links"><PublicAnchor href={`/scoresheet/${match.id}`} target="_blank" rel="noreferrer">เปิดใบบันทึกคะแนน</PublicAnchor><PublicAnchor href={`/roster-verification/${match.id}`} target="_blank" rel="noreferrer">เปิดใบตรวจรายชื่อ</PublicAnchor></div></section>
                    {!organizer&&<section className="amd-panel"><h2>ลำดับเหตุการณ์คะแนน</h2><p className="amd-note">เรียงจากล่าสุด · {data.eventTotal} เหตุการณ์</p><Table headers={['เซต','เหตุการณ์','ทีม / นักกีฬา','คะแนน','เวลา']} empty={!data.events.length&&'ยังไม่มีเหตุการณ์บันทึก'}>{data.events.map(e=><tr key={e.id}><td>{e.set_number||'—'}</td><td>{eventLabels[e.event_type]||eventLabels[e.skill]||e.event_type||e.skill||'—'}{Object.keys(e.details).length>0&&<small>{Object.entries(e.details).map(([k,v])=>`${k}: ${String(v)}`).join(' · ')}</small>}</td><td>{team(e.team_id)}<small>{playerLabel(e.player_id)}</small></td><td>{e.score_home??'—'} – {e.score_away??'—'}</td><td>{date(e.created_at)}</td></tr>)}</Table>
                        {data.eventTotal>100&&<div className="amd-pagination"><GuardedButton disabled={eventPage<=1||busy} onClick={()=>setParams({tab:'score',page:String(eventPage-1)})}>ก่อนหน้า</GuardedButton><span>หน้า {eventPage} / {Math.ceil(data.eventTotal/100)}</span><GuardedButton disabled={eventPage*100>=data.eventTotal||busy} onClick={()=>setParams({tab:'score',page:String(eventPage+1)})}>ถัดไป</GuardedButton></div>}
                    </section>}{data.statistics.length>0&&<section className="amd-panel"><h2>สถิติ VIMS</h2><p className="amd-note">แสดง {data.statistics.length} / {data.statisticCount} เหตุการณ์ล่าสุด</p><Table headers={['เซต','ทีม','นักกีฬา','ทักษะ','ผล']}>{data.statistics.map(s=><tr key={s.id}><td>{s.set_number}</td><td>{team(s.team_id)}</td><td>{playerLabel(s.player_id)}</td><td>{s.skill}</td><td>{s.grade}</td></tr>)}</Table></section>}
                </>}
                {tab==='history'&&(organizer?<section className="amd-panel"><h2>สถานะการตรวจรับ</h2><p className="amd-note">ติดตามสถานะฉบับล่าสุดแบบอ่านอย่างเดียว การตรวจรับคะแนนและสถิติดำเนินการโดยผู้ดูแลส่วนงาน</p><Table headers={['ส่วนงาน','ฉบับล่าสุด','สถานะ','ส่งตรวจเมื่อ','ตรวจเมื่อ']}>{['score','vims'].map(domain=>{const r=data.latest[domain];return <tr key={domain}><td>{domainLabel(domain)}</td><td>{r?.revision||'—'}</td><td><span className="aw-status">{label(r?.status)}</span></td><td>{date(r?.submitted_at)}</td><td>{date(r?.decided_at)}</td></tr>;})}</Table><p className="amd-note">สถานะตรวจรับแยกจากสถานะการแข่งขัน แมตช์ทางการยังเปิดอ่านตามรูปแบบเดิม</p></section>:<>
                    <section className="amd-panel"><h2>ตรวจรับฉบับล่าสุด</h2><p className="amd-note">ดำเนินการได้ตามส่วนงาน เฉพาะฉบับล่าสุด และไม่ตรวจรับงานที่ตนส่ง</p>
                        {Object.values(data.latest).some(r=>r.actions.some(a=>['return','reopen'].includes(a)))&&<label className="amd-reason">เหตุผลส่งกลับหรือเปิดแก้<textarea maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label>}
                        <Table headers={['ส่วนงาน / ฉบับ','สถานะ','ผู้ส่ง / เวลา','ผู้ตรวจ / เหตุผล','การดำเนินการ']} empty={!data.reviews.length&&'ยังไม่มีงานส่งตรวจ'}>{Object.values(data.latest).map(r=><tr key={r.id}><td>{domainLabel(r.domain)} · {r.revision}</td><td><span className="aw-status">{label(r.status)}</span></td><td>{r.submitted_username}<small>{date(r.submitted_at)}</small></td><td>{r.decided_username||'—'}<small>{date(r.decided_at)}</small>{r.reason&&<p>{r.reason}</p>}</td><td><div className="amd-actions">{r.actions.length?r.actions.map(a=><GuardedButton key={a} disabled={busy||(['return','reopen'].includes(a)&&!reason.trim())} onClick={()=>action(r.domain,a)}>{a==='publish'?(data.publication.published?'หยุดเผยแพร่':'เผยแพร่'):({confirm:'ยืนยัน',return:'ส่งกลับ',reopen:'เปิดแก้'}[a])}</GuardedButton>):'อ่านอย่างเดียว'}</div></td></tr>)}</Table>
                    </section><section className="amd-panel"><h2>ประวัติทุกฉบับ</h2><Table headers={['ส่วนงาน','ฉบับ','สถานะ','ผู้ส่ง','ส่งเมื่อ','ผู้ตรวจ / เหตุผล']} empty={!data.reviews.length&&'ยังไม่มีประวัติการส่งตรวจ'}>{data.reviews.map(r=><tr key={r.id}><td>{domainLabel(r.domain)}</td><td>{r.revision}</td><td>{label(r.status)}</td><td>{r.submitted_username}</td><td>{date(r.submitted_at)}</td><td>{r.decided_username||'—'}<small>{date(r.decided_at)}</small>{r.reason}</td></tr>)}</Table></section>
                    <section className="amd-panel"><h2>ประวัติการดำเนินการ</h2><p className="amd-note">แสดงสูงสุด {data.historyLimit} รายการล่าสุด · ไม่รวมข้อมูลรับรองตัวตนหรือข้อมูลส่วนตัว</p><Table headers={['เวลา','การดำเนินการ','ผู้ดำเนินการ','ฉบับ / เหตุผล']} empty={!data.history.length&&'ยังไม่มีประวัติการดำเนินการ'}>{data.history.map(a=><tr key={a.id}><td>{date(a.created_at)}</td><td>{a.action}</td><td>{a.username||'—'}</td><td>{a.revision||'—'}{a.reason&&<small>{a.reason}</small>}</td></tr>)}</Table></section>
                </>)}
            </>}
            {!loading&&!data&&<GuardedButton className="amd-refresh" onClick={()=>navigate(`${home}?view=matches`)}>กลับรายการแมตช์</GuardedButton>}
        </div>
    </AdminWorkspaceShell>;
}
