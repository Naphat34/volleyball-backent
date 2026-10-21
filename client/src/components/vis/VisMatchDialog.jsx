import { useState } from 'react';
import { api } from '../../api';
import { visSkillNames } from '../../utils/vis/visPresentation';
import { getStoredUser } from '../../auth/authStorage';

export default function VisMatchDialog({ mode, match, teams, events, onClose, onLineup, canEditLineup, readOnly: requestedReadOnly, colors, onColors, onPDF }) {
    const readOnly = requestedReadOnly || match.is_custom_vis || match.offline_released;
    const rosterReadOnly = readOnly || match.is_offline_vis;
    const [editing, setEditing] = useState(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [teamEdit, setTeamEdit] = useState(null);
    const isAdmin = getStoredUser()?.role === 'admin';
    const saveTeam = async event => {
        event.preventDefault(); setSaving(true); setError('');
        try { await api.updateTeam(match[`${teamEdit.key}_team_id`], { name: teamEdit.name.trim() }); setTeamEdit(null); }
        catch (error) { setError(error.response?.data?.error || 'บันทึกชื่อทีมไม่สำเร็จ'); }
        finally { setSaving(false); }
    };
    const savePlayer = async event => {
        event.preventDefault(); setSaving(true); setError('');
        try {
            await api.updateMatchTeamPlayer(match.id, match[`${editing.team}_team_id`], editing.id,
                { first_name: editing.first_name.trim(), last_name: editing.last_name.trim(), number: Number(editing.number) });
            setEditing(null);
        } catch (error) { setError(error.response?.data?.error || 'บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลและสิทธิ์แก้ไขรายชื่อ'); }
        finally { setSaving(false); }
    };
    const stats = team => team.players.map(player => {
        const own = events.filter(event => Number(event.player_id) === Number(player.id) && String(event.team_id) === String(match[`${team.key}_team_id`]));
        return { player, counts: Object.keys(visSkillNames).map(skill => own.filter(event => event.skill === skill).length),
            points: own.filter(event => ['S', 'A', 'B'].includes(event.skill) && event.grade === '#').length,
            errors: own.filter(event => ['=', '/'].includes(event.grade)).length };
    });
    return <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 p-3" onKeyDown={event => { if (event.key === 'Escape' && !saving) onClose(); }}>
        <section role="dialog" aria-modal="true" aria-label={mode === 'stats' ? 'สถิติทั้งแมตช์ VIS' : 'ตั้งค่าแมตช์ VIS'} className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 p-4"><h2 className="font-bold">{mode === 'stats' ? 'สถิติทั้งแมตช์ VIS' : 'ตั้งค่าแมตช์'} · {match.home_team} – {match.away_team}</h2><button disabled={saving} onClick={onClose} aria-label="ปิดหน้าต่าง" className="rounded bg-slate-800 px-3 py-1">✕</button></div>
            <div className="space-y-5 overflow-y-auto p-4">
                {mode === 'settings' && match.is_custom_vis && <p className="text-sm text-sky-200">ทีมและรายชื่อของแมตช์สร้างเองแก้ได้จาก “จัดการ / เผยแพร่” บนแดชบอร์ด ก่อนเริ่มบันทึก</p>}
                {mode === 'settings' && <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-800 p-3">
                    {teams.map(team => <label key={team.key} className="flex items-center gap-2 text-sm">สีทีมในหน้าบันทึก · {team.name}<input aria-label={`สีทีม ${team.name}`} type="color" value={colors[team.key]} onChange={event => onColors({ ...colors, [team.key]: event.target.value })} className="h-8 w-10 cursor-pointer" /></label>)}
                    <button disabled={!canEditLineup || readOnly} onClick={onLineup} className="rounded bg-sky-800 px-3 py-2 text-sm disabled:opacity-40">แก้ไลน์อัปเริ่มเซต 1</button>
                    {!canEditLineup && <p className="w-full text-xs text-slate-400">ไลน์อัปเริ่มเซตแก้ได้ก่อนมีรายการบันทึก เพื่อรักษาลำดับการหมุนที่ผ่านมา</p>}
                </div>}
                {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                {teamEdit && <form onSubmit={saveTeam} className="flex flex-wrap items-end gap-2 rounded-lg border border-sky-700 p-3"><label className="text-xs">ชื่อทีม (ใช้ทั้งระบบ)<input required value={teamEdit.name} onChange={event => setTeamEdit({ ...teamEdit, name: event.target.value })} className="mt-1 block rounded bg-slate-800 p-2" /></label><button disabled={saving} className="rounded bg-sky-700 px-3 py-2 text-sm">บันทึกชื่อทีม</button><button type="button" disabled={saving} onClick={() => setTeamEdit(null)} className="px-3 py-2 text-sm">ยกเลิก</button></form>}
                {editing && <form onSubmit={savePlayer} className="flex flex-wrap gap-2 rounded-lg border border-sky-700 p-3">
                    <label className="text-xs">เบอร์<input aria-label="เบอร์ผู้เล่น" required min="1" max="999" type="number" value={editing.number} onChange={event => setEditing({ ...editing, number: event.target.value })} className="mt-1 block w-20 rounded bg-slate-800 p-2" /></label>
                    {['first_name', 'last_name'].map((field, index) => <label key={field} className="text-xs">{index ? 'นามสกุล' : 'ชื่อ'}<input required value={editing[field]} onChange={event => setEditing({ ...editing, [field]: event.target.value })} className="mt-1 block rounded bg-slate-800 p-2" /></label>)}
                    <button disabled={saving} className="self-end rounded bg-sky-700 px-3 py-2 text-sm">{saving ? 'กำลังบันทึก…' : 'บันทึกรายชื่อ'}</button><button type="button" disabled={saving} onClick={() => setEditing(null)} className="self-end px-3 py-2 text-sm">ยกเลิก</button>
                </form>}
                {teams.map(team => <section key={team.key}><div className="mb-2 flex items-center gap-3"><h3 className="font-semibold text-sky-200">{team.name}</h3>{mode === 'settings' && isAdmin && <button disabled={rosterReadOnly || saving} onClick={() => setTeamEdit({ key: team.key, name: team.name })} className="text-xs text-sky-300 disabled:opacity-40">แก้ชื่อทีม</button>}</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-800 text-xs text-slate-400"><tr><th className="p-2">เบอร์</th><th className="p-2">ชื่อผู้เล่น</th>{mode === 'stats' ? <>{Object.keys(visSkillNames).map(skill => <th key={skill} title={visSkillNames[skill]} className="p-2">{skill}</th>)}<th className="p-2">แต้ม</th><th className="p-2">เสีย</th></> : <><th className="p-2">สถานะ</th><th className="p-2">แก้ไข</th></>}</tr></thead><tbody>
                    {stats(team).map(({ player, counts, points, errors }) => <tr key={player.id} className="border-b border-slate-800"><td className="p-2">{player.number}</td><td className="p-2">{player.name}</td>{mode === 'stats' ? <>{counts.map((count, index) => <td key={index} className="p-2">{count}</td>)}<td className="p-2 text-emerald-300">{points}</td><td className="p-2 text-rose-300">{errors}</td></> : <><td className="p-2">{team.lineup.some(item => item.id === player.id) ? `P${team.lineup.findIndex(item => item.id === player.id) + 1}` : 'สำรอง'}</td><td className="p-2"><button disabled={rosterReadOnly || saving} onClick={() => { setError(''); setEditing({ ...player, team: team.key, first_name: player.first_name || '', last_name: player.last_name || '' }); }} className="text-sky-300 disabled:opacity-40">แก้รายชื่อ</button></td></>}</tr>)}
                </tbody></table></div>{mode === 'stats' && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="py-2 text-left text-slate-400">สรุปเกรดทั้งทีม</caption><thead className="bg-slate-800"><tr><th className="p-2">ทักษะ</th>{['#', '+', '!', '-', '=', '/'].map(grade => <th key={grade} className="p-2">{grade}</th>)}<th className="p-2">รวม</th></tr></thead><tbody>{Object.entries(visSkillNames).map(([skill, name]) => {
                    const own = events.filter(event => event.skill === skill && String(event.team_id) === String(match[`${team.key}_team_id`]));
                    return <tr key={skill} className="border-b border-slate-800"><td className="p-2">{skill} · {name}</td>{['#', '+', '!', '-', '=', '/'].map(grade => <td key={grade} className="p-2">{own.filter(event => event.grade === grade).length}</td>)}<td className="p-2">{own.length}</td></tr>;
                })}</tbody></table></div>}</section>)}
                {mode === 'stats' && <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-400">S/R/A/B/D/E = จำนวนครั้งที่บันทึก · แต้ม = S/A/B เกรด # · เสีย = เกรด = หรือ /</p><button onClick={onPDF} className="shrink-0 rounded bg-sky-800 px-3 py-2 text-sm">รายงาน PDF</button></div>}
            </div>
        </section>
    </div>;
}
