import { useState } from 'react';
import { Columns2, Rows2, ArrowLeftRight, LockKeyhole, UnlockKeyhole, Users, ListOrdered, PlusCircle } from 'lucide-react';
import VisMatchControls from './VisMatchControls';

export default function VisCourtPanel({ teams, setStats = [], onReverse, selectedPlayer, onSelect, server, servingTeam, locked, reviewMode, onLineup, send, timeouts, substitutions, substitutionLimit }) {
    const [courtLocked, setCourtLocked] = useState(false);
    const [stackedCourt, setStackedCourt] = useState(false);
    const [zoom, setZoom] = useState(100);
    const ordered = teams;
    return <section className="vis-court-panel" aria-label="สนามและการควบคุม">
        <header className="vis-panel-title"><span>⠿ สนามและการควบคุม</span><div className="vis-zoom"><button onClick={() => setZoom(value => Math.max(80, value - 10))} aria-label="ย่อสนาม">A−</button><span>{zoom}%</span><button onClick={() => setZoom(value => Math.min(130, value + 10))} aria-label="ขยายสนาม">A+</button></div></header>
        <div className="vis-court-scroll"><div style={{ zoom: zoom / 100 }}>
            <div className="vis-court-card">
                <div className="vis-court-tools"><button type="button" title={stackedCourt ? 'แสดงสนามซ้าย–ขวา' : 'แสดงสนามบน–ล่าง'} aria-label={stackedCourt ? 'แสดงสนามซ้าย–ขวา' : 'แสดงสนามบน–ล่าง'} aria-pressed={stackedCourt} onClick={() => setStackedCourt(value => !value)}>{stackedCourt ? <Rows2 size={16} /> : <Columns2 size={16} />}</button><button title="สลับฝั่งแสดงผล" aria-label="สลับฝั่งแสดงผล" onClick={onReverse}><ArrowLeftRight size={16} /></button><button aria-pressed={courtLocked} onClick={() => setCourtLocked(value => !value)}>{courtLocked ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}ล็อค</button><span className="vis-court-legend">* {teams.find(team => team.key === 'home')?.name} ⇄ a {teams.find(team => team.key === 'away')?.name}</span></div>
                <div className={`vis-court-teams${stackedCourt ? ' vis-court-stacked' : ''}`}>{ordered.map((team, side) => {
                    const positions = stackedCourt
                        ? side === 0 ? [0, 5, 4, 1, 2, 3] : [3, 2, 1, 4, 5, 0]
                        : side === 0 ? [4, 3, 5, 2, 0, 1] : [1, 0, 2, 5, 3, 4];
                    return <section key={team.key} className={`vis-court-team vis-team-${team.key}`} style={{ '--team-color': `var(--vis-${team.key}-color)`, '--team-ink': `var(--vis-${team.key}-ink)`, '--team-card': `var(--vis-${team.key}-card)`, '--team-card-ink': `var(--vis-${team.key}-card-ink)` }}>
                        <h3 title={team.fullName || team.name}><b>{team.key === 'home' ? '*' : 'a'}</b><span>{team.name}</span></h3>
                        <div className="vis-team-tools"><button disabled={locked || reviewMode} onClick={onLineup}><Users size={13} />จัดตัว</button><button disabled={locked || reviewMode} onClick={onLineup}><ListOrdered size={13} />L-U</button></div>
                        <div className="vis-player-grid">{positions.map(index => {
                            const player = team.lineup[index];
                            return <button key={index} className={`vis-court-player ${selectedPlayer?.id === player?.id && player ? 'vis-player-selected' : ''} ${player && server?.id === player.id && servingTeam === team.key ? 'vis-player-serving' : ''}`} disabled={locked || courtLocked || !player} title={player ? `P${index + 1} · #${player.number} ${player.name}` : `P${index + 1} ยังไม่ระบุผู้เล่น`} onClick={() => onSelect(team.key, player)}>
                                <small>{['I', 'II', 'III', 'IV', 'V', 'VI'][index]}</small><strong>{player?.number ?? '–'}</strong><span>–</span>
                            </button>;
                        })}</div>
                        <div className="vis-libero-slot"><small>L</small>{team.libero ? <strong>{team.libero.number}</strong> : <span>+</span>}</div>
                        <div className="vis-bench-grid"><span>สำรอง</span>{team.subs.filter(player => player.id !== team.libero?.id).map(player => <span key={player.id} className="vis-bench-player" title={`#${player.number} ${player.name}`}>{player.number}</span>)}</div>
                    </section>;
                })}</div>
                {!teams.every(team => team.lineup.length === 6) && <p className="vis-lineup-hint">ยังไม่ได้ตั้งตำแหน่งเริ่มต้น</p>}
                {!reviewMode && <div className="vis-lineup-actions">{ordered.map(team => <button key={team.key} onClick={onLineup} disabled={locked}>ตั้งไลน์อัป {team.name}</button>)}</div>}
            </div>
            {!reviewMode && <div className="vis-control-card"><div className="vis-point-controls">{ordered.map(team => <button key={team.key} disabled={locked} onClick={() => send({ type: 'RALLY', events: [{ team: team.key, player: null, skill: 'OP', grade: '#' }] })}><PlusCircle size={14} />+1 Pt {team.name}</button>)}</div><div className="vis-team-controls"><VisMatchControls teams={ordered} locked={locked} send={send} timeouts={timeouts} substitutions={substitutions} substitutionLimit={substitutionLimit} showTeamName={false} stacked /></div></div>}
            <section className="vis-set-points" aria-label="แต้มในเซตนี้">
                <h3>แต้มในเซตนี้</h3>
                <div className="vis-set-points-teams">{ordered.map(team => {
                    const stats = setStats.find(item => item.key === team.key);
                    return <div key={team.key}>
                        <h4 title={team.fullName || team.name}>{team.name}</h4>
                        <p>ตบ {stats?.total.attack[1] ?? 0}</p>
                        <p>บล็อก {stats?.total.block[0] ?? 0}</p>
                        <p>เสิร์ฟ {stats?.total.serve[1] ?? 0}</p>
                        <p>คู่แข่งเสีย {stats?.opponentErrors ?? 0}</p>
                    </div>;
                })}</div>
            </section>
        </div></div>
    </section>;
}
