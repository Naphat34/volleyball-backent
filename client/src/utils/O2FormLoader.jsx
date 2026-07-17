import React, { useEffect, useMemo, useState } from 'react';
import { PDFDownloadLink, PDFViewer, BlobProvider } from '@react-pdf/renderer';
import { Eye, FileDown, Loader2, Printer, X } from 'lucide-react';
import { api } from '../api';
import O2FormDocument from './O2FormDocument';

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
    const [selectedGroupKey, setSelectedGroupKey] = useState('');
    const [previewForm, setPreviewForm] = useState(null);
    const [entryRosterById, setEntryRosterById] = useState({});
    const [rosterLoading, setRosterLoading] = useState(false);
    const [ageGroups, setAgeGroups] = useState([]);

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
            const title = cleanCompetitionTitle(competition);
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
    }, [myCompetitions, ageGroupNameMap]);

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
            if (!selectedGroup) return;

            const missingEntries = selectedGroup.items.filter(
                (competition) => competition.team_entry_id && !entryRosterById[competition.team_entry_id]
            );

            if (missingEntries.length === 0) return;

            setRosterLoading(true);
            try {
                const results = await Promise.all(
                    missingEntries.map(async (competition) => {
                        const response = await api.getMyTeamEntryPlayers(competition.team_entry_id);
                        return [competition.team_entry_id, response.data];
                    })
                );

                if (!cancelled) {
                    setEntryRosterById((current) => ({
                        ...current,
                        ...Object.fromEntries(results),
                    }));
                }
            } catch (error) {
                console.error('Load O-2 entry roster failed:', error);
            } finally {
                if (!cancelled) setRosterLoading(false);
            }
        };

        loadEntryRosters();

        return () => {
            cancelled = true;
        };
    }, [selectedGroup, entryRosterById]);

    const buildPlayersForCompetition = (competition) => {
        const roster = entryRosterById[competition.team_entry_id];
        const gender = normalizeGender(competition.gender || competition.competition_gender || competition.entry_gender);
        const fallbackPlayers = players.filter((player) => !gender || normalizeGender(player.gender) === gender);

        if (roster?.players) {
            const selectedPlayers = roster.players
                .filter((player) => Number(player.selected) === 1)
                .map((player) => ({
                    ...player,
                    number: player.entry_number ?? player.number,
                    is_captain: player.entry_is_captain ?? player.is_captain,
                    is_libero1: player.entry_is_libero1 ?? player.is_libero1,
                    is_libero2: player.entry_is_libero2 ?? player.is_libero2,
                    is_playing: player.entry_is_playing ?? player.is_playing,
                }));

            return selectedPlayers.length > 0 ? selectedPlayers : fallbackPlayers;
        }

        return fallbackPlayers;
    };

    const buildFormData = (competition) => {
        const gender = normalizeGender(competition.gender || competition.competition_gender || competition.entry_gender);
        const ageGroupName = resolveAgeGroupName(competition, ageGroupNameMap);
        const competitionName = [
            cleanCompetitionTitle(competition),
            ageGroupName,
            gender === 'Male' ? 'MEN' : gender === 'Female' ? 'WOMEN' : '',
        ].filter(Boolean).join(' - ');

        return {
            key: `${competition.id}_${competition.team_entry_id || 'entry'}_${gender}`,
            gender,
            genderLabel: getGenderLabel(gender),
            rosterReady: !competition.team_entry_id || Boolean(entryRosterById[competition.team_entry_id]),
            teamInfo: {
                ...teamInfo,
                name: teamInfo?.name || '',
                code: teamInfo?.code || '',
                competition_name: competitionName,
            },
            players: buildPlayersForCompetition(competition),
        };
    };

    const selectedForms = selectedGroup?.items.map(buildFormData) || [];
    const pdfKey = `${selectedGroupKey}_${players.length}_${staff.length}_${JSON.stringify(teamInfo)}_${JSON.stringify(Object.keys(entryRosterById))}`;

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <FileDown className="text-red-600" /> Download O-2 Form
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                ระบบจะสร้างไฟล์ PDF ใบ O-2 แยกตามประเภทชายและหญิงสำหรับทีม <strong>{teamInfo?.name}</strong>
            </p>

            <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    เลือกรายการแข่งขัน
                </label>
                <select
                    value={selectedGroupKey}
                    onChange={(event) => setSelectedGroupKey(event.target.value)}
                    className="w-full max-w-md px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 outline-none"
                >
                    <option value="">-- เลือกรายการแข่งขัน --</option>
                    {competitionGroups.map((group) => (
                        <option key={group.key} value={group.key}>
                            {group.label}
                        </option>
                    ))}
                </select>
                {!selectedGroupKey && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        * กรุณาเลือกรายการแข่งขันเพื่อสร้างใบ O-2
                    </p>
                )}
            </div>

            {rosterLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
                    <Loader2 className="animate-spin" size={16} />
                    กำลังโหลดรายชื่อนักกีฬาตามรุ่นแข่งขัน...
                </div>
            )}

            {selectedGroup && (
                <div className="grid gap-3 md:grid-cols-2">
                    {selectedForms.map((form) => {
                        const fileName = `${sanitizeFileName(form.teamInfo.code || teamInfo?.name)}_O2_${getGenderFileLabel(form.gender)}.pdf`;

                        return (
                            <div key={form.key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                                <div className="mb-3">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        ใบ O-2 ประเภท{form.genderLabel}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {form.rosterReady ? `นักกีฬา ${form.players.length} คน` : 'กำลังเตรียมรายชื่อนักกีฬา'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <PDFDownloadLink
                                        key={`dl-${pdfKey}_${form.key}`}
                                        document={<O2FormDocument teamInfo={form.teamInfo} players={form.players} staff={staff} />}
                                        fileName={fileName}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold shadow-md dark:shadow-none ${form.rosterReady
                                            ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'
                                            : 'bg-gray-300 text-gray-500 pointer-events-none shadow-none'
                                            }`}
                                    >
                                        {({ loading }) => (
                                            !form.rosterReady ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Loading...
                                                </>
                                            ) : loading ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <FileDown size={18} />
                                                    Download
                                                </>
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
                                        <Eye size={18} />
                                        Preview
                                    </button>
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
                                <Eye className="text-indigo-500" /> Preview O-2 ประเภท{previewForm.genderLabel}
                            </h3>
                            <div className="flex items-center gap-3">
                                <BlobProvider
                                    key={`print-${pdfKey}_${previewForm.key}`}
                                    document={<O2FormDocument teamInfo={previewForm.teamInfo} players={previewForm.players} staff={staff} />}
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
                                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />}
                                            Print O-2
                                        </button>
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
                                <O2FormDocument teamInfo={previewForm.teamInfo} players={previewForm.players} staff={staff} />
                            </PDFViewer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default O2FormLoader;

