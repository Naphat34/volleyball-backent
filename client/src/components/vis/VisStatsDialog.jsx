import { useEffect, useRef } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { buildMatchStats, downloadMatchStatsCsv, detailCells } from '../../utils/vis/visStatsCsv';
import './VisStatsDialog.css';

export default function VisStatsDialog({ match, teams, events = [], onClose, onPDF }) {
    const closeButton = useRef(null);
    const stats = buildMatchStats(match, teams, events);
    useEffect(() => {
        const previous = document.activeElement;
        closeButton.current?.focus();
        return () => previous?.focus?.();
    }, []);
    const handleKeys = event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const items = [...event.currentTarget.querySelectorAll('button, [tabindex="0"]')];
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    return <div className="vis-stats-overlay" onKeyDown={handleKeys}>
        <section role="dialog" aria-modal="true" aria-labelledby="vis-stats-title" className="vis-stats-modal">
            <header className="vis-stats-header"><div><h2 id="vis-stats-title">สถิติทั้งแมตช์ VIS</h2><p>{match.home_team} – {match.away_team}</p></div><div className="vis-stats-actions"><button className="vis-stats-export" onClick={() => downloadMatchStatsCsv(match, stats)}><Download size={16} />ส่งออก CSV</button>{onPDF && <button onClick={onPDF}><FileText size={16} />รายงาน PDF</button>}<button ref={closeButton} onClick={onClose} aria-label="ปิดสถิติ"><X size={18} /></button></div></header>
            <div className="vis-stats-body">
                {stats.map(team => <section className="vis-stats-team" key={team.key}>
                    <h3><span className="vis-stats-team-name">{team.name}<small>{match[`${team.key}_team_name_en`] || ''}</small></span><span className="vis-stats-source">แต้มจาก: ตบ {team.total.attack[1]} · บล็อก {team.total.block[0]} · เสิร์ฟ {team.total.serve[1]} · คู่แข่งเสีย {team.opponentErrors}</span></h3>
                    <div className="vis-stats-table-scroll" tabIndex={0} role="region" aria-label={`สถิติรายบุคคล ${team.name}`}><table><thead><tr><th scope="col">No</th><th scope="col">ชื่อ</th>{['Pts', 'ตบ T/K/E/B', 'Eff', 'บล็อก P/E', 'เสิร์ฟ T/A/E', 'รับ T/#/E', 'Pos%', 'ดิก T/E', 'เซ็ต T/E'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
                        {team.players.map(({ player, detail }) => <tr key={player.id}><td>{player.number}</td><th scope="row">{player.name_th || player.name || [player.first_name, player.last_name].filter(Boolean).join(' ')}<small className="vis-stats-player-en">{player.name_en || [player.first_name_en, player.last_name_en].filter(Boolean).join(' ')}</small></th>{detailCells(detail).map((value, index) => <td className={index === 0 ? 'vis-stats-points' : ''} key={index}>{value}</td>)}</tr>)}
                        {!team.players.length && <tr><td colSpan={11} className="vis-stats-empty">ยังไม่มีรายชื่อผู้เล่น</td></tr>}
                    </tbody><tfoot><tr><td /><th scope="row">รวม</th>{detailCells(team.total).map((value, index) => <td key={index}>{value}</td>)}</tr></tfoot></table></div>
                </section>)}
            </div>
            <footer className="vis-stats-footer">T = ทั้งหมด · K/P/A = ได้แต้ม · E = ผิดพลาด · B = ตบติดบล็อก · # = รับสมบูรณ์ · Eff = (ตบได้แต้ม − ผิดพลาด − ติดบล็อก) / ตบทั้งหมด · Pos% = รับเกรด # และ + / รับทั้งหมด · – = ไม่มีความพยายาม · CSV รวมรายบุคคลและยอดรวมทั้งสองทีม</footer>
        </section>
    </div>;
}
