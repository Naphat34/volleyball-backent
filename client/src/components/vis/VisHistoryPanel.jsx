import { useEffect, useRef, useState } from 'react';
import { describeVisEvent, describeVisGrade, eventDetails, getVisEventCode, visSkillNames } from '../../utils/vis/visPresentation';
import './VisHistoryPanel.css';
import { useLanguage } from '../../context/LanguageContext';

export default function VisHistoryPanel({ matchData, actionLog, players, className = '', setLineups = {}, currentSet = 1, completedSets = [], setupComplete = false, finished = false }) {
    const { language } = useLanguage();
    const th = language === 'THA';
    const [descriptions, setDescriptions] = useState(true);
    const [zoom, setZoom] = useState(100);
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
    const lineupSets = Object.keys(setLineups).map(Number).filter(number => setLineups[number]?.home?.length === 6 && setLineups[number]?.away?.length === 6);
    const sets = [...new Set([...groups.map(group => group.set), ...completedSets.map(set => set.set), ...lineupSets])].sort((a, b) => a - b);
    const defaultSet = lineupSets.includes(currentSet) ? currentSet : sets.at(-1) || 1;
    const activeSet = sets.includes(chosenSet) ? chosenSet : defaultSet;
    const savedLineup = setLineups[activeSet];
    const completedSet = completedSets.find(set => set.set === activeSet);
    useEffect(() => { setChosenSet(null); setSelected(null); }, [currentSet, setupComplete]);
    const visible = groups.filter(group => group.set === activeSet);
    const names = Object.fromEntries(['home', 'away'].map(key => [key,
        matchData[`${key}_team_code`]?.trim() || matchData[`${key}_team_short_name`]?.trim() || matchData[`${key}_team`]]));
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
                <div className="vis-zoom"><button onClick={() => setZoom(value => Math.max(80, value - 10))} aria-label="ย่อประวัติ">A−</button><span>{zoom}%</span><button onClick={() => setZoom(value => Math.min(140, value + 10))} aria-label="ขยายประวัติ">A+</button></div><label><input type="checkbox" checked={grouped} onChange={event => { setGrouped(event.target.checked); setSelected(null); }} /> รวมตามแรลลี่</label>
            </header>
            <div className="vis-history-body">
                <nav className="vis-history-rail" aria-label="คะแนนแต่ละแรลลี่">
                    <div className="vis-history-set"><button type="button" aria-label="เซตก่อนหน้า" disabled={sets.indexOf(activeSet) <= 0} onClick={() => changeSet(-1)}>‹</button><b>Set {activeSet}</b><button type="button" aria-label="เซตถัดไป" disabled={sets.indexOf(activeSet) >= sets.length - 1} onClick={() => changeSet(1)}>›</button></div>
                    <div className="vis-history-teamheads"><span title={matchData.home_team}>{names.home}</span><span title={matchData.away_team}>{names.away}</span></div>
                    {visible.map((group, index) => <button type="button" key={group.key} className={`vis-history-scorelink ${group.winner || 'neutral'} ${activeKey === group.key ? 'selected' : ''}`} onClick={() => choose(group.key)} aria-label={`รายการ ${index + 1} คะแนน ${group.score.home ?? '—'} ต่อ ${group.score.away ?? '—'}`} aria-current={activeKey === group.key ? 'true' : undefined}><span>{group.score.home ?? '—'}</span><span>{group.score.away ?? '—'}</span></button>)}
                </nav>
                <div className="vis-history-scroll" ref={scroll} style={{ fontSize: `${12 * zoom / 100}px` }}>
                    {savedLineup && <section className="vis-history-lineup" aria-label={`${th ? 'ไลน์อัปเซต' : 'Set lineup'} ${activeSet}`}>
                        <h3>{th ? 'ไลน์อัปเริ่มเซต' : 'Starting lineup · Set'} {activeSet}</h3>
                        <div>{['home', 'away'].map(team => <article key={team}>
                            <strong>{names[team]}{savedLineup.servingTeam === team ? (th ? ' · เสิร์ฟก่อน' : ' · First serve') : ''}</strong>
                            <ol>{(savedLineup[team] || []).map((id, index) => {
                                const player = players.find(item => Number(item.id) === Number(id));
                                return <li key={index}><b>{['I', 'II', 'III', 'IV', 'V', 'VI'][index]}</b><span>#{player?.number ?? '?'} {player?.name || [player?.first_name, player?.last_name].filter(Boolean).join(' ') || (th ? 'ไม่พบรายชื่อ' : 'Unknown player')}</span></li>;
                            })}</ol>
                        </article>)}</div>
                    </section>}
                    {!visible.length && <p className="vis-history-empty">{th ? 'ยังไม่มีรายการที่บันทึกในเซตนี้' : 'No recorded events in this set.'}</p>}
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
                    {completedSet && <section className="vis-history-set-ended" role="status">
                        <strong>{th ? 'จบเซตที่' : 'Set finished ·'} {activeSet}</strong>
                        <p>{names.home} <b>{completedSet.home} – {completedSet.away}</b> {names.away}</p>
                        {finished ? <small>{th ? 'จบการแข่งขันแล้ว' : 'Match finished'}</small>
                            : activeSet === currentSet - 1 && !setupComplete ? <small>{th ? `รอบันทึกไลน์อัปเซตที่ ${currentSet}` : `Waiting for the set ${currentSet} lineup`}</small> : null}
                    </section>}
                </div>
            </div>
        </div>
    </aside>;
}
