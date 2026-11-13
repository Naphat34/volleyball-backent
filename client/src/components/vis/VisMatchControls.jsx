import { GuardedButton, GuardedForm } from '../ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import './VisMatchControls.css';
import useVisTranslation from './useVisTranslation';
import { useState } from 'react';
import { Clock3, ArrowLeftRight, X } from 'lucide-react';

export default function VisMatchControls({ teams, locked, send, timeouts, substitutions, substitutionLimit = 6, showTeamName = true, stacked = false }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const vt = useVisTranslation();
    const [teamKey, setTeamKey] = useState(null);
    const [playerOut, setPlayerOut] = useState('');
    const [playerIn, setPlayerIn] = useState('');
    const [pairs, setPairs] = useState([]);
    const [saving, setSaving] = useState(false);
    const team = teams.find(item => item.key === teamKey);
    const isLibero = player => ['L', 'LIBERO', 'L1', 'L2'].includes(String(player.position || player.role || '').toUpperCase())
        || [player.is_libero, player.is_libero1, player.is_libero2].some(value => value === true || Number(value) === 1);
    const [liberoMode, setLiberoMode] = useState(false);
    const active = team?.liberoReplacement;
    const bench = team?.players.filter(player => !team.lineup.some(item => item.id === player.id))
        .filter(player => liberoMode ? (isLibero(player) || player.id === active?.regular) : !isLibero(player) && player.id !== active?.regular) || [];
    const outgoing = team?.lineup.filter(player => liberoMode ? active ? player.id === active.libero : !isLibero(player) && [0,4,5].includes(team.lineup.indexOf(player)) : !isLibero(player)) || [];
    const buttonClass = `inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 py-2 text-slate-100 hover:bg-slate-700 disabled:opacity-40 ${stacked ? 'w-full px-2 text-xs' : 'px-3 text-sm'}`;
    const remaining = substitutionLimit - (substitutions[teamKey] || 0);
    const used = new Set(pairs.flatMap(pair => [pair.playerOut, pair.playerIn]));
    const selectedOut = outgoing.find(player => String(player.id) === playerOut);
    const selectedIn = bench.find(player => String(player.id) === playerIn);
    const choices = (players, value, select, direction) => <div className="vis-libero-choices">{players.map(player => <GuardedButton key={player.id} type="button" disabled={locked || saving || (!liberoMode && used.has(player.id))} aria-pressed={value === String(player.id)} onClick={() => select(String(player.id))} className="vis-libero-choice"><strong className={'vis-sub-number-' + direction}>{player.number}</strong><span>{isLibero(player) ? ui('Libero') : vt('ผู้เล่น')}<small>{displayNames.personName(player)}</small></span></GuardedButton>)}</div>;
    const currentPair = playerOut && playerIn ? { playerOut: Number(playerOut), playerIn: Number(playerIn) } : null;
    const allPairs = [...pairs, ...(currentPair ? [currentPair] : [])];
    const incomplete = Boolean(playerOut) !== Boolean(playerIn);
    const submit = async event => {
        event.preventDefault();
        if (locked || saving || (liberoMode ? !currentPair : !allPairs.length || incomplete || allPairs.length > remaining)) return;
        setSaving(true);
        try {
            if (await send(liberoMode ? { type: 'LIBERO_REPLACEMENT', team: teamKey, ...currentPair } : { type: 'SUBSTITUTIONS', team: teamKey, pairs: allPairs })) setTeamKey(null);
        } finally { setSaving(false); }
    };
    return <>
        {teams.map(item => <div key={item.key} className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={`${vt("ควบคุมทีม ")}${item.name}`}>
            {showTeamName && <span className="max-w-32 truncate text-xs text-slate-300" title={item.name}>{item.name}</span>}
            <GuardedButton className={buttonClass} aria-label={`${vt("เวลานอก ")}${item.name} ${timeouts[item.key]}/2`} disabled={locked || timeouts[item.key] >= 2} onClick={() => send({ type: 'TIMEOUT', team: item.key })}>
                <Clock3 size={15} />{vt("เวลานอก ")}{timeouts[item.key]}/2
            </GuardedButton>
            <GuardedButton className={buttonClass} aria-label={`${vt("เปลี่ยนตัว ")}${item.name} ${substitutions[item.key]}/${substitutionLimit}`} disabled={locked || substitutions[item.key] >= substitutionLimit || item.players.length <= item.lineup.length}
                onClick={() => { setPairs([]); setLiberoMode(false); setTeamKey(item.key); setPlayerOut(''); setPlayerIn(''); }}>
                <ArrowLeftRight size={15} />{vt("เปลี่ยนตัว ")}{substitutions[item.key]}/{substitutionLimit}
            </GuardedButton>
            <GuardedButton type="button" className={buttonClass} disabled={locked || !item.players.some(isLibero)} onClick={() => { setPairs([]); setLiberoMode(true); setTeamKey(item.key); setPlayerOut(item.liberoReplacement ? String(item.liberoReplacement.libero) : ''); setPlayerIn(''); }}>{vt("Libero เข้า–ออก")}</GuardedButton>
        </div>)}
        {team && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
            <GuardedForm onSubmit={submit} role="dialog" aria-modal="true" onKeyDown={event => { if (event.key === 'Escape' && !saving) { event.stopPropagation(); setTeamKey(null); } }} aria-label={liberoMode ? vt("Libero เข้า–ออก") : vt("เปลี่ยนตัวผู้เล่น")} className="vis-themed-dialog w-full max-w-lg max-h-[90dvh] overflow-y-auto space-y-4 rounded-xl border border-slate-600 bg-slate-900 p-5 text-white">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{liberoMode ? vt('Libero เข้า–ออก') : vt('เปลี่ยนตัว')} · {displayNames.teamName(team)}</h2><GuardedButton type="button" disabled={saving} onClick={() => setTeamKey(null)} aria-label={vt("ปิด")}><X size={20} /></GuardedButton></div>
                {liberoMode && <p className="text-sm">{active ? vt('นำผู้เล่นเดิมกลับ หรือสลับเป็น Libero อีกคน โดยต้องมีแรลลี่จบระหว่างการสลับ') : vt('เลือกผู้เล่นแดนหลังที่ไม่ได้เสิร์ฟ และ Libero ที่ต้องการนำเข้า · ไม่ใช้โควตาเปลี่ยนตัว')}</p>}
                {!liberoMode && <div className="vis-substitution-batch"><p>{vt('โควตาคงเหลือ')} {remaining} · {vt('คู่ที่เลือก')} {allPairs.length}</p>{pairs.map((pair, index) => <div key={pair.playerOut} className="vis-libero-preview"><strong className="vis-sub-number-out">#{team.players.find(p => p.id === pair.playerOut)?.number}</strong><ArrowLeftRight size={18} /><strong className="vis-sub-number-in">#{team.players.find(p => p.id === pair.playerIn)?.number}</strong><GuardedButton type="button" disabled={saving} aria-label={vt('ลบคู่เปลี่ยนตัว')} onClick={() => setPairs(value => value.filter((_, i) => i !== index))}><X size={16} /></GuardedButton></div>)}</div>}
                <div className="vis-libero-selection"><fieldset><legend>{vt("ผู้เล่นออก")}</legend>{choices(outgoing, playerOut, setPlayerOut, 'out')}{!outgoing.length && <p>{vt("ไม่มีผู้เล่นที่สลับได้")}</p>}</fieldset><fieldset><legend>{liberoMode ? active ? vt("ผู้เล่นเข้า / Libero") : vt("Libero เข้า") : vt("ผู้เล่นเข้า")}</legend>{choices(bench, playerIn, setPlayerIn, 'in')}{!bench.length && <p>{vt("ไม่มีผู้เล่นที่สลับได้")}</p>}</fieldset><div className="vis-libero-preview" aria-live="polite"><span>{vt("ออก")} <strong className="vis-sub-number-out">{selectedOut ? '#' + selectedOut.number : '—'}</strong></span><ArrowLeftRight size={20} /><span>{selectedIn && isLibero(selectedIn) ? ui('Libero') : vt("เข้า")} <strong className="vis-sub-number-in">{selectedIn ? '#' + selectedIn.number : '—'}</strong></span></div></div>
                {!liberoMode && <GuardedButton type="button" disabled={locked || saving || !currentPair || allPairs.length >= remaining} className="rounded border px-4 py-2" onClick={() => { setPairs(value => [...value, currentPair]); setPlayerOut(''); setPlayerIn(''); }}>{vt('เพิ่มคู่เปลี่ยนตัว')}</GuardedButton>}
                <GuardedButton type="submit" disabled={locked || saving || (liberoMode ? !currentPair : !allPairs.length || incomplete || allPairs.length > remaining)} className="rounded bg-indigo-600 px-4 py-3 disabled:opacity-40">{saving ? vt('กำลังบันทึก…') : vt("ยืนยันเปลี่ยนตัว")}{!liberoMode && ' (' + allPairs.length + ')'}</GuardedButton>
                <GuardedButton type="button" disabled={saving} onClick={() => setTeamKey(null)} className="ml-3 rounded bg-slate-700 px-4 py-3">{vt("ยกเลิก")}</GuardedButton>
            </GuardedForm>
        </div>}
    </>;
}
