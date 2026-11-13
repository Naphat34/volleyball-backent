import { GuardedButton } from '../ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useLanguage } from '../../context/LanguageContext';
import useVisTranslation from './useVisTranslation';
import { useEffect, useRef } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { buildMatchStats, downloadMatchStatsCsv, detailCells } from '../../utils/vis/visStatsCsv';
import './VisStatsDialog.css';

export default function VisStatsDialog({ match, teams, events = [], onClose, onPDF }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const { language } = useLanguage();
    const teamName = key => match[key + (language === 'ENG' ? '_team_name_en' : '_team_name_th')] || match[key + '_team'];
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
            <header className="vis-stats-header"><div><h2 id="vis-stats-title">{vt("สถิติทั้งแมตช์ VIMS")}</h2><p>{teamName('home')} – {teamName('away')}</p></div><div className="vis-stats-actions"><GuardedButton className="vis-stats-export" onClick={() => downloadMatchStatsCsv(match, stats)}><Download size={16} />{vt("ส่งออก CSV")}</GuardedButton>{onPDF && <GuardedButton onClick={onPDF}><FileText size={16} />{vt("รายงาน PDF")}</GuardedButton>}<GuardedButton ref={closeButton} onClick={onClose} aria-label={vt("ปิดสถิติ")}><X size={18} /></GuardedButton></div></header>
            <div className="vis-stats-body">
                {stats.map(team => <section className="vis-stats-team" key={team.key}>
                    <h3><span className="vis-stats-team-name">{teamName(team.key)}<small>{match[`${team.key}_team_name_en`] || ''}</small></span><span className="vis-stats-source">{vt("แต้มจาก: ตบ ")}{team.total.attack[1]}{vt(" · บล็อก ")}{team.total.block[0]}{vt(" · เสิร์ฟ ")}{team.total.serve[1]}{vt(" · คู่แข่งเสีย ")}{team.opponentErrors}</span></h3>
                    <div className="vis-stats-table-scroll" tabIndex={0} role="region" aria-label={`${vt("สถิติรายบุคคล ")}${displayNames.teamName(team)}`}><table><thead><tr><th scope="col">{ui("No")}</th><th scope="col">{vt("ชื่อ")}</th>{['Pts', vt('ตบ T/K/E/B'), 'Eff', vt('บล็อก P/E'), vt('เสิร์ฟ T/A/E'), vt('รับ T/#/E'), 'Pos%', vt('ดิก T/E'), vt('เซ็ต T/E')].map(label => <th scope="col" key={label}>{ui(label)}</th>)}</tr></thead><tbody>
                        {team.players.map(({ player, detail }) => <tr key={player.id}><td>{player.number}</td><th scope="row">{player.name_th || displayNames.personName(player) || [displayNames.personFirstName(player), displayNames.personLastName(player)].filter(Boolean).join(' ')}<small className="vis-stats-player-en">{player.name_en || [player.first_name_en, player.last_name_en].filter(Boolean).join(' ')}</small></th>{detailCells(detail).map((value, index) => <td className={index === 0 ? 'vis-stats-points' : ''} key={index}>{value}</td>)}</tr>)}
                        {!team.players.length && <tr><td colSpan={11} className="vis-stats-empty">{vt("ยังไม่มีรายชื่อผู้เล่น")}</td></tr>}
                    </tbody><tfoot><tr><td /><th scope="row">{vt("รวม")}</th>{detailCells(team.total).map((value, index) => <td key={index}>{value}</td>)}</tr></tfoot></table></div>
                </section>)}
            </div>
            <footer className="vis-stats-footer">{vt("T = ทั้งหมด · K/P/A = ได้แต้ม · E = ผิดพลาด · B = ตบติดบล็อก · # = รับสมบูรณ์ · Eff = (ตบได้แต้ม − ผิดพลาด − ติดบล็อก) / ตบทั้งหมด · Pos% = รับเกรด # และ + / รับทั้งหมด · – = ไม่มีความพยายาม · CSV รวมรายบุคคลและยอดรวมทั้งสองทีม")}</footer>
        </section>
    </div>;
}
