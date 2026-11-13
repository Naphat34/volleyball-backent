import { GuardedForm, GuardedButton } from '../ui/GuardedAction';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, Eye, Loader2, X } from 'lucide-react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import useDisplayNames from '../../hooks/useDisplayNames';
import { groupPublicCompetitions, findCompetitionGroupById, getPublicCompetitionVariantLabel } from '../../utils/scorer/publicCompetitionGrouping';
import { compositionPlayers, compositionStaff } from '../../utils/reports/compositionRoster';
import O2FormDocument from './O2FormDocument';

const categoryKey = row => `${row.competition_id}:${row.age_group_id || ''}:${row.gender || ''}`;
const safeName = value => String(value || 'TEAM').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');

export default function AdminTeamCompositionReport() {
    const { language } = useLanguage();
    const names = useDisplayNames();
    const t = (th, en) => language === 'ENG' ? en : th;
    const [entries, setEntries] = useState([]);
    const [competition, setCompetition] = useState('');
    const [category, setCategory] = useState('');
    const [entryId, setEntryId] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [preview, setPreview] = useState('');
    const [retry, setRetry] = useState(0);
    const [leg, setLeg] = useState(1), [revision, setRevision] = useState(1);
    const [showLeg, setShowLeg] = useState(true);
    const [referenceDate, setReferenceDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
    const form = useRef(null);
    const mounted = useRef(true);

    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError('');
        api.getTeamCompositionEntries().then(response => {
            if (!Array.isArray(response.data)) throw Error('Invalid team entry response');
            if (!cancelled) setEntries(response.data);
        }).catch(failure => { if (!cancelled) setError(failure.response?.data?.error || 'Could not load registered teams'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [retry]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const groups = useMemo(() => groupPublicCompetitions([...new Map(entries.map(row => [row.competition_id, { ...row, id: row.competition_id }])).values()], language), [entries, language]);
    const selectedGroup = findCompetitionGroupById(groups, competition);
    const groupIds = new Set((selectedGroup?.items || []).map(row => String(row.id)));
    const groupEntries = entries.filter(row => groupIds.has(String(row.competition_id)));
    const categories = [...new Map(groupEntries.map(row => [categoryKey(row), row])).values()];
    const availableTeams = groupEntries.filter(row => categoryKey(row) === category);
    const clearOutput = () => { setResult(null); setPreview(''); setError(''); };
    const generate = async showPreview => {
        if (busy || !entryId || !form.current.reportValidity()) return;
        setBusy(true); setError(''); setResult(null); setPreview('');
        try {
            // Fetch at export time so a changed registration is never served from a stale cache.
            const response = await api.getTeamCompositionReport(entryId);
            const data = response.data;
            if (!data?.teamInfo || String(data.teamInfo.team_entry_id) !== entryId || !Array.isArray(data.players) || !Array.isArray(data.staff)) throw Error('Invalid team composition response');
            const metadata = data.teamInfo;
            const genderEn = ({ Male: 'Men', Female: 'Women', Mixed: 'Mixed' })[metadata.entry_gender] || metadata.entry_gender;
            const genderTh = ({ Male: 'ชาย', Female: 'หญิง', Mixed: 'ผสม' })[metadata.entry_gender] || metadata.entry_gender;
            const teamInfo = { ...metadata, leg, show_leg: showLeg, revision, reference_date: referenceDate,
                competition_name_en: metadata.competition_name_en ? [metadata.competition_name_en, metadata.age_group_name, genderEn].filter(Boolean).join(' · ') : '',
                competition_name_th: metadata.competition_name_th ? [metadata.competition_name_th, metadata.age_group_name, genderTh].filter(Boolean).join(' · ') : '',
            };
            const roster = { team_entry_id: Number(entryId) };
            const players = compositionPlayers(roster, data);
            const staff = compositionStaff(roster, data);
            const blob = await pdf(<O2FormDocument teamInfo={teamInfo} players={players} staff={staff} printedAt={new Date().toISOString()} />).toBlob();
            if (!mounted.current) return;
            const url = URL.createObjectURL(blob);
            setResult({ players: players.length, staff: staff.length, staffSource: data.staff_source });
            if (showPreview) setPreview(url);
            else {
                const link = document.createElement('a'); link.href = url;
                link.download = `${safeName(metadata.code || names.teamName(metadata))}_Team_composition_${entryId}.pdf`;
                document.body.appendChild(link); link.click(); link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch (failure) { if (mounted.current) setError(failure.response?.data?.error || failure.message || 'Could not generate PDF'); }
        finally { if (mounted.current) setBusy(false); }
    };
    const selectClass = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
    return <div className="mt-4 space-y-4 border-t pt-4">
        <p className="text-sm text-gray-500">{t('ใช้รายชื่อนักกีฬา เบอร์เสื้อ บทบาท และเจ้าหน้าที่ที่ลงทะเบียนในประเภทแข่งขันนั้น รวมรายการที่ปิดรับสมัครแล้ว', 'Uses players, shirt numbers, roles and officials registered for the selected category, including closed competitions.')}</p>
        {loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} />{t('กำลังโหลดทีมที่ลงทะเบียน…', 'Loading registered teams…')}</p> : <>
            {!entries.length && !error && <p>{t('ยังไม่มีทีมลงทะเบียนแข่งขัน', 'No registered teams found.')}</p>}
            <GuardedForm ref={form} onSubmit={event => { event.preventDefault(); generate(false); }}>
                <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
                    <div className="grid gap-4 md:grid-cols-3">
                        <label className="text-sm font-medium">{t('รายการแข่งขัน', 'Competition')}<select required className={selectClass} value={competition} onChange={event => { setCompetition(event.target.value); setCategory(''); setEntryId(''); clearOutput(); }}><option value="">{t('เลือกรายการแข่งขัน', 'Select competition')}</option>{groups.map(group => <option key={group.key} value={group.items[0].id}>{group.title}</option>)}</select></label>
                        <label className="text-sm font-medium">{t('รุ่นและประเภททีม', 'Age group & gender')}<select required disabled={!competition} className={selectClass} value={category} onChange={event => { setCategory(event.target.value); setEntryId(''); clearOutput(); }}><option value="">{t('เลือกประเภทแข่งขัน', 'Select category')}</option>{categories.map(row => <option key={categoryKey(row)} value={categoryKey(row)}>{getPublicCompetitionVariantLabel(row, language)}</option>)}</select></label>
                        <label className="text-sm font-medium">{t('ทีมที่ลงทะเบียน', 'Registered team')}<select required disabled={!category} className={selectClass} value={entryId} onChange={event => { setEntryId(event.target.value); clearOutput(); }}><option value="">{t('เลือกทีม', 'Select team')}</option>{availableTeams.map(row => <option key={row.team_entry_id} value={row.team_entry_id}>{names.linkedTeamName(row) || row.team_code} · {row.team_code} ({row.status})</option>)}</select></label>
                    </div>
                    <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={showLeg} onChange={event => { setShowLeg(event.target.checked); clearOutput(); }} />{t('แสดง Leg', 'Show Leg')}</label><input aria-label={t('หมายเลข Leg', 'Leg number')} required={showLeg} disabled={!showLeg} type="number" min="1" max="99" value={leg} onChange={event => { setLeg(event.target.value); clearOutput(); }} className={`${selectClass} disabled:opacity-50`} /></div>
                        <label className="text-sm">{t('ฉบับแก้ไข', 'Revision')}<input required type="number" min="1" max="999" value={revision} onChange={event => { setRevision(event.target.value); clearOutput(); }} className={selectClass} /></label>
                        <label className="text-sm">{t('วันที่อ้างอิง', 'Reference date')}<input required type="date" value={referenceDate} onChange={event => { setReferenceDate(event.target.value); clearOutput(); }} className={selectClass} /></label>
                    </div>
                    <div className="ac-row-actions"><GuardedButton type="submit" disabled={!entryId || busy}><Download size={15} />{busy ? t('กำลังสร้าง PDF…', 'Generating PDF…') : t('ดาวน์โหลด PDF', 'Download PDF')}</GuardedButton><GuardedButton type="button" disabled={!entryId || busy} onClick={() => generate(true)}><Eye size={15} />{t('ดูตัวอย่าง PDF', 'Preview PDF')}</GuardedButton></div>
                </fieldset>
            </GuardedForm>
        </>}
        {error && <div role="alert" className="ac-alert">{t('ไม่สามารถโหลดหรือสร้างรายงานได้', 'Could not load or generate report')}: {error}{!entries.length && <GuardedButton type="button" className="ml-3 underline" onClick={() => setRetry(previous => previous + 1)}>{t('ลองใหม่', 'Retry')}</GuardedButton>}</div>}
        {result && <p role="status" className="text-sm text-gray-500">{t(`นักกีฬา ${result.players} คน · เจ้าหน้าที่ ${result.staff} คน`, `${result.players} players · ${result.staff} officials`)}</p>}
        {result?.staffSource === 'team' && result.staff > 0 && <p className="text-sm text-gray-500 dark:text-gray-400">{t('ใช้รายชื่อเจ้าหน้าที่จากทะเบียนทีมที่บันทึกไว้ใน Team dashboard', 'Using officials from the team roster saved in Team dashboard.')}</p>}
        {preview && <section aria-label="Team composition PDF" className="overflow-hidden rounded-lg border"><div className="flex items-center justify-between p-2"><span className="text-sm font-semibold">Team composition</span><GuardedButton type="button" onClick={() => setPreview('')} aria-label={t('ปิดตัวอย่าง', 'Close preview')} className="p-2"><X size={18} /></GuardedButton></div><iframe title="Team composition PDF" src={preview} className="h-[70vh] w-full border-0" /></section>}
    </div>;
}
