import { useEffect, useRef, useState } from 'react';
import { describeVisEvent, describeVisGrade, eventDetails, getVisEventCode, visSkillNames } from '../../utils/vis/visPresentation';
import './VisHistoryPanel.css';

export default function VisHistoryPanel({ matchData, actionLog, players, className = '' }) {
    const [descriptions, setDescriptions] = useState(true);
    const [grouped, setGrouped] = useState(true);
    const [chosenSet, setChosenSet] = useState(null);
    const [selected, setSelected] = useState(null);
    const scroll = useRef(null);
    const cards = useRef(new Map());
    const groups = [];
    const byRally = new Map();
    for (const entry of [...actionLog].reverse()) {
        const details = eventDetails(entry);
        const set = Number(entry.set_number || details.visContext?.setNumber || 1);
        const key = grouped && details.rallyId ? `${set}-${details.rallyId}` : `event-${entry.id}`;
        let group = byRally.get(key);
        if (!group) {
            group = { key, set, entries: [] };
            groups.push(group);
            byRally.set(key, group);
        }
        group.entries.push(entry);
        group.score = details.visContext?.scoreAfter || { home: entry.score_home, away: entry.score_away };
        group.winner = details.statisticalRallyWinner || group.winner;
    }
    const sets = [...new Set(groups.map(group => group.set))].sort((a, b) => a - b);
    const activeSet = sets.includes(chosenSet) ? chosenSet : sets.at(-1) || 1;
    const visible = groups.filter(group => group.set === activeSet);
    const names = { home: matchData.home_team, away: matchData.away_team };
    const activeKey = visible.some(group => group.key === selected) ? selected : visible.at(-1)?.key;
    useEffect(() => {
        if (!selected && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
    }, [actionLog.length, activeSet, grouped, selected]);
    const choose = key => {
        setSelected(key);
        cards.current.get(key)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const changeSet = offset => {
        setChosenSet(sets[sets.indexOf(activeSet) + offset]);
        setSelected(null);
    };
    return <aside className={`vis-history ${className}`} aria-label="โค้ดและประวัติ">
        <div className="vis-history-inner">
            <header className="vis-history-header">
                <strong><span className="vis-history-grip">⠿</span> โค้ดและประวัติ</strong>
                <span className="vis-history-count">{actionLog.length} รายการ</span>
                <div className="vis-history-modes" aria-label="รูปแบบประวัติ">
                    <button type="button" aria-pressed={!descriptions} onClick={() => setDescriptions(false)}>CODE</button>
                    <button type="button" aria-pressed={descriptions} onClick={() => setDescriptions(true)}>+ คำอธิบาย</button>
                </div>
                <label><input type="checkbox" checked={grouped} onChange={event => { setGrouped(event.target.checked); setSelected(null); }} /> รวมตามแรลลี่</label>
            </header>
            <div className="vis-history-body">
                <nav className="vis-history-rail" aria-label="คะแนนแต่ละแรลลี่">
                    <div className="vis-history-set"><button type="button" aria-label="เซตก่อนหน้า" disabled={sets.indexOf(activeSet) <= 0} onClick={() => changeSet(-1)}>‹</button><b>Set {activeSet}</b><button type="button" aria-label="เซตถัดไป" disabled={sets.indexOf(activeSet) >= sets.length - 1} onClick={() => changeSet(1)}>›</button></div>
                    <div className="vis-history-teamheads"><span title={names.home}>{names.home}</span><span title={names.away}>{names.away}</span></div>
                    {visible.map((group, index) => <button type="button" key={group.key} className={`vis-history-scorelink ${group.winner || 'neutral'} ${activeKey === group.key ? 'selected' : ''}`} onClick={() => choose(group.key)} aria-label={`รายการ ${index + 1} คะแนน ${group.score.home ?? '—'} ต่อ ${group.score.away ?? '—'}`} aria-current={activeKey === group.key ? 'true' : undefined}><span>{group.score.home ?? '—'}</span><span>{group.score.away ?? '—'}</span></button>)}
                </nav>
                <div className="vis-history-scroll" ref={scroll}>
                    {!visible.length && <p className="vis-history-empty">ยังไม่มีรายการที่บันทึก</p>}
                    <ol className="vis-history-list">{visible.map((group, index) => <li key={group.key} ref={node => { if (node) cards.current.set(group.key, node); else cards.current.delete(group.key); }} className={`vis-history-card ${group.winner || 'neutral'} ${activeKey === group.key ? 'selected' : ''}`}>
                        <div className="vis-history-events">{group.entries.map(entry => {
                            const team = entry.team_id == null ? 'neutral' : String(entry.team_id) === String(matchData.home_team_id) ? 'home' : 'away';
                            const details = eventDetails(entry);
                            const player = players.find(item => Number(item.id) === Number(entry.player_id));
                            const grade = details.rawGrade ?? entry.grade;
                            const scoring = ['S', 'A', 'B', 'OP'].includes(entry.skill) && grade === '#';
                            const error = ['=', '/'].includes(grade);
                            const description = visSkillNames[entry.skill]
                                ? `${details.jersey_number != null || player ? `#${details.jersey_number ?? player.number} ${player?.name || [player?.first_name, player?.last_name].filter(Boolean).join(' ')}` : ''} ${visSkillNames[entry.skill]}${grade ? ` → ${describeVisGrade(entry.skill, grade).label}` : ''}`
                                : describeVisEvent(entry, players);
                            return <div key={entry.id} className={`vis-history-event ${team}`}>
                                <div className="vis-history-eventline"><code>{getVisEventCode(entry, players) || entry.skill}</code>{descriptions && <span>{description}</span>}{descriptions && (scoring || error) && <small className={scoring ? 'positive' : 'negative'}>{scoring ? '● +' : '● −'} {names[team]}</small>}</div>
                                {entry.referenceNeedsReview && <div className="vis-history-warning">⚠ รายการนี้ถูกแก้ไขใน eScoreControl · กรุณาตรวจสอบสถิติ</div>}
                                {descriptions && details.playerOut && <div className="vis-history-detail">ออก #{players.find(item => Number(item.id) === Number(details.playerOut))?.number ?? '?'} → เข้า #{players.find(item => Number(item.id) === Number(details.playerIn))?.number ?? '?'}</div>}
                            </div>;
                        })}</div>
                        <footer className="vis-history-cardfooter"><span>#{index + 1}</span><div><span className={group.winner === 'home' ? 'home' : ''}>{group.winner === 'home' ? '▴ ' : ''}{names.home} <b>{group.score.home ?? '—'}</b></span><span>–</span><span className={group.winner === 'away' ? 'away' : ''}><b>{group.score.away ?? '—'}</b> {names.away}{group.winner === 'away' ? ' ▴' : ''}</span></div></footer>
                    </li>)}</ol>
                </div>
            </div>
        </div>
    </aside>;
}
