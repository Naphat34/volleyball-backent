import useDisplayNames from '../../hooks/useDisplayNames';
import useAccessTranslation from '../../hooks/useAccessTranslation';
import { latestReviews, workspaceSummary, competitionInScope } from '../../utils/adminWorkspace';
import { GuardedButton } from '../ui/GuardedAction';

export default function WorkspaceOverview({ reviews,matches,users,scope,loaded,onView,domain,system }) {
    const ui=useAccessTranslation();
    const displayNames=useDisplayNames();
    const statuses={submitted:ui("รอตรวจรับ"),confirmed:ui("ยืนยันแล้ว"),returned:ui("ส่งกลับแก้ไข"),reopened:ui("เปิดแก้ไข")};
    const summary=workspaceSummary(reviews,matches,users,scope);
    const waiting=latestReviews(reviews).filter(r=>competitionInScope(scope,r.competition_id)&&r.status==='submitted');
    const cards=[[ui("งานรอตรวจรับ"),summary.submitted,ui("นับเฉพาะฉบับล่าสุด")],[ui("แมตช์ในขอบเขต"),summary.matches,ui("รายการแข่งขันที่ได้รับสิทธิ์")],[ui("ยืนยันแล้ว"),summary.confirmed,ui("ผลตรวจรับฉบับล่าสุด")],[system?ui("บัญชีในขอบเขต"):ui("ผู้บันทึกในขอบเขต"),summary.users,ui("บัญชีที่มองเห็นในพื้นที่นี้")]];
    return <div aria-busy={!loaded}>
        <div className="aw-metrics">{cards.map(([label,value,note])=><article key={label}><p>{label}</p><strong>{loaded?value:'—'}</strong><small>{note}</small></article>)}</div>
        <div className="aw-overview-grid"><div className="aw-overview-panel"><div className="aw-detail-header"><h2>{ui("คิวงานที่ต้องติดตาม")}</h2><GuardedButton disabled={!loaded} onClick={()=>onView('reviews')}>{ui("ดูคิวทั้งหมด →")}</GuardedButton></div>
            {!loaded?<p className="aw-empty">{ui("กำลังโหลดงานในขอบเขตของคุณ…")}</p>:!waiting.length?<p className="aw-empty">{ui("ยังไม่มีงานรอตรวจรับในขอบเขตนี้")}<br/>{ui("งานจะปรากฏเมื่อผู้บันทึกส่งตรวจฉบับใหม่")}</p>:waiting.slice(0,5).map(row=><div className="aw-queue-row" key={row.id}><div><strong>{ui("แมตช์")} {row.match_id||row.custom_match_id}</strong><small>{displayNames.competitionName(row)} · {row.domain==='score'?ui("คะแนน"):'VIMS'} {ui("· ฉบับ")} {row.revision}</small></div><span className="aw-status">{statuses[row.status]}</span></div>)}
        </div><div className="aw-overview-panel"><h2>{ui("ขั้นตอนการทำงาน")}</h2><p>{system?ui("ดูแลระบบกลางและมอบสิทธิ์ให้ผู้ดูแลแต่ละส่วน"):ui("ดูแล{0}เฉพาะรายการที่ได้รับสิทธิ์",[domain==='score'?ui("คะแนน"):ui("สถิติ VIMS")])}</p><ol className="aw-process">
            {(system?[ui("เตรียมข้อมูลกลางและรายการแข่งขัน"),ui("สร้างผู้ดูแล Scorer / VIMS แล้วมอบสิทธิ์รายการ"),ui("ติดตามภาพรวมและประวัติการตรวจรับ")]:[ui("มอบสิทธิ์รายการให้ผู้บันทึกในส่วนงาน"),ui("ตรวจข้อมูลฉบับที่ผู้บันทึกส่งเข้าคิว"),ui("ยืนยันผล หรือส่งกลับพร้อมเหตุผล")]).map(step=><li key={step}>{step}</li>)}
        </ol><p className="mt-5">{ui("ผู้ดูแลไม่มีสิทธิ์บันทึกคะแนนหรือสถิติ")}</p></div></div>
    </div>;
}
