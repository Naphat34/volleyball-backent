import { useEffect, useState } from 'react';
import { api } from '../../api';

const pairingKey = (matchId, side) => `court-station-pairing:${matchId}:${side}`;

export default function TeamCourtStation({ matchId, thai, children }) {
    const [side, setSide] = useState(() => {
        const saved = localStorage.getItem(`court-station:${matchId}`);
        return saved === 'A' || saved === 'B' ? saved : '';
    });
    const [snapshot, setSnapshot] = useState(null);
    const [stale, setStale] = useState(false);
    const [pairedToken, setPairedToken] = useState(() => side ? localStorage.getItem(pairingKey(matchId, side)) : null);
    const [pin, setPin] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!side) return;
        let active = true;
        let timer;
        const poll = async () => {
            try {
                const { data } = await api.getCourtStationStatus(matchId, side, pairedToken);
                if (active) {
                    setSnapshot({ ...data, checkedToken: pairedToken });
                    setStale(false);
                }
            } catch {
                if (active) setStale(true);
            } finally {
                if (active) timer = setTimeout(poll, 2000);
            }
        };
        void poll();
        return () => { active = false; clearTimeout(timer); };
    }, [matchId, side, pairedToken]);

    const { teamId = null, revision } = snapshot || {};
    const paused = stale || !teamId || snapshot.paused;
    const verified = !stale && snapshot && snapshot.checkedToken === pairedToken;
    const paired = Boolean(verified && snapshot.paired);
    const token = paired && !paused ? pairedToken : null;

    function selectSide(event) {
        const next = event.target.value;
        if (next) localStorage.setItem(`court-station:${matchId}`, next);
        else localStorage.removeItem(`court-station:${matchId}`);
        setSnapshot(null);
        setStale(false);
        setPairedToken(next ? localStorage.getItem(pairingKey(matchId, next)) : null);
        setPin('');
        setError('');
        setSide(next);
    }

    async function unlock(event) {
        event.preventDefault();
        if (busy || !verified || snapshot.closed || paired) return;
        setBusy(true);
        setError('');
        try {
            const { data } = await api.unlockCourtStation(matchId, side, pin);
            localStorage.setItem(pairingKey(matchId, side), data.token);
            setPairedToken(data.token);
        } catch (failure) {
            setError(failure.response?.status === 429
                ? (thai ? 'ลองหลายครั้งเกินไป กรุณารอสักครู่' : 'Too many attempts. Try again shortly.')
                : (thai ? 'ตรวจสอบ PIN จับคู่ของฝั่งนี้กับโต๊ะบันทึกคะแนน' : 'Check this court’s pairing PIN with the scorer.'));
        } finally {
            setPin('');
            setBusy(false);
        }
    }

    const controls = (
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-3 px-4 pt-4 sm:px-6">
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {thai ? 'ตำแหน่ง iPad' : 'iPad station'}
                <select value={side} onChange={selectSide} disabled={busy || paired} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900">
                    <option value="">{thai ? 'ตามบัญชีทีม' : 'Follow team account'}</option>
                    <option value="A">{thai ? 'ฝั่ง A' : 'Court A'}</option>
                    <option value="B">{thai ? 'ฝั่ง B' : 'Court B'}</option>
                </select>
            </label>
            {side && paused && <p role="status" className="text-sm font-medium text-amber-900">
                {stale ? (thai ? 'ยังตรวจสอบฝั่งสนามล่าสุดไม่ได้' : 'Court assignment could not be verified.')
                    : snapshot?.closed ? (thai ? 'แมตช์สิ้นสุดแล้ว' : 'Match closed.')
                    : (thai ? 'รอการยืนยันฝั่งสนามจากโต๊ะบันทึกคะแนน' : 'Waiting for the scorer to confirm court assignment.')}
            </p>}
            {side && verified && !snapshot.closed && !paired && (
                <form onSubmit={unlock} className="flex flex-wrap items-center gap-2">
                    <input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                        aria-label={thai ? 'PIN จับคู่ iPad' : 'iPad pairing PIN'} placeholder={thai ? 'PIN จับคู่ 8 หลัก' : '8-digit pairing PIN'}
                        type="password" inputMode="numeric" autoComplete="off" maxLength={8}
                        className="min-h-11 w-36 rounded-lg border border-slate-300 bg-white px-3 text-slate-900" />
                    <button type="submit" disabled={busy || pin.length !== 8} className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50">
                        {thai ? 'จับคู่ iPad' : 'Pair iPad'}
                    </button>
                </form>
            )}
            {paired && <span className="text-sm font-semibold text-emerald-800">{thai ? 'จับคู่สำหรับแมตช์นี้แล้ว' : 'Paired for this match'}</span>}
            {error && side && <p role="alert" className="text-sm text-rose-800">{error}</p>}
        </div>
    );

    return children({ side, teamId, token, controls, revision, paused });
}
