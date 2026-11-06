import { Link } from 'react-router-dom';
import MatchDashboardScore from './MatchDashboardScore';
import { dashboardMatchStatus, dashboardMatchStatusLabel, visStatusLabel } from '../../utils/vis/dashboardStatus';

export default function VisMatchTable({ group, th, sortHeader, sortState, date, busy, onSettings, onStats, onPDF, onExport }) {
    const columns = [['number', '#'], ['date', th ? 'วันที่' : 'Date'], ['time', th ? 'เวลา' : 'Time'], ['match', th ? 'แมตช์' : 'Match'], ['competition', th ? 'รอบ / สนาม' : 'Round / venue'], ['score', th ? 'ผล' : 'Result'], ['status', th ? 'สถานะ' : 'Status'], ['updated', th ? 'แก้ไขล่าสุด' : 'Updated']];
    return <section className="vd-competition-group" aria-label={group.title}>
        <header className="vd-group-heading"><h2>{group.title}</h2><span className="vd-group-count">{group.total} {th ? 'แมตช์' : 'matches'}</span></header>
        <div className="vd-table-scroll" tabIndex={0} role="region" aria-label={th ? 'ตารางแมตช์ เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด' : 'Match table. Scroll horizontally for all columns.'}>
            <table className="vd-table">
                <colgroup>{['number', 'date', 'time', 'match', 'venue', 'score', 'status', 'updated', 'actions'].map(name => <col key={name} className={`vd-col-${name}`} />)}</colgroup>
                <thead><tr>{columns.map(([field, label]) => <th key={field} scope="col" aria-sort={sortState(field)}>{sortHeader(field, label)}</th>)}<th scope="col" className="vd-actions-heading">{th ? 'การจัดการ' : 'Actions'}</th></tr></thead>
                <tbody>{group.matches.map(match => {
                    const m = match;
                    const matchStatus = dashboardMatchStatus(m);
                    const gender = ['male', 'men', 'M'].includes(m.gender) ? (th ? 'ชาย' : 'Men') : ['female', 'women', 'F'].includes(m.gender) ? (th ? 'หญิง' : 'Women') : m.gender;
                    return <tr key={m.id}>
                        <td className="vd-number"><span>{m.match_number || '—'}</span></td>
                        <td className="vd-date">{m.match_date ? String(m.match_date).slice(0, 10) : '—'}</td>
                        <td className="vd-time">{m.start_time ? String(m.start_time).slice(0, 5) : '—'}</td>
                        <td className="vd-match"><strong><span>{m.home_team || 'TBA'}</span> <i>vs</i> <span>{m.away_team || 'TBA'}</span></strong>
                            {(m.home_team_name_en || m.away_team_name_en) && <small>{m.home_team_name_en || m.home_team || 'TBA'} vs {m.away_team_name_en || m.away_team || 'TBA'}</small>}
                            <small>{[m.age_group_name || m.category, m.round_name, m.pool_name && (th ? 'สาย ' : 'Pool ') + m.pool_name].filter(Boolean).join(' · ') || 'VIS'} · <span className="vd-match-id" title={String(m.id)}>{m.id}</span></small>
                        </td>
                        <td className="vd-competition"><span>{[gender, m.round_name, m.pool_name && 'Pool ' + m.pool_name].filter(Boolean).join(' · ') || '—'}</span><small>{m.location || '—'}</small></td>
                        <td className="vd-score"><MatchDashboardScore match={m} th={th} /></td>
                        <td><div className="vd-badges"><span className={`vd-badge vd-${matchStatus}`} title={`VIS · ${visStatusLabel(m, th)}`}>{dashboardMatchStatusLabel(m, th)}</span>
                            <span className="vd-badge vd-source">{m.is_offline_vis ? 'Offline' : m.is_custom_vis ? m.published ? (th ? 'เผยแพร่แล้ว' : 'Published') : (th ? 'สร้างเอง' : 'Custom') : (th ? 'จากเซิร์ฟเวอร์' : 'Server')}</span>
                        </div></td>
                        <td className="vd-updated">{date(m.updated_at || m.created_at)}</td>
                        <td><div className="vd-row-actions"><div className="vd-row-main">
                            {matchStatus !== 'cancelled' && m.home_team_id && m.away_team_id && <Link className="vd-primary" to={`/adminvis/match/${m.id}`}>{matchStatus === 'completed' ? (th ? 'ตรวจสอบสถิติ' : 'Review') : (th ? 'บันทึกสถิติ' : 'Record')}</Link>}
                            <button disabled={busy} onClick={() => onSettings(m)}>{th ? 'ตั้งค่าแมตช์' : 'Settings'}</button>
                        </div><div className="vd-row-secondary"><button disabled={busy} onClick={() => onStats(m)}>{th ? 'สถิติ' : 'Stats'}</button><button disabled={busy} onClick={() => onPDF(m)} title={th ? 'ใบบันทึกผลการแข่งขัน P-2' : 'Match result P-2'}>P-2</button>
                            <details className="vd-row-menu"><summary aria-label={`${th ? 'เมนูแมตช์' : 'Match menu'} ${m.match_number || m.id}`}>⋯</summary><div>
                                <button disabled={busy} onClick={() => onExport(m)}>{th ? 'ส่งออก JSON' : 'Export JSON'}</button>
                                {m.is_custom_vis && <button disabled={busy} onClick={() => onSettings(m)}>{th ? 'จัดการ / เผยแพร่' : 'Manage / publish'}</button>}
                                {m.published && <a href={`/vis-live/${m.public_token}`} target="_blank" rel="noreferrer">Livescore ↗</a>}
                            </div></details>
                        </div></div></td>
                    </tr>;
                })}</tbody>
            </table>
        </div>
    </section>;
}
