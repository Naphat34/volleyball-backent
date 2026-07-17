import React, { useEffect, useState } from 'react';
import api from '../api';
import { Swords, Calendar, MapPin, PlayCircle, Trophy } from 'lucide-react';
import LiveMatchScorer from './LiveMatchScorer';
import { EmptyState } from './AdminShared';

export default function EScoreTab() {
    const [competitions, setCompetitions] = useState([]);
    const [matches, setMatches] = useState([]);
    const [activeMatch, setActiveMatch] = useState(null);

    // Grouping State
    const [uniqueBaseNames, setUniqueBaseNames] = useState([]);
    const [selectedBaseName, setSelectedBaseName] = useState('');
    const [filterGender, setFilterGender] = useState('');
    const [availableGenders, setAvailableGenders] = useState([]);

    const fetchCompetitions = React.useCallback(async () => {
        try {
            const res = await api.get('/admin/competitions');
            setCompetitions(res.data.filter(c => c.status?.toLowerCase() === 'open'));

            const bases = new Set();
            res.data.forEach(c => {
                const rawTitle = c.title || c.name || '';
                if (rawTitle) {
                    const base = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    bases.add(base);
                }
            });
            const sortedBases = Array.from(bases).sort();
            setUniqueBaseNames(sortedBases);

            if (sortedBases.length > 0) {
                setSelectedBaseName(sortedBases[0]);
            }
        } catch (err) {
            console.error("Fetch competitions error:", err);
        }
    }, []);

    const fetchMatches = React.useCallback(async () => {
        if (!selectedBaseName) return;
        setMatches([]);

        try {
            let targetComps = [];
            if (filterGender === 'All') {
                targetComps = competitions.filter(c => {
                    const rawTitle = c.title || c.name || '';
                    const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    return cBase === selectedBaseName;
                });
            } else {
                const targetComp = competitions.find(c => {
                    const rawTitle = c.title || c.name || '';
                    const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                    return cBase === selectedBaseName && c.gender === filterGender;
                });
                if (targetComp) targetComps = [targetComp];
            }

            if (targetComps.length === 0) return;

            const promises = targetComps.map(c => api.get(`/competitions/${c.id}/matches`));
            const results = await Promise.all(promises);

            let allMatches = [];
            results.forEach((res, index) => {
                if (res.data) {
                    const comp = targetComps[index];
                    const matchesWithInfo = res.data.map(m => ({
                        ...m,
                        competition_name: comp.title || comp.name,
                        gender: comp.gender
                    }));
                    allMatches = [...allMatches, ...matchesWithInfo];
                }
            });

            allMatches.sort((a, b) => (parseInt(a.match_number) || 0) - (parseInt(b.match_number) || 0));
            setMatches(allMatches);
        } catch (err) {
            console.error("Fetch matches error:", err);
        }
    }, [selectedBaseName, filterGender, competitions]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchCompetitions();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchCompetitions]);

    useEffect(() => {
        if (selectedBaseName && competitions.length > 0) {
            const relatedComps = competitions.filter(c => {
                const rawTitle = c.title || c.name || '';
                const cBase = rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
                return cBase === selectedBaseName;
            });

            const genders = [...new Set(relatedComps.map(c => c.gender))].filter(Boolean).sort();

            const timeout = setTimeout(() => {
                setAvailableGenders(['All', ...genders]);
                if (!filterGender || (filterGender !== 'All' && !genders.includes(filterGender))) {
                    setFilterGender('All');
                }
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [selectedBaseName, competitions, filterGender]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchMatches();
        }, 0);
        return () => clearTimeout(timeout);
    }, [fetchMatches]);

    // ถ้ามีการเลือกแมตช์ ให้แสดงหน้าจอ Live Scorer (แบบ Full Screen Overlay)
    if (activeMatch) {
        return (
            <LiveMatchScorer
                match={activeMatch}
                onClose={() => { setActiveMatch(null); fetchMatches(); }}
                isReadOnly={activeMatch.status === 'completed'} // ส่ง prop isReadOnly ถ้าแมตช์จบแล้ว
            />
        );
    }

    return (
        <div className="min-h-screen p-6 transition-colors duration-200 bg-gray-50 text-gray-800">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Swords className="text-blue-600" /> E-Score Console
                </h1>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="w-full md:w-64">
                        <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Competition</label>
                        <select
                            className="w-full p-2 rounded-lg border shadow-sm focus:ring-2 focus:ring-blue-500 bg-white border-gray-300"
                            value={selectedBaseName}
                            onChange={(e) => setSelectedBaseName(e.target.value)}
                        >
                            {uniqueBaseNames.length === 0 && <option value="">Loading...</option>}
                            {uniqueBaseNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase mb-1 text-gray-500">Gender</label>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {availableGenders.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setFilterGender(g)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${filterGender === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 rounded-md shadow-sm border bg-white border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Trophy size={20} className="text-yellow-500" /> Select Match to Record
                </h3>

                <div className="space-y-3">
                    {matches.length === 0 ? (
                        <EmptyState text="No matches found in this competition." />
                    ) : (
                        matches.map(m => {
                            const isCompleted = m.status === 'completed';
                            return (
                                <div key={m.id} className="p-4 rounded-md border flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:shadow-md bg-white border-gray-200 hover:bg-gray-50">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-indigo-700">#{m.match_number || '-'}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${m.gender === 'Female'
                                                    ? 'bg-pink-100 text-pink-700'
                                                    : m.gender === 'Male' ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-purple-100 text-purple-700'
                                                }`}>{m.gender}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{isCompleted ? 'Finished' : 'Scheduled'}</span>
                                        </div>
                                        <div className="text-lg font-bold flex items-center gap-3"><span className={m.home_set_score > m.away_set_score ? 'text-green-600' : ''}>{m.home_team}</span><span className="text-gray-400 text-sm">VS</span><span className={m.away_set_score > m.home_set_score ? 'text-green-600' : ''}>{m.away_team}</span></div>
                                        <div className="text-sm text-gray-500 flex items-center gap-4 mt-1"><span className="flex items-center gap-1"><Calendar size={14} /> {m.start_time ? new Date(m.start_time).toLocaleString() : 'TBD'}</span><span className="flex items-center gap-1"><MapPin size={14} /> {m.location || '-'}</span></div>
                                    </div>
                                    <button
                                        onClick={() => setActiveMatch(m)}
                                        className={`px-5 py-2.5 rounded-md font-medium flex items-center gap-2 transition-colors ${isCompleted ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                    >
                                        <PlayCircle size={20} /> {isCompleted ? 'View Record' : 'Start Recording'}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
