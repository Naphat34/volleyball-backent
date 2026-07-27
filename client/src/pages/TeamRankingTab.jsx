import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Trophy, Filter, X, Calendar, Download } from 'lucide-react';
import { EmptyState } from './AdminShared';
import { formatThaiDate } from '../utils';

const ageGroupOrder = ['U12', 'U14', 'U16', 'U18', 'OPEN'];

const getCompetitionBaseName = (competition) => {
    const rawTitle = competition?.title || competition?.name || '';
    return rawTitle.replace(/\s\((Male|Female|Mix|Mixed)\)$/i, '').trim();
};

const normalizeAgeGroupName = (name) => {
    const normalized = String(name || '').trim();
    if (!normalized) return '';
    if (/^(open|senior|general)$/i.test(normalized) || normalized.includes('ประชาชน')) return 'ประชาชนทั่วไป';
    return normalized.toUpperCase();
};

const getAgeGroupKey = (competition) => String(competition?.age_group_id || competition?.entry_age_group_id || '');

const getAgeGroupLabel = (competition) => normalizeAgeGroupName(
    competition?.age_group_name || competition?.age_group || competition?.category || ''
);

const sortAgeGroups = (a, b) => {
    const aName = normalizeAgeGroupName(a.label);
    const bName = normalizeAgeGroupName(b.label);
    const aOrder = ageGroupOrder.indexOf(aName === 'ประชาชนทั่วไป' ? 'OPEN' : aName);
    const bOrder = ageGroupOrder.indexOf(bName === 'ประชาชนทั่วไป' ? 'OPEN' : bName);
    if (aOrder !== -1 || bOrder !== -1) return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
    return aName.localeCompare(bName, 'th');
};

const getDefaultMaxSetsByAgeGroup = (competition) => {
    const label = getAgeGroupLabel(competition);
    if (['U12', 'U14', 'U16'].includes(label)) return 3;
    if (label === 'U18' || label === 'ประชาชนทั่วไป') return 5;
    return 0;
};

export default function TeamRankingTab() {
    const [competitions, setCompetitions] = useState([]);
    const [uniqueBaseNames, setUniqueBaseNames] = useState([]);
    const [selectedBaseName, setSelectedBaseName] = useState('');
    const [standings, setStandings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [genderFilter, setGenderFilter] = useState('Female'); // Default Gender
    const [allMatches, setAllMatches] = useState([]); // เก็บข้อมูลแมตช์ทั้งหมดไว้ใช้แสดง History
    const [viewingHistoryTeam, setViewingHistoryTeam] = useState(null); // ทีมที่กำลังดูประวัติ
    const [resultCols, setResultCols] = useState([]); // เก็บชื่อคอลัมน์ผลการแข่งขัน (เช่น 3-0, 3-1)
    const [availableGenders, setAvailableGenders] = useState([]); // เก็บเพศที่มีในรายการนั้นๆ
    const [availableAgeGroups, setAvailableAgeGroups] = useState([]);
    const [selectedAgeGroupId, setSelectedAgeGroupId] = useState('');
    const [pools, setPools] = useState([]); // รายชื่อ Pool ทั้งหมดในรายการนี้
    const [selectedPool, setSelectedPool] = useState(''); // Pool ที่เลือกใช้งาน

    const fetchCompetitions = useCallback(async () => {
        try {
            const res = await api.getAllCompetitions();
            setCompetitions(res.data.filter(c => c.status?.toLowerCase() === 'open'));

            // จัดกลุ่มชื่อรายการ (ตัดวงเล็บเพศออก)
            const bases = new Set();
            res.data.forEach(c => {
                const base = getCompetitionBaseName(c);
                if (base) {
                    bases.add(base);
                }
            });
            const sortedBases = Array.from(bases).sort();
            setUniqueBaseNames(sortedBases);

            if (sortedBases.length > 0) {
                setSelectedBaseName(sortedBases[0]);
            }
        } catch (err) {
            console.error("Error fetching competitions:", err);
        }
    }, []);

    const calculateStandings = useCallback(async (competition) => {
        setLoading(true);
        try {
            const compId = competition?.id || competition;
            // ดึงข้อมูลแมตช์และทีมของรายการนั้นๆ
            const [matchesRes, teamsRes] = await Promise.all([
                api.getMatchesByCompetition(compId),
                api.getTeamsByCompetition(compId)
            ]);

            const matches = matchesRes.data;
            setAllMatches(matches); // เก็บแมตช์ดิบไว้ใช้งาน
            let teams = Array.isArray(teamsRes.data) ? teamsRes.data : [];

            // --- [NEW] จัดการ Pool Filtering ---
            // 1. หา Pool ทั้งหมดที่มีในรายการนี้ (จาก matches)
            const uniquePools = [...new Set(matches.map(m => m.pool_name).filter(Boolean))].sort();
            setPools(uniquePools);

            // 2. ถ้ามี Pool และมีการเลือก Pool ให้กรองข้อมูล
            let filteredMatches = matches;
            if (selectedPool) {
                filteredMatches = matches.filter(m => m.pool_name === selectedPool);

                // กรองเฉพาะทีมที่มีแข่งใน Pool นี้
                const teamIdsInPool = new Set();
                filteredMatches.forEach(m => {
                    if (m.home_team_id) teamIdsInPool.add(String(m.home_team_id));
                    if (m.away_team_id) teamIdsInPool.add(String(m.away_team_id));
                });
                teams = teams.filter(t => teamIdsInPool.has(String(t.id)));
            }

            const teamsById = new Map();
            teams.forEach(team => {
                if (team?.id) teamsById.set(String(team.id), team);
            });
            filteredMatches.forEach(match => {
                if (match.home_team_id && !teamsById.has(String(match.home_team_id))) {
                    teamsById.set(String(match.home_team_id), {
                        id: match.home_team_id,
                        name: match.home_team || match.team_a_name || 'Home Team',
                        code: match.home_team_code || match.team_a_code || '',
                        logo_url: match.home_team_logo_url || ''
                    });
                }
                if (match.away_team_id && !teamsById.has(String(match.away_team_id))) {
                    teamsById.set(String(match.away_team_id), {
                        id: match.away_team_id,
                        name: match.away_team || match.team_b_name || 'Away Team',
                        code: match.away_team_code || match.team_b_code || '',
                        logo_url: match.away_team_logo_url || ''
                    });
                }
            });
            teams = Array.from(teamsById.values());

            // 1. หา max_sets ของรายการนี้เพื่อสร้างคอลัมน์ Result Details
            const competitionMaxSets = Number(competition?.max_sets || competition?.maxSets || 0) || getDefaultMaxSetsByAgeGroup(competition);
            const maxSets = competitionMaxSets || 5;
            const setsToWin = Math.ceil(maxSets / 2);

            const cols = [];
            for (let i = 0; i < setsToWin; i++) cols.push(`${setsToWin}-${i}`); // Wins (e.g. 3-0, 3-1, 3-2)
            for (let i = setsToWin - 1; i >= 0; i--) cols.push(`${i}-${setsToWin}`); // Losses (e.g. 2-3, 1-3, 0-3)
            setResultCols(cols);

            // เตรียม Object สำหรับเก็บสถิติ
            const stats = {};
            teams.forEach(team => {
                const teamKey = String(team.id);
                stats[teamKey] = {
                    id: team.id,
                    name: team.name,
                    code: team.code, // เพิ่มชื่อย่อ
                    logo_url: team.logo_url,
                    played: 0,
                    won: 0,
                    lost: 0,
                    points: 0,
                    sets_won: 0,
                    sets_lost: 0,
                    points_won: 0,
                    points_lost: 0,
                    // Result Details
                    results: {} // เก็บแบบ Dynamic
                };
                cols.forEach(k => stats[teamKey].results[k] = 0);
            });

            const isCompletedMatch = (match) => String(match.status || '').toLowerCase() === 'completed';
            const parseSetScores = (rawScores) => {
                if (!rawScores) return [];
                let scores = rawScores;
                if (typeof scores === 'string') {
                    try {
                        scores = JSON.parse(scores);
                    } catch {
                        scores = scores.split(',').map(s => s.trim()).filter(Boolean);
                    }
                }
                if (!Array.isArray(scores)) return [];

                return scores.map(setScore => {
                    if (typeof setScore === 'string') {
                        const [home, away] = setScore.split('-').map(v => Number.parseInt(v, 10));
                        return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
                    }
                    const home = Number.parseInt(setScore?.home ?? setScore?.home_score ?? setScore?.h, 10);
                    const away = Number.parseInt(setScore?.away ?? setScore?.away_score ?? setScore?.a, 10);
                    return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
                }).filter(Boolean);
            };

            const getSetsFromScores = (setScores) => setScores.reduce((acc, setScore) => {
                if (setScore.home > setScore.away) acc.home += 1;
                if (setScore.away > setScore.home) acc.away += 1;
                return acc;
            }, { home: 0, away: 0 });

            const addRankingPoints = (winnerStats, loserStats, loserSets, matchSetsToWin) => {
                if (loserSets === matchSetsToWin - 1) {
                    winnerStats.points += 2;
                    loserStats.points += 1;
                } else {
                    winnerStats.points += 3;
                }
            };

            filteredMatches.forEach(m => {
                if (!isCompletedMatch(m)) return;

                const homeId = String(m.home_team_id);
                const awayId = String(m.away_team_id);
                if (!stats[homeId] || !stats[awayId]) return;

                const setScores = parseSetScores(m.set_scores);
                const calculatedSets = getSetsFromScores(setScores);
                const homeSets = calculatedSets.home || (Number.parseInt(m.home_set_score, 10) || 0);
                const awaySets = calculatedSets.away || (Number.parseInt(m.away_set_score, 10) || 0);

                if (homeSets === awaySets) return;

                const matchSetsToWin = Math.ceil(maxSets / 2);

                stats[homeId].played++;
                stats[awayId].played++;

                stats[homeId].sets_won += homeSets;
                stats[homeId].sets_lost += awaySets;
                stats[awayId].sets_won += awaySets;
                stats[awayId].sets_lost += homeSets;

                const scoreKey = `${homeSets}-${awaySets}`;
                const reverseScoreKey = `${awaySets}-${homeSets}`;
                if (stats[homeId].results[scoreKey] !== undefined) stats[homeId].results[scoreKey]++;
                if (stats[awayId].results[reverseScoreKey] !== undefined) stats[awayId].results[reverseScoreKey]++;

                if (homeSets > awaySets) {
                    stats[homeId].won++;
                    stats[awayId].lost++;
                    addRankingPoints(stats[homeId], stats[awayId], awaySets, matchSetsToWin);
                } else {
                    stats[awayId].won++;
                    stats[homeId].lost++;
                    addRankingPoints(stats[awayId], stats[homeId], homeSets, matchSetsToWin);
                }

                setScores.forEach(setScore => {
                    stats[homeId].points_won += setScore.home;
                    stats[homeId].points_lost += setScore.away;
                    stats[awayId].points_won += setScore.away;
                    stats[awayId].points_lost += setScore.home;
                });
            });
            // แปลงเป็น Array และคำนวณ Ratio
            const standingsArray = Object.values(stats).map(t => {
                // ถ้ายังไม่ได้แข่ง ให้ Ratio เป็น 0
                const setRatio = t.sets_lost === 0 ? (t.sets_won > 0 ? 'MAX' : 0.000) : (t.sets_won / t.sets_lost).toFixed(3);
                const pointRatio = t.points_lost === 0 ? (t.points_won > 0 ? 'MAX' : 0.000) : (t.points_won / t.points_lost).toFixed(3);

                return { ...t, setRatio, pointRatio, setRatioVal: t.sets_lost === 0 ? 9999 : t.sets_won / t.sets_lost, pointRatioVal: t.points_lost === 0 ? 9999 : t.points_won / t.points_lost };
            });

            // เรียงลำดับตามความสำคัญ: 1. คะแนน (Points) > 2. จำนวนแมตช์ที่ชนะ (Won Matches) > 3. Set Ratio > 4. Point Ratio
            standingsArray.sort((a, b) => {
                // จัดเรียงจาก คะแนน (Points) มากไปหาน้อย
                if (b.points !== a.points) return (b.points || 0) - (a.points || 0);
                // ถ้าคะแนนเท่ากัน ให้ดูจำนวนแมตช์ที่ชนะ (Won Matches)
                if (b.won !== a.won) return (b.won || 0) - (a.won || 0);
                // ถ้ายังเท่ากัน ให้ดู Set Ratio
                if (b.setRatioVal !== a.setRatioVal) return (b.setRatioVal || 0) - (a.setRatioVal || 0);
                // สุดท้ายดู Point Ratio
                return (b.pointRatioVal || 0) - (a.pointRatioVal || 0);
            });

            setStandings(standingsArray);

        } catch (err) {
            console.error("Error calculating standings:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedPool]);

    useEffect(() => {
        fetchCompetitions();
    }, [fetchCompetitions]);

    useEffect(() => {
        if (selectedBaseName && genderFilter) {
            // ค้นหา Competition ID ที่ตรงกับ ชื่อรายการ + เพศ
            const targetComp = competitions.find(c => {
                const cBase = getCompetitionBaseName(c);
                return cBase === selectedBaseName &&
                    c.gender === genderFilter &&
                    String(getAgeGroupKey(c)) === String(selectedAgeGroupId);
            });

            if (targetComp) {
                calculateStandings(targetComp);
            } else {
                setStandings([]); // ไม่พบรายการสำหรับเพศนี้
            }
        } else {
            setStandings([]);
        }
    }, [selectedBaseName, genderFilter, selectedAgeGroupId, competitions, calculateStandings]);

    // เมื่อเลือกรายการแข่งขัน (Base Name) ให้หาว่ามีเพศอะไรบ้าง
    useEffect(() => {
        if (selectedBaseName && competitions.length > 0) {
            const relatedComps = competitions.filter(c => {
                const cBase = getCompetitionBaseName(c);
                return cBase === selectedBaseName;
            });
            const genders = [...new Set(relatedComps.map(c => c.gender))].filter(Boolean).sort();
            setAvailableGenders(genders);

            // ถ้าเพศที่เลือกอยู่ ไม่มีในรายการนี้ ให้เลือกเพศแรกที่เจอแทน
            if (genders.length > 0 && !genders.includes(genderFilter)) {
                setGenderFilter(genders[0]);
            }

            const genderForAgeGroups = genders.includes(genderFilter) ? genderFilter : genders[0];
            const ageGroups = relatedComps
                .filter(c => !genderForAgeGroups || c.gender === genderForAgeGroups)
                .map(c => ({
                    id: getAgeGroupKey(c),
                    label: getAgeGroupLabel(c) || `รุ่น ${getAgeGroupKey(c)}`
                }))
                .filter(group => group.id);
            const uniqueAgeGroups = Array.from(
                new Map(ageGroups.map(group => [group.id, group])).values()
            ).sort(sortAgeGroups);
            setAvailableAgeGroups(uniqueAgeGroups);

            if (uniqueAgeGroups.length > 0 && !uniqueAgeGroups.some(group => String(group.id) === String(selectedAgeGroupId))) {
                setSelectedAgeGroupId(uniqueAgeGroups[0].id);
            }
        }
    }, [selectedBaseName, competitions, genderFilter, selectedAgeGroupId]);

    const handleExportExcel = () => {
        if (!standings.length) return;

        const cellText = (value) => value === null || value === undefined || value === '' ? '-' : String(value);
        const cellNumber = (value) => value === null || value === undefined || value === '' ? 0 : Number(value) || 0;
        const escapeXml = (value) => cellText(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        const colName = (index) => {
            let name = '';
            let n = index;
            while (n > 0) {
                const rem = (n - 1) % 26;
                name = String.fromCharCode(65 + rem) + name;
                n = Math.floor((n - 1) / 26);
            }
            return name;
        };
        const cellRef = (col, row) => `${colName(col)}${row}`;
        const inlineCell = (col, row, value, style = 0) => (
            `<c r="${cellRef(col, row)}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
        );
        const numberCell = (col, row, value, style = 0) => (
            `<c r="${cellRef(col, row)}" s="${style}"><v>${cellNumber(value)}</v></c>`
        );
        const crcTable = (() => {
            const table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
                table[i] = c >>> 0;
            }
            return table;
        })();
        const crc32 = (bytes) => {
            let crc = 0xffffffff;
            for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
            return (crc ^ 0xffffffff) >>> 0;
        };
        const uint16 = (value) => [value & 0xff, (value >>> 8) & 0xff];
        const uint32 = (value) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
        const dateToDos = (date) => {
            const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
            const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
            return { time, day };
        };
        const createZip = (files) => {
            const encoder = new TextEncoder();
            const chunks = [];
            const central = [];
            let offset = 0;
            const now = dateToDos(new Date());

            files.forEach((file) => {
                const nameBytes = encoder.encode(file.name);
                const dataBytes = encoder.encode(file.content);
                const crc = crc32(dataBytes);
                const localHeader = new Uint8Array([
                    ...uint32(0x04034b50),
                    ...uint16(20),
                    ...uint16(0x0800),
                    ...uint16(0),
                    ...uint16(now.time),
                    ...uint16(now.day),
                    ...uint32(crc),
                    ...uint32(dataBytes.length),
                    ...uint32(dataBytes.length),
                    ...uint16(nameBytes.length),
                    ...uint16(0)
                ]);

                chunks.push(localHeader, nameBytes, dataBytes);
                central.push({
                    nameBytes,
                    crc,
                    size: dataBytes.length,
                    offset
                });
                offset += localHeader.length + nameBytes.length + dataBytes.length;
            });

            const centralStart = offset;
            central.forEach((entry) => {
                const header = new Uint8Array([
                    ...uint32(0x02014b50),
                    ...uint16(20),
                    ...uint16(20),
                    ...uint16(0x0800),
                    ...uint16(0),
                    ...uint16(now.time),
                    ...uint16(now.day),
                    ...uint32(entry.crc),
                    ...uint32(entry.size),
                    ...uint32(entry.size),
                    ...uint16(entry.nameBytes.length),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint32(0),
                    ...uint32(entry.offset)
                ]);
                chunks.push(header, entry.nameBytes);
                offset += header.length + entry.nameBytes.length;
            });

            const centralSize = offset - centralStart;
            chunks.push(new Uint8Array([
                ...uint32(0x06054b50),
                ...uint16(0),
                ...uint16(0),
                ...uint16(central.length),
                ...uint16(central.length),
                ...uint32(centralSize),
                ...uint32(centralStart),
                ...uint16(0)
            ]));

            return new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        };

        const ageGroupLabel = availableAgeGroups.find(group => String(group.id) === String(selectedAgeGroupId))?.label || '-';
        const poolLabel = selectedPool || 'All Pools';
        const generatedAt = new Date().toLocaleString('th-TH', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const safeName = [selectedBaseName, genderFilter, selectedPool || 'all-pools']
            .filter(Boolean)
            .join('_')
            .replace(/[\\/:*?"<>|]+/g, '-')
            .replace(/\s+/g, '_');

        const totalCols = 12 + resultCols.length;
        const lastCol = colName(totalCols);
        const pointCol = 6 + resultCols.length;
        const setsStartCol = pointCol + 1;
        const pointsStartCol = setsStartCol + 3;
        const colWidths = [
            8,
            38,
            8,
            8,
            8,
            ...resultCols.map(() => 8),
            10,
            8,
            8,
            12,
            8,
            8,
            12
        ];
        const colsXml = colWidths.map((width, index) => (
            `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
        )).join('');
        const merges = [
            `A1:${lastCol}1`,
            `A2:${lastCol}2`,
            'B4:D4',
            'B5:D5',
            'B6:D6',
            'B7:D7',
            'B8:D8',
            'A10:B10',
            'C10:E10',
            resultCols.length > 1 ? `${colName(6)}10:${colName(5 + resultCols.length)}10` : null,
            `${colName(setsStartCol)}10:${colName(setsStartCol + 2)}10`,
            `${colName(pointsStartCol)}10:${colName(pointsStartCol + 2)}10`
        ].filter(Boolean);

        const rows = [];
        rows.push(`<row r="1" ht="30" customHeight="1">${inlineCell(1, 1, 'Team Rankings Report', 1)}</row>`);
        rows.push(`<row r="2" ht="24" customHeight="1">${inlineCell(1, 2, 'Volleyball Manager', 2)}</row>`);
        rows.push(`<row r="3" ht="22" customHeight="1"></row>`);
        [
            ['Competition', selectedBaseName],
            ['Gender', genderFilter],
            ['Age Group', ageGroupLabel],
            ['Pool', poolLabel],
            ['Generated', generatedAt]
        ].forEach(([label, value], index) => {
            const row = 4 + index;
            rows.push(`<row r="${row}" ht="24" customHeight="1">${inlineCell(1, row, label, 3)}${inlineCell(2, row, value, 4)}</row>`);
        });
        rows.push(`<row r="9" ht="22" customHeight="1"></row>`);
        rows.push(`<row r="10" ht="24" customHeight="1">${
            inlineCell(1, 10, 'Ranking', 5) +
            inlineCell(3, 10, 'Matches', 5) +
            inlineCell(6, 10, 'Result Details', 6) +
            inlineCell(pointCol, 10, 'Total', 6) +
            inlineCell(setsStartCol, 10, 'Sets', 5) +
            inlineCell(pointsStartCol, 10, 'Points', 5)
        }</row>`);

        const headerCells = ['Rank', 'Team', 'Total', 'W', 'L', ...resultCols, 'Points', 'SW', 'SL', 'Ratio', 'PW', 'PL', 'Ratio'];
        rows.push(`<row r="11" ht="28" customHeight="1">${headerCells.map((label, index) => {
            const col = index + 1;
            const style = col >= 6 && col <= pointCol ? 6 : 5;
            return inlineCell(col, 11, label, style);
        }).join('')}</row>`);

        standings.forEach((team, index) => {
            const rank = index + 1;
            const row = 12 + index;
            const rankStyle = rank === 1 ? 10 : rank === 2 ? 11 : rank === 3 ? 12 : 9;
            const teamStyle = rank === 1 ? 18 : rank === 2 ? 19 : rank === 3 ? 20 : 17;
            const numStyle = rank === 1 ? 21 : rank === 2 ? 22 : rank === 3 ? 23 : 9;
            const cells = [
                numberCell(1, row, rank, rankStyle),
                inlineCell(2, row, `${team.name}${team.code ? `\n${team.code}` : ''}`, teamStyle),
                numberCell(3, row, team.played, numStyle),
                numberCell(4, row, team.won, rank === 1 ? 24 : 13),
                numberCell(5, row, team.lost, rank === 3 ? 25 : 14),
                ...resultCols.map((col, resultIndex) => numberCell(6 + resultIndex, row, team.results?.[col], numStyle)),
                numberCell(pointCol, row, team.points, 15),
                numberCell(setsStartCol, row, team.sets_won, numStyle),
                numberCell(setsStartCol + 1, row, team.sets_lost, numStyle),
                inlineCell(setsStartCol + 2, row, team.setRatio, 16),
                numberCell(pointsStartCol, row, team.points_won, numStyle),
                numberCell(pointsStartCol + 1, row, team.points_lost, numStyle),
                inlineCell(pointsStartCol + 2, row, team.pointRatio, 16)
            ];
            rows.push(`<row r="${row}" ht="38" customHeight="1">${cells.join('')}</row>`);
        });

        const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews>
                <sheetFormatPr defaultRowHeight="18"/>
                <cols>${colsXml}</cols>
                <sheetData>${rows.join('')}</sheetData>
                <mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>
                <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
            </worksheet>`;
        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                <fonts count="9">
                    <font><sz val="11"/><name val="Calibri"/></font>
                    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
                    <font><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
                    <font><b/><sz val="10"/><color rgb="FF1D4ED8"/><name val="Calibri"/></font>
                    <font><b/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>
                    <font><b/><sz val="10"/><color rgb="FF2563EB"/><name val="Calibri"/></font>
                    <font><b/><sz val="12"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
                    <font><b/><sz val="11"/><color rgb="FF00A63E"/><name val="Calibri"/></font>
                    <font><sz val="11"/><color rgb="FFFF0000"/><name val="Calibri"/></font>
                </fonts>
                <fills count="9">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFBE6"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>
                    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/><bgColor indexed="64"/></patternFill></fill>
                </fills>
                <borders count="2">
                    <border><left/><right/><top/><bottom/><diagonal/></border>
                    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
                </borders>
                <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                <cellXfs count="26">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/>
                    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyFont="1" applyFill="1"/>
                    <xf numFmtId="0" fontId="3" fillId="0" borderId="1" applyFont="1" applyBorder="1"/>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/>
                    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="6" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="7" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="8" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="7" fillId="0" borderId="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="8" fillId="0" borderId="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" applyFont="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="6" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="7" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="6" fillId="8" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="7" fillId="6" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                    <xf numFmtId="0" fontId="8" fillId="8" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
                </cellXfs>
                <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
            </styleSheet>`;
        const files = [
            {
                name: '[Content_Types].xml',
                content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
            },
            {
                name: '_rels/.rels',
                content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
            },
            {
                name: 'xl/workbook.xml',
                content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Team Rankings" sheetId="1" r:id="rId1"/></sheets></workbook>`
            },
            {
                name: 'xl/_rels/workbook.xml.rels',
                content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
            },
            { name: 'xl/styles.xml', content: stylesXml },
            { name: 'xl/worksheets/sheet1.xml', content: worksheetXml }
        ];
        const blob = createZip(files);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `team_rankings_${safeName || 'export'}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Filter Section */}
            <div className={`p-6 rounded-xl shadow-sm border border-gray-100 bg-white`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 text-gray-900">
                            <Trophy className="text-yellow-500" /> Team Rankings
                        </h2>
                        <p className={`text-sm text-gray-500 font-medium mt-1`}>
                            View standings and statistics for each competition.
                        </p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-end">
                        <div className="w-full md:w-64">
                            <label className={`block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                                Competition
                            </label>
                            <select
                                className="w-full p-2.5 text-sm font-medium rounded-lg border border-gray-200 transition-all hover:border-blue-400 focus:outline-none focus:border-blue-500 bg-white shadow-sm text-gray-700"
                                value={selectedBaseName}
                                onChange={(e) => setSelectedBaseName(e.target.value)}
                            >
                                {uniqueBaseNames.map(name => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-auto">
                            <label className={`block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                                Gender
                            </label>
                            <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-1 h-[42px] shadow-sm items-center">
                                {availableGenders.map(g => (
                                    <button key={g} onClick={() => setGenderFilter(g)} className={`px-4 py-1 text-sm font-medium rounded-md transition-all ${genderFilter === g ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}>
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:w-40">
                            <label className={`block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                                Age Group
                            </label>
                            <select
                                className="w-full p-2.5 text-sm font-medium rounded-lg border border-gray-200 transition-all hover:border-blue-400 focus:outline-none focus:border-blue-500 bg-white shadow-sm text-gray-700"
                                value={selectedAgeGroupId}
                                onChange={(e) => setSelectedAgeGroupId(e.target.value)}
                            >
                                {availableAgeGroups.map(group => (
                                    <option key={group.id} value={group.id}>{group.label}</option>
                                ))}
                            </select>
                        </div>
                        {pools.length > 0 && (
                            <div className="w-full md:w-32">
                                <label className={`block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2`}>
                                    Pool
                                </label>
                                <select
                                    className="w-full p-2.5 text-sm font-medium rounded-lg border border-gray-200 transition-all hover:border-blue-400 focus:outline-none focus:border-blue-500 bg-white shadow-sm text-gray-700"
                                    value={selectedPool}
                                    onChange={(e) => setSelectedPool(e.target.value)}
                                >
                                    <option value="">All Pools</option>
                                    {pools.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={loading || standings.length === 0}
                            className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500 md:w-auto"
                            title="Export rankings as Excel"
                        >
                            <Download size={16} />
                            Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className={`rounded-xl shadow-sm border overflow-hidden bg-white border-gray-200 mt-6`}>
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading standings...</div>
                ) : standings.length === 0 ? (
                    <EmptyState text="No teams or matches found for this competition." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className={`text-xs uppercase tracking-wider font-semibold bg-gray-50/80 backdrop-blur-sm text-gray-500`}>
                                {/* Header Grouping */}
                                <tr className="border-b border-gray-200">
                                    <th colSpan="2" className="text-center py-2 border-r border-gray-200">Ranking</th>
                                    <th colSpan="3" className="text-center py-2 border-r border-gray-200 bg-gray-100/50">Matches</th>
                                    <th colSpan={resultCols.length} className="text-center py-2 border-r border-gray-200 bg-blue-50/30 text-blue-600">Result Details</th>
                                    <th colSpan="1" className="text-center py-2 border-r border-gray-200 font-bold text-blue-600">Total</th>
                                    <th colSpan="3" className="text-center py-2 border-r border-gray-200">Sets</th>
                                    <th colSpan="3" className="text-center py-2">Points</th>
                                </tr>
                                <tr>
                                    <th className="px-4 py-3 text-center w-16">Rank</th>
                                    <th className="px-4 py-3">Team</th>
                                    <th className="px-2 py-3 text-center bg-gray-100/50" title="Total Matches">Total</th>
                                    <th className="px-2 py-3 text-center bg-gray-100/50" title="Won">W</th>
                                    <th className="px-2 py-3 text-center bg-gray-100/50" title="Lost">L</th>

                                    {/* Result Details */}
                                    {resultCols.map((col, i) => (
                                        <th key={col} className={`px-2 py-3 text-center text-[10px] text-gray-500 ${i === 0 ? 'border-l border-gray-200' : ''}`} title={`Result ${col}`}>{col}</th>
                                    ))}

                                    <th className="px-4 py-3 text-center border-l border-gray-200 font-semibold text-blue-600 text-lg" title="Points">POINTS</th>

                                    <th className="px-2 py-3 text-center border-l border-gray-200" title="Sets Won">SW</th>
                                    <th className="px-2 py-3 text-center" title="Sets Lost">SL</th>
                                    <th className="px-2 py-3 text-center text-xs" title="Set Ratio">Ratio</th>

                                    <th className="px-2 py-3 text-center border-l border-gray-200" title="Points Won">PW</th>
                                    <th className="px-2 py-3 text-center" title="Points Lost">PL</th>
                                    <th className="px-2 py-3 text-center text-xs" title="Point Ratio">Ratio</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y divide-gray-100`}>
                                {standings.map((team, index) => (
                                    <tr key={team.id} className={`transition ${index === 0 ? ('bg-yellow-50 hover:bg-yellow-100') :
                                        index === 1 ? ('bg-gray-100 hover:bg-gray-200') :
                                            index === 2 ? ('bg-orange-50 hover:bg-orange-100') :
                                                ('hover:bg-gray-50')
                                        }`}>
                                        <td className="px-4 py-3 text-center font-bold">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                index === 1 ? 'bg-gray-100 text-gray-700' :
                                                    index === 2 ? 'bg-orange-100 text-orange-700' : ''
                                                }`}>
                                                {index + 1}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div
                                                className="flex items-center gap-3 cursor-pointer hover:opacity-75 transition-opacity group"
                                                onClick={() => setViewingHistoryTeam(team)}
                                                title="Click to view match history"
                                            >
                                                {team.logo_url && <img src={team.logo_url} alt={team.name} className="w-8 h-8 object-contain" />}
                                                <div>
                                                    <div className="font-bold text-sm group-hover:text-blue-600 group-hover:underline underline-offset-2 decoration-indigo-500/30">{team.name}</div>
                                                    {team.code && <div className="text-xs text-gray-400 font-mono">{team.code}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 text-center bg-gray-50/50 font-medium">{team.played}</td>
                                        <td className="px-2 py-3 text-center bg-gray-50/50 text-green-600 font-bold">{team.won}</td>
                                        <td className="px-2 py-3 text-center bg-gray-50/50 text-red-500">{team.lost}</td>

                                        {/* Result Details */}
                                        {resultCols.map((col, i) => (
                                            <td key={col} className={`px-2 py-3 text-center text-xs text-gray-500 ${i === 0 ? 'border-l border-gray-200' : ''}`}>{team.results[col] || 0}</td>
                                        ))}

                                        <td className="px-4 py-3 text-center border-l border-gray-200 font-semibold text-lg">{team.points}</td>

                                        <td className="px-2 py-3 text-center border-l border-gray-200">{team.sets_won}</td>
                                        <td className="px-2 py-3 text-center">{team.sets_lost}</td>
                                        <td className="px-2 py-3 text-center text-xs text-gray-500 font-mono">{team.setRatio}</td>

                                        <td className="px-2 py-3 text-center border-l border-gray-200">{team.points_won}</td>
                                        <td className="px-2 py-3 text-center">{team.points_lost}</td>
                                        <td className="px-2 py-3 text-center text-xs text-gray-500 font-mono">{team.pointRatio}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Match History Modal */}
            {viewingHistoryTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className={`relative w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] bg-white text-gray-900`}>
                        <div className="p-6 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm flex justify-between items-center rounded-t-xl shrink-0">
                            <div>
                                <h3 className="font-bold text-xl text-gray-900 tracking-tight flex items-center gap-2"><Calendar size={20} className="text-blue-600" /> Match History</h3>
                                <p className="text-sm font-medium text-gray-500 mt-1">{viewingHistoryTeam.name}</p>
                            </div>
                            <button onClick={() => setViewingHistoryTeam(null)} className="text-gray-500 hover:bg-gray-200 p-2 rounded-md transition-colors"><X size={20} /></button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1">
                            {(() => {
                                // กรองแมตช์ของทีมนี้
                                const teamMatches = allMatches.filter(m =>
                                    (String(m.home_team_id) === String(viewingHistoryTeam.id) || String(m.away_team_id) === String(viewingHistoryTeam.id)) &&
                                    String(m.status || '').toLowerCase() === 'completed'
                                ).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

                                if (teamMatches.length === 0) return <div className="p-12 text-center text-gray-500">No completed matches found for this team.</div>;

                                return (
                                    <table className="w-full text-left border-collapse">
                                        <thead className={`sticky top-0 z-10 bg-gray-50/90 text-gray-500 backdrop-blur-sm`}>
                                            <tr>
                                                <th className="px-6 py-3 text-xs font-bold uppercase">Date / Round</th>
                                                <th className="px-6 py-3 text-xs font-bold uppercase">Opponent</th>
                                                <th className="px-6 py-3 text-center text-xs font-bold uppercase">Result</th>
                                                <th className="px-6 py-3 text-center text-xs font-bold uppercase">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y divide-gray-100`}>
                                            {teamMatches.map(m => {
                                                const isHome = String(m.home_team_id) === String(viewingHistoryTeam.id);
                                                const opponentName = isHome ? (m.away_team || 'Unknown') : (m.home_team || 'Unknown');
                                                const myScore = isHome ? m.home_set_score : m.away_set_score;
                                                const oppScore = isHome ? m.away_set_score : m.home_set_score;
                                                const isWin = myScore > oppScore;

                                                return (
                                                    <tr key={m.id} className={'hover:bg-gray-50'}>
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold text-sm">{formatThaiDate(m.start_time)}</div>
                                                            <div className="text-xs text-gray-500">{m.round_name}</div>
                                                        </td>
                                                        <td className="px-6 py-4 font-medium">{opponentName}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${isWin ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                                {isWin ? 'WIN' : 'LOSS'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="text-lg font-semibold font-mono">{myScore} - {oppScore}</div>
                                                            <div className="text-xs text-gray-400 mt-1 font-mono">
                                                                {(() => {
                                                                    try {
                                                                        const sets = typeof m.set_scores === 'string' ? JSON.parse(m.set_scores) : m.set_scores;
                                                                        return Array.isArray(sets) ? sets.join(', ') : sets;
                                                                    } catch { return m.set_scores; }
                                                                })()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </div>
                        <div className={`p-6 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-xl`}>
                            <button onClick={() => setViewingHistoryTeam(null)} className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all font-medium text-sm">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
