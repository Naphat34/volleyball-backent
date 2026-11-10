import { X, ArrowRight as UiArrowRight } from 'lucide-react';
import useDisplayNames from '../../../hooks/useDisplayNames';
import useScorerTranslation from '../useScorerTranslation';
import { useEffect, useState } from 'react';

import { applySubstitutionBatch } from '../../../utils/scorer/substitutionBatch';

export default function BatchSubstitutionModal({ isOpen, onClose, teamName, roster, currentLineup, playerOut, posIndex, subTracker, disqualifiedPlayers = [], onConfirmBatch }) {
    const displayNames = useDisplayNames();
    const st = useScorerTranslation();
    const [pairs, setPairs] = useState([]), [position, setPosition] = useState(null), [incoming, setIncoming] = useState('');
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { if (isOpen) { setPairs([]); setPosition(playerOut ? posIndex : null); setIncoming(''); setError(''); } }, [isOpen, playerOut, posIndex]);
    if (!isOpen) return null;
    const validate = list => applySubstitutionBatch({ lineup: currentLineup, roster, tracker: subTracker, pairs: list, disqualified: disqualifiedPlayers });
    const bench = roster.filter(player => {
        try { validate([...pairs, { posIndex: position, playerOut: currentLineup[position], playerIn: player }]); return true; }
        catch { return false; }
    });
    const addPair = () => {
        try {
            const player = roster.find(p => String(p.id || p.player_id) === incoming);
            const next = [...pairs, { posIndex: position, playerOut: currentLineup[position], playerIn: player }];
            validate(next); setPairs(next); setPosition(null); setIncoming(''); setError('');
        } catch (failure) { setError(failure.message); }
    };
    const confirm = async () => {
        setBusy(true); setError('');
        try { validate(pairs); await onConfirmBatch(pairs); onClose(); }
        catch (failure) { setError(failure.message); }
        finally { setBusy(false); }
    };

    const selectedOut = currentLineup[position];
    const selectedIn = bench.find(player => String(player.id || player.player_id) === incoming);
    return <div className="scorer-dialog fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
        <div role="dialog" aria-modal="true" aria-labelledby="batch-sub-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
                <div><h2 id="batch-sub-title" className="font-bold text-slate-900">{st("เปลี่ยนตัวผู้เล่น ·")}{' '}{teamName}</h2><p className="mt-1 text-xs text-slate-500">{st("ใช้ไป")}{' '}{subTracker?.count || 0}{' '}{st("/ 8 ครั้ง · รอบันทึก")}{' '}{pairs.length}{' '}{st("คู่")}</p></div>
                <button type="button" disabled={busy} onClick={onClose} aria-label={st("Close substitutions")} className="p-2 text-slate-500"><X size={20}/></button>
            </header>
            <div className="overflow-y-auto p-4 sm:p-5">
                <div className="grid gap-4 md:grid-cols-3">
                    <section className="rounded-xl border border-slate-200 p-4" aria-labelledby="sub-on-court">
                        <h3 id="sub-on-court" className="mb-3 font-bold text-rose-500">{st("1. ผู้เล่นในสนาม · OUT")}</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {currentLineup.map((player, index) => {
                                if (!player) return null;
                                const queued = pairs.some(pair => pair.posIndex === index);
                                return <button type="button" key={index} disabled={busy || queued} aria-pressed={position === index}
                                    onClick={() => { setPosition(index); setIncoming(''); setError(''); }} title={displayNames.personName(player)}
                                    className={`flex min-h-20 flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${position === index ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-200 text-slate-700 hover:border-rose-400'}`}>
                                    <span className="text-2xl font-black">{player.number}</span><span className="mt-1 w-full truncate text-center text-[10px]">{displayNames.personName(player)}</span>
                                </button>;
                            })}
                        </div>
                    </section>
                    <section className="flex flex-col rounded-xl border border-slate-200 p-4" aria-labelledby="sub-bench">
                        <h3 id="sub-bench" className="mb-3 font-bold text-emerald-500">{st("2. ม้านั่งสำรอง · IN")}</h3>
                        {position === null ? <p className="py-6 text-center text-sm text-slate-500">{st("เลือกหมายเลขผู้เล่นในสนามก่อน")}</p> : <>
                            <p className="mb-3 text-xs text-slate-500">{st("เลือกผู้เล่นเข้าแทน #")}{selectedOut?.number}</p>
                            <div className="grid grid-cols-3 gap-2">
                                {bench.map(player => {
                                    const playerId = String(player.id || player.player_id);
                                    return <button type="button" key={playerId} disabled={busy} aria-pressed={incoming === playerId}
                                        onClick={() => { setIncoming(playerId); setError(''); }} title={displayNames.personName(player)}
                                        className={`flex min-h-20 flex-col items-center justify-center rounded-lg border-2 p-2 transition-colors ${incoming === playerId ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-700 hover:border-emerald-400'}`}>
                                        <span className="text-2xl font-black">{player.number}</span><span className="mt-1 w-full truncate text-center text-[10px]">{displayNames.personName(player)}</span>
                                    </button>;
                                })}
                            </div>
                            {!bench.length && <p className="py-4 text-sm text-amber-500">{st("ไม่มีผู้เล่นที่เปลี่ยนเข้าได้ หรือใช้โควตาครบแล้ว")}</p>}
                        </>}
                        {selectedOut && selectedIn && <button type="button" disabled={busy} onClick={addPair} className="mt-4 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500">{st("Add · #")}{selectedOut.number} <UiArrowRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /> #{selectedIn.number}</button>}
                    </section>
                    <section className="rounded-xl border border-slate-200 p-4" aria-labelledby="sub-pending">
                        <h3 id="sub-pending" className="mb-3 font-bold text-slate-700">{st("3. รายการเปลี่ยนตัว (")}{pairs.length})</h3>
                        {!pairs.length && <p className="py-6 text-center text-sm text-slate-500">{st("เลือกผู้เล่นออกและเข้า แล้วกด Add")}</p>}
                        <div className="space-y-2">{pairs.map((pair, index) => <div key={pair.posIndex} className="relative rounded-lg border border-slate-200 p-3 pr-7">
                            <div className="flex items-center gap-2 font-black"><span className="text-rose-500">#{pair.playerOut.number}</span><span className="text-slate-400"><UiArrowRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></span><span className="text-emerald-500">#{pair.playerIn.number}</span></div>
                            <div className="mt-1 text-xs text-slate-500">{displayNames.personName(pair.playerOut)} <UiArrowRight size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /> {displayNames.personName(pair.playerIn)}</div>
                            <button type="button" disabled={busy} aria-label={st(`Remove pair {0}`, [index + 1])} onClick={() => { setPairs(pairs.filter((_, i) => i !== index)); setIncoming(''); setError(''); }} className="absolute right-1 top-1 p-1 text-slate-500 hover:text-rose-500"><X size={12}/></button>
                        </div>)}</div>
                    </section>
                </div>
                {error && <p role="alert" className="mt-4 text-sm font-bold text-rose-500">{st(error)}</p>}
            </div>
            <footer className="flex justify-end gap-3 border-t border-slate-200 p-5">
                <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-2">{st("ยกเลิก")}</button>
                <button type="button" disabled={busy || !pairs.length || Boolean(incoming)} onClick={confirm} className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-500 disabled:opacity-40">{busy ? st('กำลังบันทึก…') : st(`บันทึก {0} คู่`, [pairs.length])}</button>
            </footer>
        </div>
    </div>;
}
