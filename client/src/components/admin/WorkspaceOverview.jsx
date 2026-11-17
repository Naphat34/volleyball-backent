import { latestReviews, workspaceSummary, competitionInScope } from '../../utils/adminWorkspace';
import { GuardedButton } from '../ui/GuardedAction';

const statuses={submitted:'รอตรวจรับ',confirmed:'ยืนยันแล้ว',returned:'ส่งกลับแก้ไข',reopened:'เปิดแก้ไข'};
export default function WorkspaceOverview({ reviews,matches,users,scope,loaded,onView,domain,system }) {
    const summary=workspaceSummary(reviews,matches,users,scope);
    const waiting=latestReviews(reviews).filter(r=>competitionInScope(scope,r.competition_id)&&r.status==='submitted');
    const cards=[['งานรอตรวจรับ',summary.submitted,'นับเฉพาะฉบับล่าสุด'],['แมตช์ในขอบเขต',summary.matches,'รายการแข่งขันที่ได้รับสิทธิ์'],['ยืนยันแล้ว',summary.confirmed,'ผลตรวจรับฉบับล่าสุด'],[system?'บัญชีในขอบเขต':'ผู้บันทึกในขอบเขต',summary.users,'บัญชีที่มองเห็นในพื้นที่นี้']];
    return <div aria-busy={!loaded}>
        <div className="aw-metrics">{cards.map(([label,value,note])=><article key={label}><p>{label}</p><strong>{loaded?value:'—'}</strong><small>{note}</small></article>)}</div>
        <div className="aw-overview-grid"><div className="aw-overview-panel"><div className="aw-detail-header"><h2>คิวงานที่ต้องติดตาม</h2><GuardedButton disabled={!loaded} onClick={()=>onView('reviews')}>ดูคิวทั้งหมด →</GuardedButton></div>
            {!loaded?<p className="aw-empty">กำลังโหลดงานในขอบเขตของคุณ…</p>:!waiting.length?<p className="aw-empty">ยังไม่มีงานรอตรวจรับในขอบเขตนี้<br/>งานจะปรากฏเมื่อผู้บันทึกส่งตรวจฉบับใหม่</p>:waiting.slice(0,5).map(row=><div className="aw-queue-row" key={row.id}><div><strong>แมตช์ {row.match_id||row.custom_match_id}</strong><small>{row.competition_name} · {row.domain==='score'?'คะแนน':'VIMS'} · ฉบับ {row.revision}</small></div><span className="aw-status">{statuses[row.status]}</span></div>)}
        </div><div className="aw-overview-panel"><h2>ขั้นตอนการทำงาน</h2><p>{system?'ดูแลระบบกลางและมอบสิทธิ์ให้ผู้ดูแลแต่ละส่วน':`ดูแล${domain==='score'?'คะแนน':'สถิติ VIMS'}เฉพาะรายการที่ได้รับสิทธิ์`}</p><ol className="aw-process">
            {(system?['เตรียมข้อมูลกลางและรายการแข่งขัน','สร้างผู้ดูแล Scorer / VIMS แล้วมอบสิทธิ์รายการ','ติดตามภาพรวมและประวัติการตรวจรับ']:['มอบสิทธิ์รายการให้ผู้บันทึกในส่วนงาน','ตรวจข้อมูลฉบับที่ผู้บันทึกส่งเข้าคิว','ยืนยันผล หรือส่งกลับพร้อมเหตุผล']).map(step=><li key={step}>{step}</li>)}
        </ol><p className="mt-5">ผู้ดูแลไม่มีสิทธิ์บันทึกคะแนนหรือสถิติ</p></div></div>
    </div>;
}
