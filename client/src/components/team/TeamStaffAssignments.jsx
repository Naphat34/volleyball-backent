import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import useDisplayNames from '../../hooks/useDisplayNames';
import { getPublicCompetitionVariantLabel } from '../../utils/scorer/publicCompetitionGrouping';
import EntryStaffSelector from './EntryStaffSelector';

export default function TeamStaffAssignments({ competitions = [], onSaved = () => {} }) {
    const { language } = useLanguage(), names = useDisplayNames();
    const t = (th, en) => language === 'ENG' ? en : th;
    const [entryId, setEntryId] = useState('');
    const entries = [...new Map(competitions.filter(row => row.team_entry_id).map(row => [String(row.team_entry_id), row])).values()];
    return <section className="official-panel mb-6 overflow-hidden rounded-md">
        <header className="official-panel-header px-6 py-4"><h3 className="font-semibold">{t('กำหนดเจ้าหน้าที่ประจำรายการ', 'Assign entry officials')}</h3></header>
        <div className="space-y-4 p-4 sm:p-6">
            <p className="text-sm text-gray-500">{t('เลือกประเภทแข่งขันของทีม แล้วกำหนดเจ้าหน้าที่สำหรับใช้ใน Team composition', 'Select your team’s competition category and assign officials for Team composition.')}</p>
            <label className="block text-sm font-medium">{t('รายการแข่งขัน / รุ่น / ประเภททีม', 'Competition / age group / gender')}
                <select value={entryId} onChange={event => setEntryId(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-600 dark:bg-gray-800">
                    <option value="">{t('เลือกประเภทแข่งขันที่ทีมลงทะเบียน', 'Select a registered competition category')}</option>
                    {entries.map(row => <option key={row.team_entry_id} value={row.team_entry_id}>{names.competitionName(row)} · {getPublicCompetitionVariantLabel({ ...row, gender: row.entry_gender || row.gender || row.competition_gender }, language)}</option>)}
                </select>
            </label>
            {!entries.length && <p className="text-sm text-gray-500">{t('ทีมยังไม่ได้ลงทะเบียนแข่งขัน', 'Your team has no registered competition entries.')}</p>}
            {entries.some(row => String(row.team_entry_id) === entryId) && <EntryStaffSelector key={entryId} entryId={entryId} onSaved={onSaved} />}
        </div>
    </section>;
}
