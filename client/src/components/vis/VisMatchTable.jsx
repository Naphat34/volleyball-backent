import { GuardedButton } from '../ui/GuardedAction';
import { ArrowUpRight as UiArrowUpRight } from 'lucide-react';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { Link } from 'react-router-dom';
import MatchDashboardScore from './MatchDashboardScore';
import ScorerActionDropdown from '../scorer/ScorerActionDropdown';
import { dashboardMatchStatus, dashboardMatchStatusLabel, visStatusLabel } from '../../utils/vis/dashboardStatus';

export default function VisMatchTable({ group, th, user, onClaim, onRelease, sortHeader, sortState, date, busy, onSettings, onStats, onPDF, onExport }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const columns = [['number', '#'], ['date', th ? 'วันที่' : 'Date'], ['time', th ? 'เวลา' : 'Time'], ['match', th ? 'แมตช์' : 'Match'], ['competition', th ? 'รอบ / สนาม' : 'Round / venue'], ['score', th ? 'ผล' : 'Result'], ['status', th ? 'สถานะ' : 'Status'], ['updated', th ? 'แก้ไขล่าสุด' : 'Updated']];
    return <section className="vd-competition-group" aria-label={group.title}>
        <header className="vd-group-heading"><h2>{group.title}</h2><span className="vd-group-count">{group.total} {th ? ui('แมตช์') : ui('matches')}</span></header>
        <div className="vd-table-scroll" tabIndex={0} role="region" aria-label={th ? ui('ตารางแมตช์ เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด') : ui('Match table. Scroll horizontally for all columns.')}>
            <table className="vd-table">
                <colgroup>{['number', 'date', 'time', 'match', 'venue', 'score', 'status', 'updated', 'actions'].map(name => <col key={name} className={`vd-col-${name}`} />)}</colgroup>
                <thead><tr>{columns.map(([field, label]) => <th key={field} scope="col" aria-sort={sortState(field)}>{sortHeader(field, label)}</th>)}<th scope="col" className="vd-actions-heading">{th ? ui('การจัดการ') : ui('Actions')}</th></tr></thead>
                <tbody>{group.matches.map(match => {
                    const m = match;
                    const manual = Boolean(m.manual_owner_id);
                    const assignedToMe = String(m.manual_vis_assignee_id) === String(user?.id);
                    const resultMismatch = manual && m.status === 'completed' && ['review', 'confirmed'].includes(m.vis_summary?.status)
                        && ['home', 'away'].some(side => Number(m.vis_summary.setsWon?.[side] || 0) !== Number(m.official_summary?.setsWon?.[side] || 0));
                    const matchStatus = dashboardMatchStatus(m);
                    const gender = ['male', 'men', 'M'].includes(m.gender) ? (th ? 'ชาย' : 'Men') : ['female', 'women', 'F'].includes(m.gender) ? (th ? 'หญิง' : 'Women') : m.gender;
                    return <tr key={m.id}>
                        <td className="vd-number"><span>{m.match_number || '—'}</span></td>
                        <td className="vd-date">{m.match_date ? String(m.match_date).slice(0, 10) : '—'}</td>
                        <td className="vd-time">{m.start_time ? String(m.start_time).slice(0, 5) : '—'}</td>
                        <td className="vd-match"><strong><span>{(displayNames.matchTeamName(m, 'home')) || (ui('TBA'))}</span> <i>{ui("vs")}</i> <span>{(displayNames.matchTeamName(m, 'away')) || (ui('TBA'))}</span></strong>
                            {(m.home_team_name_en || m.away_team_name_en) && <small>{(m.home_team_name_en || displayNames.matchTeamName(m, 'home')) || (ui('TBA'))}{' '}{ui("vs")}{' '}{(m.away_team_name_en || displayNames.matchTeamName(m, 'away')) || (ui('TBA'))}</small>}
                            <small>{([m.age_group_name || m.category, m.round_name, m.pool_name && (th ? 'สาย ' : 'Pool ') + m.pool_name].filter(Boolean).join(' · ')) || (ui('VIMS'))} · <span className="vd-match-id" title={String(m.id)}>{m.id}</span></small>
                        </td>
                        <td className="vd-competition"><span>{[gender, m.round_name, m.pool_name && 'Pool ' + m.pool_name].filter(Boolean).join(' · ') || '—'}</span><small>{m.location || '—'}</small></td>
                        <td className="vd-score"><MatchDashboardScore match={m} th={th} />{resultMismatch && <small role="status" className="vd-error">{th ? 'ผลสถิติกับสกอร์ไม่ตรงกัน กรุณาตรวจสอบ' : 'Statistics and scorer results differ. Please review.'}</small>}</td>
                        <td><div className="vd-badges"><span className={`vd-badge vd-${matchStatus}`} title={ui(`VIMS · {0}`, [visStatusLabel(m, th)])}>{dashboardMatchStatusLabel(m, th)}</span>
                            <span className="vd-badge vd-source">{manual ? (th ? 'สร้างเองโดยสกอร์' : 'Scorer-created') : m.is_offline_vis ? ui('Offline') : m.is_custom_vis ? m.published ? th ? ui('เผยแพร่แล้ว') : ui('Published') : th ? ui('สร้างเอง') : ui('Custom') : th ? ui('จากเซิร์ฟเวอร์') : ui('Server')}</span>
                        </div>{manual && <small>{th ? 'ผู้สร้าง: ' : 'Created by: '}{m.manual_creator || m.manual_owner_id}<br />{th ? 'ผู้รับงาน: ' : 'Statistics: '}{m.manual_vis_assignee || (th ? 'ยังไม่มีผู้รับงาน' : 'Unassigned')}</small>}</td>
                        <td className="vd-updated">{date(m.updated_at || m.created_at)}</td>
                        <td><div className="vd-row-actions"><div className="vd-row-main">{manual && !m.manual_vis_assignee_id && <GuardedButton disabled={busy} onClick={() => onClaim(m)}>{th ? 'รับงานสถิติ' : 'Claim statistics'}</GuardedButton>}{manual && m.manual_vis_assignee_id && (assignedToMe || user?.role === 'admin') && <GuardedButton disabled={busy} onClick={() => onRelease(m)}>{th ? 'คืนงานสถิติ' : 'Release statistics'}</GuardedButton>}
                            {(!manual || assignedToMe) && matchStatus !== 'cancelled' && m.home_team_id && m.away_team_id && <Link className="vd-primary" to={`/adminvis/match/${m.id}`}>{matchStatus === 'completed' ? th ? ui('ตรวจสอบสถิติ') : ui('Review') : th ? ui('บันทึกสถิติ') : ui('Scouting')}</Link>}
                            <GuardedButton disabled={busy || manual} onClick={() => onSettings(m)}>{th ? ui('ตั้งค่าแมตช์') : ui('Settings')}</GuardedButton>
                        </div><div className="vd-row-secondary"><GuardedButton disabled={busy} onClick={() => onStats(m)}>{th ? ui('สถิติ') : ui('Stats')}</GuardedButton><GuardedButton disabled={busy} onClick={() => onPDF(m)} title={th ? ui('ใบบันทึกผลการแข่งขัน P-2') : ui('Match result P-2')}>{ui("P-2")}</GuardedButton>
                            <ScorerActionDropdown label={`${th ? 'เมนูแมตช์' : 'Match menu'} ${m.match_number || m.id}`}>
                                <GuardedButton disabled={busy} onClick={() => onExport(m)}>{th ? ui('ส่งออก JSON') : ui('Export JSON')}</GuardedButton>
                                {m.is_custom_vis && <GuardedButton disabled={busy || manual} onClick={() => onSettings(m)}>{th ? ui('จัดการ / เผยแพร่') : ui('Manage / publish')}</GuardedButton>}
                                {m.published && <a href={`/vis-live/${m.public_token}`} target="_blank" rel="noreferrer"><><UiArrowUpRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" />{ui("Livescore ↗").replace(/↗\uFE0F?/gu, '').trim()}</></a>}
                            </ScorerActionDropdown>
                        </div></div></td>
                    </tr>;
                })}</tbody>
            </table>
        </div>
    </section>;
}
