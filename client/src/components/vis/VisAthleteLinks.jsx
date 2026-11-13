import { GuardedButton } from '../ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { useState } from 'react';
import { api } from '../../api';

export default function VisAthleteLinks({ matchId, config, links, onLinked }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const run = async action => {
        setBusy(true); setNotice('');
        try { await action(); } catch (error) { setNotice(error.response?.data?.error || 'บันทึกไม่สำเร็จ'); }
        finally { setBusy(false); }
    };
    const save = (side, localPlayerId, value) => run(async () => {
        const playerId = value ? Number(value) : null;
        await api.linkCustomAthlete(matchId, { side, localPlayerId, playerId });
        onLinked([...links.filter(link => !(link.side === side && link.local_player_id === localPlayerId)),
            ...(playerId ? [{ side, local_player_id: localPlayerId, player_id: playerId }] : [])]);
        setNotice('บันทึกแล้ว');
    });
    return <section className="space-y-3 rounded border border-slate-600 p-3">
        <h3>{ui("เชื่อมนักกีฬากับทะเบียนหลัก")}</h3>
        <p className="text-sm">{ui("ผู้ดูแลเลือกยืนยันนักกีฬาทีละคนเพื่อรวมประวัติสถิติ โดยข้อมูลรายชื่อในแมตช์จะคงเดิม")}</p>
        <div className="flex gap-2"><input aria-label={ui("ค้นหานักกีฬาทะเบียนหลัก")} className="min-w-0 rounded bg-slate-800 p-2" value={query} onChange={event => setQuery(event.target.value)} placeholder={ui("ชื่อหรือทีม")} /><GuardedButton type="button" disabled={busy} onClick={() => run(async () => setOptions((await api.getAthleteOptions(query)).data))}>{ui("ค้นหา")}</GuardedButton></div>
        {['home', 'away'].map(side => <div key={side}><h4>{config[side].name}</h4>{config[side].players.map(player => {
            const linked = links.find(link => link.side === side && link.local_player_id === player.id)?.player_id;
            return <label key={player.id} className="my-2 flex flex-wrap items-center gap-2 text-sm">
                <span>#{player.number} {displayNames.personFirstName(player)} {displayNames.personLastName(player)}</span>
                <select aria-label={ui(`เชื่อมนักกีฬา {0} เบอร์ {1}`, [side, player.number])} disabled={busy} className="max-w-full rounded bg-slate-800 p-2" value={linked || ''} onChange={event => save(side, player.id, event.target.value)}>
                    <option value="">{ui("ไม่เชื่อมกับทะเบียนหลัก")}</option>
                    {linked && !options.some(p => p.id === linked) && <option value={linked}>{ui("ทะเบียนหลัก #")}{linked}</option>}
                    {options.map(p => <option key={p.id} value={p.id}>#{p.id} {displayNames.personFirstName(p)} {displayNames.personLastName(p)} · {(displayNames.linkedTeamName(p)) || (ui('ไม่มีทีม'))}</option>)}
                </select>
            </label>;
        })}</div>)}
        {notice && <p role="status">{ui(notice)}</p>}
    </section>;
}
