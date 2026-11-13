import { GuardedButton } from '../ui/GuardedAction';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';

export default function EntryStaffSelector({ entryId, onSaved }) {
    const { language } = useLanguage(), names = useDisplayNames(), ui = useUiTranslation();
    const t = (th, en) => language === 'ENG' ? en : th;
    const [staff, setStaff] = useState([]), [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
    const [error, setError] = useState(''), [saved, setSaved] = useState(false), [retry, setRetry] = useState(0);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError('');
        api.getMyTeamEntryStaff(entryId).then(response => {
            if (!Array.isArray(response.data?.staff) || String(response.data.entry?.id) !== String(entryId)) throw Error('Invalid staff response');
            if (!cancelled) { setStaff(response.data.staff); setSelected(response.data.staff.filter(person => Number(person.selected) === 1).map(person => Number(person.id))); }
        }).catch(failure => { if (!cancelled) setError(failure.response?.data?.error || failure.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [entryId, retry]);
    const save = async () => {
        if (saving || !selected.length) return;
        setSaving(true); setError(''); setSaved(false);
        try {
            await api.updateMyTeamEntryStaff(entryId, selected);
            if (mounted.current) { setSaved(true); onSaved(); }
        } catch (failure) { if (mounted.current) setError(failure.response?.data?.error || failure.message); }
        finally { if (mounted.current) setSaving(false); }
    };
    return <section className="rounded-lg border border-blue-200 p-4 dark:border-gray-600" aria-label={t('กำหนดเจ้าหน้าที่ประจำรายการ', 'Assign entry officials')}>
        <h4 className="font-semibold">{t('กำหนดเจ้าหน้าที่ประจำรายการ', 'Assign entry officials')}</h4>
        <p className="text-sm text-gray-500">{t('เลือกจากทะเบียนเจ้าหน้าที่ทีม แล้วบันทึกสำหรับประเภทแข่งขันที่เลือก', 'Select registered team staff and save them for the selected competition category.')}</p>
        {loading ? <p role="status">{t('กำลังโหลดเจ้าหน้าที่…', 'Loading team staff…')}</p> : <>
            {!staff.length && !error && <p>{t('ยังไม่มีเจ้าหน้าที่ในทะเบียนทีม กรุณาเพิ่มข้อมูลเจ้าหน้าที่ก่อน', 'No team staff registered. Add team staff first.')}</p>}
            <fieldset disabled={saving} className="space-y-2">{staff.map(person => <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded border p-3 text-sm"><input type="checkbox" checked={selected.includes(Number(person.id))} onChange={event => { setSelected(previous => event.target.checked ? [...previous, Number(person.id)] : previous.filter(id => id !== Number(person.id))); setSaved(false); }} /><span><strong>{names.personName(person)}</strong><span className="ml-2 text-gray-500">{ui(person.role)}</span></span></label>)}</fieldset>
            <div className="ac-row-actions mt-3"><GuardedButton type="button" onClick={save} disabled={saving || !selected.length}>{saving ? t('กำลังบันทึก…', 'Saving…') : t('บันทึกเจ้าหน้าที่ประจำรายการ', 'Save entry officials')}</GuardedButton></div>
        </>}
        {error && <p className="ac-alert" role="alert">{error}<GuardedButton type="button" className="ml-2 underline" onClick={() => setRetry(value => value + 1)}>{t('ลองใหม่', 'Retry')}</GuardedButton></p>}
        {saved && <p className="text-sm text-green-700 dark:text-green-300" role="status">{t(`บันทึกเจ้าหน้าที่ประจำรายการแล้ว ${selected.length} คน`, `${selected.length} entry officials saved.`)}</p>}
    </section>;
}
