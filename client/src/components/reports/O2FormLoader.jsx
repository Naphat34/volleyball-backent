import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import React, { useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink, PDFViewer, BlobProvider } from '@react-pdf/renderer';
import { Eye, FileDown, Loader2, Printer, X } from 'lucide-react';
import { api } from '../../api';
import O2FormDocument from './O2FormDocument';
import { compositionPlayers, compositionStaff, compositionRosterReady } from '../../utils/reports/compositionRoster';

const GENDER_ORDER = { Male: 1, Female: 2 };

const normalizeGender = (value) => {
    const gender = String(value || '').trim().toLowerCase();
    if (['male', 'men', 'm', 'ชาย'].includes(gender)) return 'Male';
    if (['female', 'women', 'w', 'f', 'หญิง'].includes(gender)) return 'Female';
    return '';
};

const getGenderLabel = (value) => {
    const gender = normalizeGender(value);
    if (gender === 'Male') return 'ชาย';
    if (gender === 'Female') return 'หญิง';
    return 'ไม่ระบุประเภท';
};

const getGenderFileLabel = (value) => {
    const gender = normalizeGender(value);
    if (gender === 'Male') return 'Male';
    if (gender === 'Female') return 'Female';
    return 'Category';
};

const cleanCompetitionTitle = (competition) => {
    const title = String(competition?.title || competition?.name || 'Competition').trim();
    return title
        .replace(/\s*\((male|female|men|women|ชาย|หญิง)\)\s*$/i, '')
        .replace(/\s*-\s*(male|female|men|women|ชาย|หญิง)\s*$/i, '')
        .trim();
};

const getAgeGroupLabel = (competition) => (
    competition?.age_group_name || competition?.age_group || ''
);

const getAgeGroupId = (competition) => (
    competition?.entry_age_group_id !== undefined && competition?.entry_age_group_id !== null
        ? String(competition.entry_age_group_id)
        : competition?.age_group_id !== undefined && competition?.age_group_id !== null
            ? String(competition.age_group_id)
            : ''
);

const resolveAgeGroupName = (competition, ageGroupNameMap) => (
    getAgeGroupLabel(competition) || ageGroupNameMap.get(getAgeGroupId(competition)) || ''
);

const buildGroupLabel = (title, ageGroupName) => (
    ageGroupName ? `${title} - ${ageGroupName}` : title
);

const sanitizeFileName = (value) => (
    String(value || 'TEAM').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
);

const O2FormLoader = ({ teamInfo, players = [], staff = [], myCompetitions = [] }) => {
    const displayNames = useDisplayNames();
    const ui = useUiTranslation();
    const [selectedGroupKey, setSelectedGroupKey] = useState('');
    const [previewForm, setPreviewForm] = useState(null);
    const [entryRosterById, setEntryRosterById] = useState({});
    const [rosterLoading, setRosterLoading] = useState(false);
    const [rosterError, setRosterError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [ageGroups, setAgeGroups] = useState([]);
    const [leg, setLeg] = useState(1);
    const [showLeg, setShowLeg] = useState(true);
    const [revision, setRevision] = useState(1);
    const [referenceDate, setReferenceDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }));
    const [printedAt] = useState(() => new Date().toISOString());

    useEffect(() => {
        let cancelled = false;
        const loadAgeGroups = async () => {
            try {
                const response = await api.getAllAgeGroups();
                if (!cancelled) setAgeGroups(response.data || []);
            } catch (error) {
                console.error('Load age groups failed:', error);
            }
        };

        loadAgeGroups();
        return () => {
            cancelled = true;
        };
    }, []);

    const ageGroupNameMap = useMemo(() => (
        new Map((ageGroups || []).map((ag) => [String(ag.id), ag.name]))
    ), [ageGroups]);

    const competitionGroups = useMemo(() => {
        const groups = new Map();

        myCompetitions.forEach((competition) => {
            const title = cleanCompetitionTitle({ ...competition, title: displayNames.competitionName(competition) });
            const ageGroupId = getAgeGroupId(competition);
            const key = `${title.toLowerCase()}__${ageGroupId}`;
            const ageGroupName = resolveAgeGroupName(competition, ageGroupNameMap);

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    title,
                    ageGroupName,
                    label: buildGroupLabel(title, ageGroupName),
                    items: [],
                });
            }

            groups.get(key).items.push(competition);
        });

        return Array.from(groups.values())
            .map((group) => ({
                ...group,
                items: group.items.sort((a, b) => {
                    const genderA = normalizeGender(a.gender || a.competition_gender || a.entry_gender);
                    const genderB = normalizeGender(b.gender || b.competition_gender || b.entry_gender);
                    return (GENDER_ORDER[genderA] || 99) - (GENDER_ORDER[genderB] || 99);
                }),
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'th'));
    }, [myCompetitions, ageGroupNameMap, displayNames]);

    useEffect(() => {
        if (competitionGroups.length === 1 && !selectedGroupKey) {
            setSelectedGroupKey(competitionGroups[0].key);
        }
    }, [competitionGroups, selectedGroupKey]);

    useEffect(() => {
        if (selectedGroupKey && !competitionGroups.some((group) => group.key === selectedGroupKey)) {
            setSelectedGroupKey('');
        }
    }, [competitionGroups, selectedGroupKey]);

    const selectedGroup = competitionGroups.find((group) => group.key === selectedGroupKey);

    useEffect(() => {
        let cancelled = false;

        const loadEntryRosters = async () => {
            setEntryRosterById({});
            setRosterError(false);
            if (!selectedGroup) { setRosterLoading(false); return; }

            const missingEntries = selectedGroup.items.filter(
                (competition) => competition.team_entry_id
            );

            if (missingEntries.length === 0) { setRosterLoading(false); return; }

            setRosterLoading(true);
            try {
                const results = await Promise.all(
                    missingEntries.map(async (competition) => {
                        const [playerResponse, staffResponse] = await Promise.all([
                            api.getMyTeamEntryPlayers(competition.team_entry_id),
                            api.getMyTeamEntryStaff(competition.team_entry_id),
                        ]);
                        if (!Array.isArray(playerResponse.data?.players) || !Array.isArray(staffResponse.data?.staff)) throw new Error('Invalid composition roster response');
                        return [competition.team_entry_id, { players: playerResponse.data.players, staff: staffResponse.data.report_staff || staffResponse.data.staff, staff_source: staffResponse.data.staff_source }];
                    })
                );

                if (!cancelled) {
                    setEntryRosterById((current) => ({
                        ...current,
                        ...Object.fromEntries(results),
                    }));
                }
            } catch (error) {
                console.error('Load team composition roster failed:', error);
                if (!cancelled) setRosterError(true);
            } finally {
                if (!cancelled) setRosterLoading(false);
            }
        };

        loadEntryRosters();

        return () => {
            cancelled = true;
        };
    }, [selectedGroup, players, staff, retryCount]);

    useEffect(() => { setPreviewForm(null); }, [selectedGroup, players, staff, leg, showLeg, revision, referenceDate]);

    const buildFormData = (competition) => {
        const gender = normalizeGender(competition.gender || competition.competition_gender || competition.entry_gender);
        const ageGroupName = resolveAgeGroupName(competition, ageGroupNameMap);
        const competitionName = [
            cleanCompetitionTitle({ ...competition, title: displayNames.competitionName(competition) }),
            ageGroupName,
            gender === 'Male' ? 'MEN' : gender === 'Female' ? 'WOMEN' : '',
        ].filter(Boolean).join(' - ');

        return {
            key: `${competition.id}_${competition.team_entry_id || 'entry'}_${gender}`,
            gender,
            genderLabel: getGenderLabel(gender),
            rosterReady: !rosterLoading && !rosterError && compositionRosterReady(competition, entryRosterById[competition.team_entry_id]),
            teamInfo: {
                ...teamInfo,
                name: teamInfo?.name || '',
                code: teamInfo?.code || '',
                competition_name: competitionName,
                competition_name_en: competition.name_en || competition.title_en || '',
                competition_name_th: competition.name_th || competition.title_th || '',
                association_logo_url: competition.association_logo_url || teamInfo?.association_logo_url || '',
                association_name: competition.association_name || teamInfo?.association_name || '',
                leg, show_leg: showLeg, revision, reference_date: referenceDate, printed_at: printedAt,
                competition_logo_url: competition.logo_url || competition.competition_logo_url || competition.logo || '',
            },
            players: compositionPlayers(competition, entryRosterById[competition.team_entry_id], players),
            staff: compositionStaff(competition, entryRosterById[competition.team_entry_id], staff),
            staffSource: entryRosterById[competition.team_entry_id]?.staff_source,
        };
    };

    const selectedForms = selectedGroup?.items.map(buildFormData) || [];
    const pdfKey = JSON.stringify(selectedForms);

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <FileDown className="text-red-600" />{ui("Download Team composition")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{ui("สร้างเอกสาร Team composition แยกประเภทชายและหญิงสำหรับทีม ")}<strong>{displayNames.teamName(teamInfo)}</strong>
            </p>

            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">{ui("เลือกรายการแข่งขัน")}</label>
                <select
                    value={selectedGroupKey}
                    onChange={(event) => setSelectedGroupKey(event.target.value)}
                    className="w-full max-w-md px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 outline-none"
                >
                    <option value="">{ui("-- เลือกรายการแข่งขัน --")}</option>
                    {competitionGroups.map((group) => (
                        <option key={group.key} value={group.key}>
                            {ui(group.label)}
                        </option>
                    ))}
                </select>
                {!selectedGroupKey && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{ui("* กรุณาเลือกรายการแข่งขันเพื่อสร้าง Team composition")}</p>
                )}
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 max-w-xl">
                <div className="text-sm text-gray-700 dark:text-gray-200"><label className="flex items-center gap-2"><input type="checkbox" checked={showLeg} onChange={event => setShowLeg(event.target.checked)} />{ui('ช่วงการแข่งขัน (Leg)')}</label><input aria-label={ui('หมายเลข Leg')} disabled={!showLeg} type="number" min="1" max="99" value={leg} onChange={event => setLeg(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} className="mt-1 block w-full rounded border p-2 bg-white disabled:opacity-50 dark:bg-gray-700" /></div>
                <label className="text-sm text-gray-700 dark:text-gray-200">{ui('ฉบับแก้ไข')}<input type="number" min="1" max="999" value={revision} onChange={event => setRevision(Math.max(1, Math.min(999, Number(event.target.value) || 1)))} className="mt-1 block w-full rounded border p-2 bg-white dark:bg-gray-700" /></label>
                <label className="text-sm text-gray-700 dark:text-gray-200">{ui('วันที่อ้างอิงเอกสาร')}<input type="date" required value={referenceDate} onChange={event => { if (event.target.value) setReferenceDate(event.target.value); }} className="mt-1 block w-full rounded border p-2 bg-white dark:bg-gray-700" /></label>
            </div>
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">{ui('อายุคำนวณจากปีอ้างอิง ลบปีเกิด ช่องภาษาอังกฤษใช้ชื่อที่ลงทะเบียนไว้')}</p>
            {rosterError && <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {ui('โหลดรายชื่อนักกีฬาหรือเจ้าหน้าที่ไม่สำเร็จ กรุณาลองใหม่ก่อนสร้างเอกสาร')}
                <button type="button" className="ml-3 underline font-semibold" onClick={() => setRetryCount(count => count + 1)}>{ui('ลองใหม่')}</button>
            </div>}
            {rosterLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                    <Loader2 className="animate-spin" size={16} />{ui("กำลังโหลดรายชื่อนักกีฬาตามรุ่นแข่งขัน...")}</div>
            )}

            {selectedGroup && (
                <div className="grid gap-3 md:grid-cols-2">
                    {selectedForms.map((form) => {
                        const fileName = `${sanitizeFileName(form.teamInfo.code || displayNames.teamName(teamInfo))}_Team_composition_${getGenderFileLabel(form.gender)}.pdf`;

                        return (
                            <div key={form.key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                                <div className="mb-3">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{ui("Team composition ประเภท ")}{ui(form.genderLabel)}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {form.rosterReady ? ui(`นักกีฬา {0} คน`, [form.players.length]) : ui('กำลังเตรียมรายชื่อนักกีฬา')}
                                    </p>
                                </div>
                                {form.staffSource === 'team' && form.staff.length > 0 && <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{ui('ใช้รายชื่อเจ้าหน้าที่จากทะเบียนทีมที่บันทึกไว้ใน Team dashboard')}</p>}
                                <div className="flex flex-wrap gap-3">
                                    <PDFDownloadLink
                                        key={`dl-${pdfKey}_${form.key}`}
                                        document={<O2FormDocument teamInfo={form.teamInfo} players={form.players} staff={form.staff} />}
                                        fileName={fileName}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold shadow-md dark:shadow-none ${form.rosterReady
                                            ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'
                                            : 'bg-gray-300 text-gray-500 pointer-events-none shadow-none'
                                            }`}
                                    >
                                        {({ loading }) => (
                                            !form.rosterReady ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />{ui("Loading...")}</>
                                            ) : loading ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />{ui("Generating...")}</>
                                            ) : (
                                                <>
                                                    <FileDown size={18} />{ui("Download")}</>
                                            )
                                        )}
                                    </PDFDownloadLink>
                                    <button
                                        onClick={() => setPreviewForm(form)}
                                        disabled={!form.rosterReady}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold shadow-md dark:shadow-none ${form.rosterReady
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                            }`}
                                    >
                                        <Eye size={18} />{ui("Preview")}</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {previewForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-10">
                    <div className="bg-white dark:bg-gray-800 w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                                <Eye className="text-indigo-500" />{' '}{ui("Preview Team composition ประเภท ")}{ui(previewForm.genderLabel)}
                            </h3>
                            <div className="flex items-center gap-3">
                                <BlobProvider
                                    key={`print-${pdfKey}_${previewForm.key}`}
                                    document={<O2FormDocument teamInfo={previewForm.teamInfo} players={previewForm.players} staff={previewForm.staff} />}
                                >
                                    {({ url, loading }) => (
                                        <button
                                            onClick={() => {
                                                if (url) {
                                                    const printWindow = window.open(url, '_blank');
                                                    if (printWindow) printWindow.print();
                                                }
                                            }}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-sm shadow-md disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}{ui("Print Team composition")}</button>
                                    )}
                                </BlobProvider>
                                <button
                                    onClick={() => setPreviewForm(null)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <X size={24} className="text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <PDFViewer width="100%" height="100%" className="border-none shadow-inner">
                                <O2FormDocument teamInfo={previewForm.teamInfo} players={previewForm.players} staff={previewForm.staff} />
                            </PDFViewer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default O2FormLoader;

