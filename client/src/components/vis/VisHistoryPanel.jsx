import { GuardedButton } from '../ui/GuardedAction';
import { ChevronUp as WinnerIcon } from 'lucide-react';
import { X as UiX, ChevronLeft as UiChevronLeft, ChevronRight as UiChevronRight, AlertTriangle as UiAlertTriangle, ArrowRight as UiArrowRight, Grip as SystemGrip, Circle as SystemCircle } from 'lucide-react';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import useVisTranslation from './useVisTranslation';
import { useEffect, useRef, useState } from 'react';
import { describeVisEvent, describeVisGrade, eventDetails, getVisEventCode, visSkillNames } from '../../utils/vis/visPresentation';
import './VisHistoryPanel.css';
import { useLanguage } from '../../context/LanguageContext';

export default function VisHistoryPanel({ onClosePanel, matchData, actionLog, players, className = '', setLineups = {}, currentSet = 1, completedSets = [], setupComplete = false, finished = false }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const vt = useVisTranslation();
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
    return <aside className={`vis-history ${className}`} aria-label={vt("โค้ดและประวัติ")}>
        <div className="vis-history-inner">
            <header className="vis-history-header">
                <strong><span className="vis-history-grip"><SystemGrip size={14} className="inline-block" aria-hidden="true" /></span>{vt(" โค้ดและประวัติ")}</strong>
                <span className="vis-history-count">{actionLog.length}{vt(" รายการ")}</span>
                <div className="vis-history-modes" aria-label={vt("รูปแบบประวัติ")}>
                    <GuardedButton type="button" aria-pressed={!descriptions} onClick={() => setDescriptions(false)}>{ui("CODE")}</GuardedButton>
                    <GuardedButton type="button" aria-pressed={descriptions} onClick={() => setDescriptions(true)}>{vt("+ คำอธิบาย")}</GuardedButton>
                </div>
                <div className="vis-zoom"><GuardedButton onClick={() => setZoom(value => Math.max(80, value - 10))} aria-label={vt("ย่อประวัติ")}>{ui("A−")}</GuardedButton><span>{zoom}%</span><GuardedButton onClick={() => setZoom(value => Math.min(140, value + 10))} aria-label={vt("ขยายประวัติ")}>{ui("A+")}</GuardedButton></div><label><input type="checkbox" checked={grouped} onChange={event => { setGrouped(event.target.checked); setSelected(null); }} />{vt(" รวมตามแรลลี่")}</label>
                {onClosePanel && <GuardedButton type="button" className="vis-panel-close" aria-label={vt("ปิดแผงโค้ดและประวัติ")} title={vt("ปิดแผง")} onClick={onClosePanel}><UiX size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton>}
            </header>
            <div className="vis-history-body">
                <nav className="vis-history-rail" aria-label={vt("คะแนนแต่ละแรลลี่")}>
                    <div className="vis-history-set"><GuardedButton type="button" aria-label={vt("เซตก่อนหน้า")} disabled={sets.indexOf(activeSet) <= 0} onClick={() => changeSet(-1)}><UiChevronLeft size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton><b>{ui("Set")}{' '}{activeSet}</b><GuardedButton type="button" aria-label={vt("เซตถัดไป")} disabled={sets.indexOf(activeSet) >= sets.length - 1} onClick={() => changeSet(1)}><UiChevronRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton></div>
                    <div className="vis-history-teamheads"><span title={displayNames.matchTeamName(matchData, 'home')}>{names.home}</span><span title={displayNames.matchTeamName(matchData, 'away')}>{names.away}</span></div>
                    {visible.map((group, index) => <GuardedButton type="button" key={group.key} className={`vis-history-scorelink ${group.winner || 'neutral'} ${activeKey === group.key ? 'selected' : ''}`} onClick={() => choose(group.key)} aria-label={`${vt("รายการ ")}${index + 1}${vt(" คะแนน ")}${group.score.home ?? '—'}${vt(" ต่อ ")}${group.score.away ?? '—'}`} aria-current={activeKey === group.key ? 'true' : undefined}><span>{group.score.home ?? '—'}</span><span>{group.score.away ?? '—'}</span></GuardedButton>)}
                </nav>
                <div className="vis-history-scroll" ref={scroll} style={{ fontSize: `${12 * zoom / 100}px` }}>
                    {savedLineup && <section className="vis-history-lineup" aria-label={`${th ? vt('ไลน์อัปเซต') : 'Set lineup'} ${activeSet}`}>
                        <div className="vis-history-events">{['home', 'away'].map(team => {
                            const numbers = (savedLineup[team] || []).map(id => players.find(player => Number(player.id) === Number(id))?.number ?? '?');
                            return <article key={team} className={'vis-history-event ' + team}>
                                <div className="vis-history-eventline">
                                    <code>{team === 'home' ? ui('*L') : ui('aL')}{numbers.join(',')}</code>
                                    {descriptions && <span>{names[team]} {th ? vt('ไลน์อัป:') : ui('Lineup:')} {numbers.join(' - ')}</span>}
                                </div>
                            </article>;
                        })}</div>
                    </section>}
                    {!visible.length && <p className="vis-history-empty">{th ? vt('ยังไม่มีรายการที่บันทึกในเซตนี้') : ui('No recorded events in this set.')}</p>}
                    <ol className="vis-history-list">{visible.map((group, index) => <li key={group.key} ref={node => { if (node) cards.current.set(group.key, node); else cards.current.delete(group.key); }} className={`vis-history-card ${group.winner || 'neutral'} ${activeKey === group.key ? 'selected' : ''}`}>
                        <div className="vis-history-events">{group.entries.map(entry => {
                            const team = entry.team_id == null ? 'neutral' : String(entry.team_id) === String(matchData.home_team_id) ? 'home' : 'away';
                            const details = eventDetails(entry);
                            const player = players.find(item => Number(item.id) === Number(entry.player_id));
                            const grade = details.rawGrade ?? entry.grade;
                            const scoring = ['S', 'A', 'B', 'OP'].includes(entry.skill) && grade === '#';
                            const error = ['=', '/'].includes(grade);
                            const description = visSkillNames[entry.skill]
                                ? `${details.jersey_number != null || player ? `#${details.jersey_number ?? player.number} ${displayNames.personName(player) || [displayNames.personFirstName(player), displayNames.personLastName(player)].filter(Boolean).join(' ')}` : ''} ${vt(visSkillNames[entry.skill])}${grade ? ` → ${vt(describeVisGrade(entry.skill, grade).label)}` : ''}`
                                : describeVisEvent(entry, players, vt);
                            return <div key={entry.id} className={`vis-history-event ${team}`}>
                                <div className="vis-history-eventline"><code>{getVisEventCode(entry, players) || entry.skill}</code>{descriptions && <span>{description}</span>}{descriptions && (scoring || error) && <small className={scoring ? 'positive' : 'negative'}><SystemCircle size={10} className="inline-block" aria-hidden="true" />{scoring ? ' +' : ' −'} {names[team]}</small>}</div>
                                {entry.referenceNeedsReview && <div className="vis-history-warning"><><UiAlertTriangle size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" />{vt("⚠ รายการนี้ถูกแก้ไขใน eScoreControl · กรุณาตรวจสอบสถิติ").replace(/⚠\uFE0F?/gu, '').trim()}</></div>}
                                {descriptions && details.playerOut && <div className="vis-history-detail">{vt("ออก #")}{players.find(item => Number(item.id) === Number(details.playerOut))?.number ?? '?'}<><UiArrowRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" />{vt(" → เข้า #").replace(/→\uFE0F?/gu, '').trim()}</>{players.find(item => Number(item.id) === Number(details.playerIn))?.number ?? '?'}</div>}
                            </div>;
                        })}</div>
                        <footer className="vis-history-cardfooter"><span>#{index + 1}</span><div><span className={group.winner === 'home' ? 'home' : ''}>{group.winner === 'home' ? <WinnerIcon size={14} className="inline-block" aria-hidden="true" /> : null}{names.home} <b>{group.score.home ?? '—'}</b></span><span>–</span><span className={group.winner === 'away' ? 'away' : ''}><b>{group.score.away ?? '—'}</b> {names.away}{group.winner === 'away' ? <WinnerIcon size={14} className="inline-block" aria-hidden="true" /> : null}</span></div></footer>
                    </li>)}</ol>
                    {completedSet && <section className="vis-history-set-ended" role="status">
                        <strong>{th ? vt('จบเซตที่') : ui('Set finished ·')} {activeSet}</strong>
                        <p>{names.home} <b>{completedSet.home} – {completedSet.away}</b> {names.away}</p>
                        {finished ? <small>{th ? vt('จบการแข่งขันแล้ว') : ui('Match finished')}</small>
                            : activeSet === currentSet - 1 && !setupComplete ? <small>{th ? `${vt("รอบันทึกไลน์อัปเซตที่ ")}${currentSet}` : ui(`Waiting for the set {0} lineup`, [currentSet])}</small> : null}
                    </section>}
                </div>
            </div>
        </div>
    </aside>;
}
