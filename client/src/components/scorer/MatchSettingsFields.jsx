import { GuardedButton } from '../ui/GuardedAction';
import { X as UiX } from 'lucide-react';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { matchCategoryLabel } from '../../utils/scorer/matchSettings';


const shirtColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f8fafc', '#1e293b'];
const staffRoles = [
    ['Team Manager', 'ผู้จัดการทีม'],
    ['Head Coach', 'ผู้ฝึกสอนหลัก'],
    ['Assistant Coach', 'ผู้ช่วยผู้ฝึกสอน 1'],
    ['Assistant Coach 2', 'ผู้ช่วยผู้ฝึกสอน 2'],
    ['Doctor', 'แพทย์ประจำทีม'],
    ['Therapist/Trainer', 'นักกายภาพ/เทรนเนอร์'],
];

export default function MatchSettingsFields({ tab, draft, settings, disabled, isManual, onChange, t }) {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const teamsDisabled = disabled || !settings.editableTeams;
    const field = (key, label, type = 'text', locked = false) => <label className="smm-field" key={key}>{ui(label)}<input type={type} value={draft[key] ?? ''} disabled={disabled || locked} onChange={event => onChange({ ...draft, [key]: event.target.value })}/></label>;
    const teamChange = (side, value) => onChange({ ...draft, [side]: { ...draft[side], ...value } });
    const updateRow = (side, collection, index, key, value) => teamChange(side, { [collection]: draft[side][collection].map((row, i) => i === index ? { ...row, [key]: value } : row) });
    const updateRole = (side, index, libero, captain) => {
        const current = draft[side].players[index];
        const otherLibero = draft[side].players.find((p, i) => i !== index && p.role.startsWith('L'));
        const liberoRole = current.role.startsWith('L') ? current.role.split('+')[0] : otherLibero?.role.startsWith('L1') ? 'L2' : 'L1';
        updateRow(side, 'players', index, 'role', `${libero ? liberoRole : ''}${libero && captain ? '+' : ''}${captain ? 'C' : ''}`);
    };
    if (tab === 'overview') return <section className="smm-competition-card"><h3>{t('ข้อมูลการแข่งขัน', 'Competition information')}</h3><div className="smm-form-grid">
        {field('title', t('ชื่อรายการแข่งขัน', 'Competition name'))}
        <label className="smm-field">{t('ประเภทการแข่งขัน', 'Gender')}<select value={draft.gender} disabled={disabled} onChange={event => onChange({ ...draft, gender: event.target.value })}><option value="">{t('ยังไม่ระบุ', 'Not specified')}</option><option value="Male">{t('ชาย', 'Men')}</option><option value="Female">{t('หญิง', 'Women')}</option><option value="Mixed">{t('ผสม', 'Mixed')}</option></select></label>
        <label className="smm-field">{t('รุ่นอายุ', 'Age group')}<select disabled={disabled} value={draft.age_group_id} onChange={event => onChange({ ...draft, age_group_id: event.target.value, category: event.target.value })}><option value="">{t('ยังไม่ระบุ', 'Not specified')}</option>{settings.ageGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="smm-field">{t('รายละเอียดประเภท', 'Category description')}<input value={matchCategoryLabel(draft, settings.ageGroups, t('ยังไม่ระบุ', 'Not specified'))} readOnly disabled={disabled}/></label>
        {field('match_number', t('หมายเลขแมตซ์', 'Match number'), 'number')}
        {field('round_name', t('รอบการแข่งขัน', 'Round'))}{field('pool_name', t('กลุ่ม / สาย', 'Pool'))}
        {field('match_date', t('วันที่แข่งขัน', 'Match date'), 'date')}{field('start_time', t('เวลาแข่งขัน', 'Start time'), 'time')}
        {field('location', t('สนาม / ยิม', 'Venue'))}{field('city', t('เมือง', 'City'))}{field('country', t('ประเทศ', 'Country'))}
        <label className="smm-field">{t('จำนวนเซตสูงสุด', 'Maximum sets')}<select disabled={teamsDisabled} value={draft.maxSets} onChange={event => onChange({ ...draft, maxSets: Number(event.target.value) })}><option value="3">3</option><option value="5">5</option></select></label>
        {field('pointsPerSet', t('คะแนนต่อเซต', 'Points per set'), 'number', !isManual || !settings.editableTeams)}
        {field('decidingSetPoints', t('คะแนนเซตตัดสิน', 'Deciding set points'), 'number', !isManual || !settings.editableTeams)}
        <label className="smm-ack"><input type="checkbox" disabled={teamsDisabled} checked={draft.has_challenge} onChange={event => onChange({ ...draft, has_challenge: event.target.checked })}/>{t('ใช้ Challenge', 'Enable Challenge')}</label>
    </div></section>;
    if (tab === 'roster' || tab === 'staff') return <><p className="smm-hint">{t('การเปลี่ยนแปลงมีผลเฉพาะแมตซ์นี้', 'Changes apply only to this match.')}{!settings.editableTeams && ` · ${t('เริ่มแข่งขันแล้ว รายชื่อถูกล็อก', 'Match started; rosters are locked.')}`}</p><div className="smm-teams">{['home', 'away'].map(side => <section key={side} style={{ borderTop: `3px solid ${draft[side].color || (side === 'home' ? '#6366f1' : '#f43f5e')}` }}>
        <h3>{side === 'home' ? t('ทีมเจ้าบ้าน (*)', 'Home team (*)') : t('ทีมเยือน (a)', 'Away team (a)')}{draft[side].name && ` · ${draft[side].name}`}</h3>
        {tab === 'roster' ? <>
            <label className="smm-field">{t('ชื่อทีมที่แสดง', 'Team display name')}<input disabled={teamsDisabled} value={draft[side].name} onChange={event => teamChange(side, { name: event.target.value })}/></label>
            <label className="smm-field">{t('ชื่อย่อ', 'Team code')}<input disabled={teamsDisabled} value={draft[side].code} onChange={event => teamChange(side, { code: event.target.value })}/></label>
            <div className="smm-shirt-options">{[
                { key: 'color', label: t('สีเสื้อทีม', 'Team shirt color'), fallback: side === 'home' ? '#6366f1' : '#f43f5e' },
                { key: 'liberoColor', label: t('สีเสื้อลิเบอโร', 'Libero shirt color'), fallback: side === 'home' ? '#facc15' : '#3b82f6' },
            ].map(({ key, label, fallback }) => {
                const selected = draft[side][key] || fallback;
                return <div key={key}>
                    <label className="smm-field">{ui(label)}<span className="smm-shirt-color"><input type="color" aria-label={`${label} ${draft[side].name}`} value={selected} disabled={teamsDisabled} onChange={event => teamChange(side, { [key]: event.target.value })}/><span>{selected.toUpperCase()}</span></span></label>
                    <div className="smm-shirt-palette" role="group" aria-label={`${label} ${draft[side].name}`}>
                        {shirtColors.map(color => <GuardedButton type="button" key={color} aria-label={`${label} ${color}`} aria-pressed={selected.toLowerCase() === color} disabled={teamsDisabled} style={{ backgroundColor: color }} onClick={() => teamChange(side, { [key]: color })}/>)}
                    </div>
                </div>;
            })}</div>
            <p>{t('ผู้เล่น', 'Players')} {draft[side].players.length} · {t('ลิเบอโร', 'Liberos')} {draft[side].players.filter(p => p.role.startsWith('L')).length} · {t('กัปตัน', 'Captain')} {draft[side].players.find(p => p.role.includes('C'))?.number || '–'}</p>
            <div className="smm-scroll"><table><thead><tr>{[t('เบอร์', 'No.'), t('ชื่อ', 'First name'), t('นามสกุล', 'Last name'), t('ตำแหน่ง', 'Position'), 'L', 'C', ''].map((label, i) => <th key={i}>{ui(label)}</th>)}</tr></thead><tbody>{draft[side].players.map((p, index) => <tr key={p.id}>
                {['number', 'first_name', 'last_name'].map(key => <td key={key} className={key === 'number' ? 'smm-player-number' : undefined}><input aria-label={`${draft[side].name} ${key} ${index + 1}`} type={key === 'number' ? 'number' : 'text'} disabled={teamsDisabled} value={p[key]} onChange={event => updateRow(side, 'players', index, key, event.target.value)}/></td>)}
                <td><select aria-label={`${t('ตำแหน่ง', 'Position')} ${p.number}`} disabled={teamsDisabled || p.role.startsWith('L')} value={p.role.startsWith('L') ? 'L' : p.position || ''} onChange={event => updateRow(side, 'players', index, 'position', event.target.value)}>{['', 'S', 'OH', 'MB', 'OPP', 'L'].map(position => <option key={position} value={position} disabled={position === 'L'}>{position || '–'}</option>)}</select></td>
                <td><input type="checkbox" aria-label={`${t('ลิเบอโร', 'Libero')} ${p.number}`} disabled={teamsDisabled} checked={p.role.startsWith('L')} onChange={event => updateRole(side, index, event.target.checked, p.role.includes('C'))}/></td>
                <td><input type="checkbox" aria-label={`${t('กัปตัน', 'Captain')} ${p.number}`} disabled={teamsDisabled} checked={p.role.includes('C')} onChange={event => updateRole(side, index, p.role.startsWith('L'), event.target.checked)}/></td>
                <td><GuardedButton type="button" disabled={teamsDisabled} aria-label={`${t('นำออก', 'Remove')} ${displayNames.personName(p)}`} onClick={() => teamChange(side, { players: draft[side].players.filter((_, i) => i !== index) })}><UiX size={16} aria-hidden="true" className="inline-block shrink-0 align-middle" /></GuardedButton></td>
            </tr>)}</tbody></table></div>
            <label className="smm-field">{t('เพิ่มนักกีฬาจากรายชื่อทีม', 'Add a registered player')}<select value="" disabled={teamsDisabled} onChange={event => {
                const p = settings.available[side].find(player => String(player.id) === event.target.value);
                if (p) teamChange(side, { players: [...draft[side].players, { id: p.id, number: p.number || '', first_name: p.first_name || '', last_name: p.last_name || '', role: '' }] });
            }}><option value="">{t('เลือกนักกีฬา', 'Select player')}</option>{settings.available[side].filter(p => !draft[side].players.some(row => Number(row.id) === Number(p.id))).map(p => <option key={p.id} value={p.id}>#{p.number} {displayNames.personName(p)}</option>)}</select></label>
        </> : <>
            <div className="smm-scroll smm-staff-table"><table aria-label={`${t('เจ้าหน้าที่ทีม', 'Team staff')} ${draft[side].name}`}>
                <thead><tr>{[t('ตำแหน่ง', 'Position'), t('ชื่อ', 'First name'), t('นามสกุล', 'Last name'), t('จัดการ', 'Actions')].map(label => <th scope="col" key={label}>{ui(label)}</th>)}</tr></thead>
                <tbody>{draft[side].staff.length ? draft[side].staff.map((p, index) => <tr key={index}>
                    <td><select aria-label={`${draft[side].name} ${t('ตำแหน่ง', 'Position')} ${index + 1}`} disabled={teamsDisabled} value={p.role} onChange={event => updateRow(side, 'staff', index, 'role', event.target.value)}>
                        <option value="">{t('เลือกตำแหน่ง', 'Select position')}</option>
                        {p.role && !staffRoles.some(([value]) => value === p.role) && <option value={p.role}>{ui(p.role)}</option>}
                        {staffRoles.map(([value, label]) => <option key={value} value={value}>{t(label, value)}</option>)}
                    </select></td>
                    {['first_name', 'last_name'].map((key, i) => <td key={key}><input type="text" aria-label={`${draft[side].name} ${[t('ชื่อ', 'First name'), t('นามสกุล', 'Last name')][i]} ${index + 1}`} disabled={teamsDisabled} value={p[key]} onChange={event => updateRow(side, 'staff', index, key, event.target.value)}/></td>)}
                    <td><GuardedButton type="button" disabled={teamsDisabled} aria-label={`${t('นำออก', 'Remove')} ${displayNames.personName(p) || index + 1}`} onClick={() => teamChange(side, { staff: draft[side].staff.filter((_, i) => i !== index) })}>{t('นำออก', 'Remove')}</GuardedButton></td>
                </tr>) : <tr><td colSpan={4}>{t('ยังไม่มีเจ้าหน้าที่ทีม', 'No team staff added.')}</td></tr>}</tbody>
            </table></div>
            <GuardedButton type="button" disabled={teamsDisabled} onClick={() => teamChange(side, { staff: [...draft[side].staff, { role: '', first_name: '', last_name: '' }] })}>+ {t('เพิ่มเจ้าหน้าที่ทีม', 'Add team staff')}</GuardedButton>
        </>}
    </section>)}</div></>;
    if (tab === 'officials') return <div className="smm-form-grid">{[
        ['referee_1_id', t('ผู้ตัดสินที่ 1', 'First referee'), 'referees'], ['referee_2_id', t('ผู้ตัดสินที่ 2', 'Second referee'), 'referees'], ['scorer_id', t('ผู้บันทึกคะแนน', 'Scorer'), 'scorers'],
        ...[1,2,3,4].map(n => [`line_judge_${n}_id`, `${t('ผู้กำกับเส้น', 'Line judge')} ${n}`, 'lineJudges'])
    ].map(([key, label, list]) => <label key={key} className="smm-field">{ui(label)}<select disabled={disabled} value={draft[key]} onChange={event => onChange({ ...draft, [key]: event.target.value })}><option value="">{t('ยังไม่ระบุ', 'Not assigned')}</option>{settings.officials[list].map(p => <option key={p.id} value={p.id}>{displayNames.personFirstName(p)} {displayNames.personLastName(p)}</option>)}</select></label>)}</div>;
    return null;
}
