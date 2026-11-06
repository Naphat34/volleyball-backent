import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { getStoredUser } from '../../auth/authStorage';
import './VisMatchSettings.css';

const palette = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b'];

export default function VisMatchSettings({ match, teams, onClose, onLineup, canEditLineup, readOnly, colors, onColors }) {
    const isAdmin = getStoredUser()?.role === 'admin';
    const custom = Boolean(match.is_custom_vis);
    const locked = Boolean(readOnly || match.offline_released || ['confirmed', 'cancelled'].includes(match.vis_lifecycle));
    const customEditable = custom && !locked && ['draft', 'ready'].includes(match.vis_lifecycle);
    const metadataEditable = !locked && (customEditable || (isAdmin && !custom && !match.is_offline_vis));
    const rosterEditable = !locked && !match.is_offline_vis && (!custom || customEditable);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(null);
    const originalSettings = useRef(null);
    useEffect(() => {
        let active = true;
        api.getVisState(match.id).then(({ data }) => {
            if (!active) return;
            const state = data.state;
            const value = { substitutionLimit: state.substitutionLimit || 6, firstServingTeam: state.firstServingTeam || null,
                serveLocked: state.currentSet !== 1 || state.history.length > 0, setupComplete: state.setupComplete };
            originalSettings.current = value;
            setSettings(value);
        }).catch(error => { if (active) setError(error.response?.data?.error || 'โหลดการตั้งค่าไม่สำเร็จ กรุณาปิดและเปิดใหม่'); });
        return () => { active = false; };
    }, [match.id]);
    const [teamColors, setTeamColors] = useState(colors);
    const [pasteTeam, setPasteTeam] = useState(null);
    const [pasteText, setPasteText] = useState('');
    const [form, setForm] = useState(() => ({
        title: match.competition_name || '', date: String(match.match_date || '').slice(0, 10),
        location: match.location || '', maxSets: Number(match.max_sets) || 5,
        round: match.round_name || '',
        ...Object.fromEntries(teams.map(team => [team.key, { name: team.name, code: match[`${team.key}_team_code`] || '',
            players: team.players.map(player => ({ ...player, first_name: player.first_name || player.name || '', last_name: player.last_name || '' })) }]))
    }));
    const baseline = useRef(structuredClone(form));
    const closeButton = useRef(null);
    useEffect(() => {
        const previous = document.activeElement;
        closeButton.current?.focus();
        return () => previous?.focus?.();
    }, []);
    const updateTeam = (key, patch) => setForm(value => ({ ...value, [key]: { ...value[key], ...patch } }));
    const updatePlayer = (key, index, patch) => updateTeam(key, { players: form[key].players.map((p, i) => i === index ? { ...p, ...patch } : p) });
    const replaceRoster = (key, source) => {
        if (!customEditable) return;
        const players = Array.isArray(source) ? source : source.players;
        if (!Array.isArray(players) || players.length > 30) throw Error('รายชื่อไม่ถูกต้อง หรือมีผู้เล่นเกิน 30 คน');
        updateTeam(key, { players: players.map(p => ({ number: p.number ?? '', first_name: p.first_name || '', last_name: p.last_name || '', position: p.position || '', is_captain: Boolean(p.is_captain) })) });
    };
    const save = async event => {
        event.preventDefault();
        if (busy || !settings) return;
        setError('');
        setBusy(true);
        const customFormChanged = customEditable && JSON.stringify(form) !== JSON.stringify(baseline.current);
        try {
            if (!Number.isInteger(Number(settings.substitutionLimit)) || Number(settings.substitutionLimit) < 1 || Number(settings.substitutionLimit) > 8) throw Error('จำนวนเปลี่ยนตัวต่อเซตต้องอยู่ระหว่าง 1–8 ครั้ง');
            if (rosterEditable) for (const key of ['home', 'away']) {
                const players = form[key].players;
                if (players.some(p => !Number.isInteger(Number(p.number)) || Number(p.number) < 1 || Number(p.number) > 999 || !p.first_name.trim() || !p.last_name.trim())) throw Error('กรุณาระบุเบอร์ 1–999 ชื่อ และนามสกุลของผู้เล่นให้ครบ');
                if (new Set(players.map(p => Number(p.number))).size !== players.length) throw Error('เบอร์ผู้เล่นในทีมต้องไม่ซ้ำกัน');
                if (players.filter(p => p.is_captain).length > 1) throw Error('กำหนดกัปตันได้ทีมละหนึ่งคน');
            }
            if (metadataEditable && (!form.home.name.trim() || !form.away.name.trim() || (custom && !form.title.trim()))) throw Error('กรุณาระบุชื่อทีมและรายการแข่งขัน');
            if (customFormChanged) {
                await api.updateCustomVis(match.id, { title: form.title, date: form.date, time: String(match.start_time || '').slice(0, 5), location: form.location, gender: match.gender || '', maxSets: form.maxSets, home: form.home, away: form.away });
            } else if (!custom && !locked) {
                if (metadataEditable) {
                    const patch = {};
                    for (const [field, target] of [['date', 'match_date'], ['location', 'location'], ['round', 'round_name']]) {
                        if (form[field] !== baseline.current[field]) patch[target] = form[field];
                    }
                    if (Object.keys(patch).length) {
                        await api.updateMatch(match.id, patch);
                        for (const field of ['date', 'location', 'round']) baseline.current[field] = form[field];
                    }
                    for (const key of ['home', 'away']) {
                        if (form[key].name !== baseline.current[key].name || form[key].code !== baseline.current[key].code) {
                            await api.updateTeam(match[`${key}_team_id`], { name: form[key].name.trim(), code: form[key].code.trim() });
                            baseline.current[key].name = form[key].name; baseline.current[key].code = form[key].code;
                        }
                    }
                }
                if (rosterEditable) for (const key of ['home', 'away']) for (let index = 0; index < form[key].players.length; index++) {
                    const player = form[key].players[index], before = baseline.current[key].players[index];
                    if (['number', 'first_name', 'last_name'].some(field => String(player[field]) !== String(before[field]))) {
                        await api.updateMatchTeamPlayer(match.id, match[`${key}_team_id`], player.id, { number: Number(player.number), first_name: player.first_name.trim(), last_name: player.last_name.trim() });
                        baseline.current[key].players[index] = { ...player };
                    }
                }
            }
            if (!locked && (customFormChanged || Number(settings.substitutionLimit) !== originalSettings.current.substitutionLimit || settings.firstServingTeam !== originalSettings.current.firstServingTeam)) {
                const { data } = await api.getVisState(match.id);
                await api.saveVisCommand(match.id, { operationId: crypto.randomUUID(), revision: data.state.revision,
                    command: { type: 'CONFIGURE_SETTINGS', substitutionLimit: Number(settings.substitutionLimit), firstServingTeam: settings.firstServingTeam } });
                originalSettings.current = { ...settings, substitutionLimit: Number(settings.substitutionLimit) };
            }
            onColors(teamColors);
            onClose();
        } catch (error) { setError(error.response?.data?.error || error.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่'); }
        finally { setBusy(false); }
    };
    const trapFocus = event => {
        if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(item => item.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    return <div className="vis-settings-overlay" onKeyDown={trapFocus}>
        <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="vis-settings-title" className="vis-settings-modal" aria-busy={busy}>
            <header className="vis-settings-header"><h2 id="vis-settings-title">ตั้งค่าแมตช์</h2><div><button ref={closeButton} type="button" disabled={busy} onClick={onClose}>ปิด</button><button className="vis-settings-save" disabled={busy || !settings}>{busy ? 'กำลังบันทึก…' : 'บันทึกและปิด'}</button></div></header>
            <div className="vis-settings-body">
            <fieldset className="vis-settings-fields" disabled={busy}>
                {error && <p role="alert" className="vis-settings-error">{error}</p>}
                <section className="vis-settings-card"><h3>ข้อมูลการแข่งขัน</h3><div className="vis-settings-card-body">
                    <div className="vis-settings-match-fields">
                        <label>ชื่อแมตช์<input value={custom ? `${form.home.name} vs ${form.away.name}` : form.round} readOnly={!metadataEditable || custom} onChange={event => setForm({ ...form, round: event.target.value })} placeholder={`${form.home.name} vs ${form.away.name}`} /></label>
                        <label>รายการแข่งขัน<input value={form.title} readOnly={!customEditable} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
                        <label>วันที่<input type="date" value={form.date} readOnly={!metadataEditable} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
                        <label>สนาม<input value={form.location} readOnly={!metadataEditable} onChange={event => setForm({ ...form, location: event.target.value })} /></label>
                        <label>รูปแบบ<select value={form.maxSets} disabled={!customEditable} onChange={event => setForm({ ...form, maxSets: Number(event.target.value) })}><option value={5}>ชนะ 3 ใน 5 เซต</option><option value={3}>ชนะ 2 ใน 3 เซต</option></select></label>
                    </div>
                    <div className="vis-settings-rules">{[['แต้ม/เซต', 25], ['แต้มเซตตัดสิน', 15], ['เวลานอก/เซต', 2]].map(([label, value]) => <label key={label}>{label}<input value={value} readOnly /></label>)}
                        <label>เปลี่ยนตัว/เซต<input type="number" min={1} max={8} step={1} value={settings?.substitutionLimit ?? ''} disabled={locked || !settings} onChange={event => setSettings({ ...settings, substitutionLimit: event.target.value })} /></label>
                        <label>เสิร์ฟก่อน (เซต 1)<select value={settings?.firstServingTeam || ''} disabled={locked || !settings || settings.serveLocked} onChange={event => setSettings({ ...settings, firstServingTeam: event.target.value || null })}><option value="" disabled={settings?.setupComplete}>เลือกทีม</option>{['home', 'away'].map(key => <option key={key} value={key}>{form[key].code || match[`${key}_team_short_name`] || form[key].name}</option>)}</select></label>
                    </div>
                </div></section>
                <div className="vis-settings-teams">{teams.map(team => {
                    const key = team.key, draft = form[key];
                    return <section key={key} className="vis-settings-card vis-settings-team" style={{ '--settings-team-color': teamColors[key] }}>
                        <h3>{key === 'home' ? 'ทีมเจ้าบ้าน (*)' : 'ทีมเยือน (a)'}</h3>
                        <div className="vis-settings-card-body">
                            <div className="vis-settings-team-fields"><label>ชื่อทีม<input value={draft.name} readOnly={!metadataEditable} onChange={event => updateTeam(key, { name: event.target.value })} /></label><label>ชื่อย่อ<input value={draft.code} readOnly={!metadataEditable || custom} onChange={event => updateTeam(key, { code: event.target.value })} /></label></div>
                            <label>สีเสื้อ<div className="vis-settings-color"><input type="color" aria-label={`สีเสื้อ ${team.name}`} value={teamColors[key]} disabled={busy} onChange={event => setTeamColors({ ...teamColors, [key]: event.target.value })} /><span>{teamColors[key].toUpperCase()}</span></div></label>
                            <div className="vis-settings-palette">{palette.map(color => <button type="button" key={color} aria-label={`สี ${color} ${team.name}`} aria-pressed={teamColors[key].toLowerCase() === color} style={{ background: color }} onClick={() => setTeamColors({ ...teamColors, [key]: color })} />)}</div>
                            <label>โค้ช<input value={match[`${key}_coach_name`] || match[`${key}_coach`] || ''} readOnly placeholder="ยังไม่ระบุ" /></label>
                            <div className="vis-settings-lineup-label"><span>{canEditLineup ? 'ตำแหน่งเริ่มต้นเซต 1' : 'ตำแหน่งในสนามปัจจุบัน'} (I → VI, I = ผู้เสิร์ฟ)</span>{onLineup && <button type="button" disabled={!canEditLineup || locked || custom || busy} onClick={onLineup}>จัดไลน์อัป</button>}</div>
                            <div className="vis-settings-lineup">{['I', 'II', 'III', 'IV', 'V', 'VI'].map((position, index) => <div key={position}><small>{position}</small><strong>{team.lineup[index]?.number || '–'}</strong></div>)}</div>
                            <div className="vis-settings-roster-heading"><span>รายชื่อผู้เล่น ({draft.players.length})</span>{customEditable && <div><label className="vis-settings-file-button">นำเข้า JSON ทีม<input type="file" accept=".json,application/json" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { replaceRoster(key, JSON.parse(await file.text())); setError(''); } catch (error) { setError(error.message); } }} /></label><button type="button" onClick={() => { setPasteTeam(key); setPasteText(''); }}>วางรายชื่อ</button><button type="button" disabled={draft.players.length >= 30} onClick={() => updateTeam(key, { players: [...draft.players, { number: '', first_name: '', last_name: '', position: '', is_captain: false }] })}>+ เพิ่ม</button></div>}</div>
                            {pasteTeam === key && <div className="vis-settings-paste"><textarea aria-label="วางรายชื่อ JSON" value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder='[{"number":1,"first_name":"ชื่อ","last_name":"นามสกุล"}]' /><button type="button" onClick={() => { try { replaceRoster(key, JSON.parse(pasteText)); setPasteTeam(null); setError(''); } catch (error) { setError(error.message); } }}>ใช้รายชื่อ</button><button type="button" onClick={() => setPasteTeam(null)}>ยกเลิก</button></div>}
                            <div className="vis-settings-roster-summary">ผู้เล่น {draft.players.length} คน · ลิเบอโร {draft.players.filter(p => p.position === 'L').length} · กัปตัน {draft.players.find(p => p.is_captain)?.number || '–'}</div>
                            <div className="vis-settings-table-scroll"><table><thead><tr><th>เบอร์</th><th>ชื่อ</th><th>นามสกุล</th><th>ตำแหน่ง</th><th>L</th><th>C</th>{customEditable && <th />}</tr></thead><tbody>{draft.players.map((player, index) => <tr key={player.id || index}>
                                <td><input aria-label={`เบอร์ผู้เล่น ${index + 1} ${team.name}`} type="number" min={1} max={999} value={player.number} readOnly={!rosterEditable} onChange={event => updatePlayer(key, index, { number: event.target.value })} /></td>
                                <td><input aria-label={`ชื่อผู้เล่น ${index + 1} ${team.name}`} value={player.first_name} readOnly={!rosterEditable} onChange={event => updatePlayer(key, index, { first_name: event.target.value })} /></td>
                                <td><input aria-label={`นามสกุลผู้เล่น ${index + 1} ${team.name}`} value={player.last_name} readOnly={!rosterEditable} onChange={event => updatePlayer(key, index, { last_name: event.target.value })} /></td>
                                <td><select aria-label={`ตำแหน่งผู้เล่น ${index + 1} ${team.name}`} value={player.position || ''} disabled={!customEditable} onChange={event => updatePlayer(key, index, { position: event.target.value })}><option value="">–</option>{['S', 'OH', 'MB', 'OPP', 'OP', 'L'].map(position => <option key={position}>{position}</option>)}</select></td>
                                <td><input aria-label={`ลิเบอโร ${index + 1} ${team.name}`} type="checkbox" checked={player.position === 'L'} disabled={!customEditable} onChange={event => updatePlayer(key, index, { position: event.target.checked ? 'L' : '' })} /></td>
                                <td><input aria-label={`กัปตัน ${index + 1} ${team.name}`} type="checkbox" checked={Boolean(player.is_captain)} disabled={!customEditable} onChange={event => updateTeam(key, { players: draft.players.map((p, i) => ({ ...p, is_captain: i === index ? event.target.checked : false })) })} /></td>
                                {customEditable && <td><button type="button" aria-label={`ลบผู้เล่น ${index + 1} ${team.name}`} onClick={() => updateTeam(key, { players: draft.players.filter((_, i) => i !== index) })}>×</button></td>}
                            </tr>)}</tbody></table></div>
                        </div>
                    </section>;
                })}</div>
                <p className="vis-settings-note">ข้อมูลที่แก้ไขไม่ได้แสดงตามข้อมูลการแข่งขันในระบบ{!custom && ' · การแก้ชื่อทีมและผู้เล่นมีผลต่อข้อมูลทีมในระบบ'}{custom && !customEditable && ' · รายชื่อถูกล็อกหลังเริ่มบันทึกการแข่งขัน'}</p>
            </fieldset>
            </div>
        </form>
    </div>;
}
