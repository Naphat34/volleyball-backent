import { calculateStandings } from '../../utils/standings';
import { Feedback, StatusBadge } from '../../components/ui/SystemUI';
import { readViewPreference, writeViewPreference } from '../../utils/viewPreferences';
import PublicHeader from '../../components/PublicHeader';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api';
import { Activity, ArrowRight, BarChart3, CalendarDays, Clock, MapPin, Shield, Star, Target, Trophy, Users, Zap } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatThaiDate, formatThaiTime } from '../../utils';
import {
    findCompetitionGroupById,
    getPublicCompetitionVariantLabel,
    groupPublicCompetitions
} from '../../utils/publicCompetitionGrouping';

const statusIsLive = (status) => ['live', 'set_playing', 'in_progress'].includes(String(status || '').toLowerCase());
const statusIsFinished = (status) => ['completed', 'finished', 'match_finished'].includes(String(status || '').toLowerCase());

const getTeamName = (match, side) => (
    side === 'home'
        ? match.team_a_name || match.home_team_name || 'TBD'
        : match.team_b_name || match.away_team_name || 'TBD'
);

const getTeamLogo = (match, side) => (
    side === 'home'
        ? match.team_a_logo || match.home_team_logo_url || ''
        : match.team_b_logo || match.away_team_logo_url || ''
);

const TeamBadge = ({ name, logoUrl, size = 'md' }) => {
    const sizeClass = size === 'lg' ? 'h-14 w-14 text-sm' : 'h-9 w-9 text-[10px]';
    const initials = String(name || 'TBD').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white font-bold text-slate-500`}>
            {logoUrl ? (
                <img src={logoUrl} alt={name || 'Team'} className="h-full w-full object-contain p-1" />
            ) : initials}
        </div>
    );
};

export default function LandingPage() {
    const navigate = useNavigate();
    const { language, t } = useLanguage();
    const [competitions, setCompetitions] = useState([]);
    const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
    const [matches, setMatches] = useState([]);
    const [teams, setTeams] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [competitionError, setCompetitionError] = useState(false);
    const [statisticsError, setStatisticsError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [lastUpdated, setLastUpdated] = useState(null);
    useEffect(() => { if (selectedCompetitionId) writeViewPreference('publicCompetition', selectedCompetitionId); }, [selectedCompetitionId]);


    const isThai = language === 'THA';
    const competitionGroups = useMemo(() => groupPublicCompetitions(competitions), [competitions]);
    const selectedGroup = findCompetitionGroupById(competitionGroups, selectedCompetitionId);
    const selectedTitle = selectedGroup?.title || (isThai ? 'รายการแข่งขัน' : 'Competition');

    useEffect(() => {
        let cancelled = false;

        const fetchCompetitions = async () => {
            setCompetitionError(false);
            try {
                const res = await client.get('/public/competitions');
                const openCompetitions = (res.data || []).filter((competition) => (
                    String(competition.status || '').toLowerCase() === 'open'
                ));
                if (cancelled) return;
                setCompetitions(openCompetitions);
                const remembered = readViewPreference('publicCompetition');
                const selected = openCompetitions.find(item => String(item.id) === String(remembered)) || openCompetitions[0];
                setSelectedCompetitionId(selected?.id ? String(selected.id) : '');
            } catch (error) {
                console.error('Error fetching competitions:', error);
                if (!cancelled) setCompetitionError(true);
            }
        };

        fetchCompetitions();
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    useEffect(() => {
        let cancelled = false;

        const fetchDashboardData = async () => {
            setLoading(true);
            setLoadError(false);
            setStatisticsError(false);
            setStats(null);
            try {
                const [matchesRes, teamsRes, statsRes] = await Promise.all([
                    selectedCompetitionId ? client.get(`/public/matches?competitionId=${selectedCompetitionId}`) : client.get('/public/matches'),
                    selectedCompetitionId ? client.get(`/public/competitions/${selectedCompetitionId}/teams`) : Promise.resolve({ data: [] }),
                    selectedCompetitionId ? client.get(`/public/statistics/${selectedCompetitionId}`).catch(() => ({ data: null, unavailable: true })) : Promise.resolve({ data: null })
                ]);

                if (cancelled) return;
                setMatches(matchesRes.data || []);
                setLastUpdated(new Date());
                setTeams(teamsRes.data || []);
                setStats(statsRes.data || null);
                setStatisticsError(Boolean(statsRes.unavailable));
            } catch (error) {
                console.error('Error fetching landing data:', error);
                if (!cancelled) {
                    setLoadError(true);
                    setMatches([]);
                    setTeams([]);
                    setStats(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchDashboardData();
        return () => {
            cancelled = true;
        };
    }, [selectedCompetitionId, reloadKey]);

    const liveMatches = matches.filter((match) => statusIsLive(match.status));
    const finishedMatches = matches.filter((match) => statusIsFinished(match.status));
    const upcomingMatches = matches.filter((match) => !statusIsLive(match.status) && !statusIsFinished(match.status));
    const featuredMatch = liveMatches[0] || upcomingMatches[0] || finishedMatches[0] || matches[0] || null;
    const recentResults = finishedMatches.slice(-3).reverse();

    const standingsPreview = useMemo(() => calculateStandings(teams, matches, competitions).slice(0, 5), [teams, matches, competitions]);

    const topPlayers = [
        { key: 'best_scorers', label: isThai ? 'ทำคะแนน' : 'Scorers', icon: <Star size={16} className="text-amber-500" /> },
        { key: 'best_spikers', label: isThai ? 'ตบ' : 'Spikers', icon: <Zap size={16} className="text-red-500" /> },
        { key: 'best_blockers', label: isThai ? 'บล็อก' : 'Blockers', icon: <Shield size={16} className="text-emerald-600" /> },
        { key: 'best_servers', label: isThai ? 'เสิร์ฟ' : 'Servers', icon: <Target size={16} className="text-blue-600" /> }
    ].map((item) => ({
        ...item,
        player: Array.isArray(stats?.[item.key]) ? stats[item.key][0] : null
    })).filter((item) => item.player);

    const quickLinks = [
        { label: t('nav.matches'), icon: <CalendarDays size={18} />, path: '/matches' },
        { label: t('nav.teams'), icon: <Users size={18} />, path: '/teams' },
        { label: t('nav.standings'), icon: <BarChart3 size={18} />, path: '/standings' },
        { label: t('nav.stats'), icon: <Activity size={18} />, path: '/stats' }
    ];

    const selectCompetitionGroup = (groupKey) => {
        const group = competitionGroups.find((item) => item.key === groupKey);
        setSelectedCompetitionId(group?.items[0]?.id ? String(group.items[0].id) : '');
    };

    const MatchCard = ({ match, compact = false }) => {
        if (!match) {
            return (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    {isThai ? 'ยังไม่มีแมตช์สำหรับรายการนี้' : 'No match available for this competition'}
                </div>
            );
        }

        const homeSets = match.team_a_score ?? match.home_set_score ?? '-';
        const awaySets = match.team_b_score ?? match.away_set_score ?? '-';

        return (
            <button
                type="button"
                onClick={() => navigate(`/match-centre/${match.id}`)}
                className={`w-full rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:bg-blue-50/40 ${compact ? 'p-3' : 'p-5'}`}
            >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                    <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">#{match.match_number || '-'}</span>
                    <span className="flex items-center gap-1"><Clock size={13} />{formatThaiTime(match.start_time)}</span>
                    {statusIsLive(match.status) ? (
                        <span className="rounded bg-red-100 px-2 py-1 text-red-700">LIVE</span>
                    ) : statusIsFinished(match.status) ? (
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">{isThai ? 'จบแล้ว' : 'Finished'}</span>
                    ) : (
                        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{isThai ? 'กำลังจะมาถึง' : 'Upcoming'}</span>
                    )}
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <TeamBadge name={getTeamName(match, 'home')} logoUrl={getTeamLogo(match, 'home')} size={compact ? 'md' : 'lg'} />
                        <div className="min-w-0 truncate text-sm font-bold text-slate-900">{getTeamName(match, 'home')}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center score-number font-mono text-xl font-black text-slate-900">
                        {homeSets} <span className="text-slate-300">-</span> {awaySets}
                    </div>
                    <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-right">
                        <TeamBadge name={getTeamName(match, 'away')} logoUrl={getTeamLogo(match, 'away')} size={compact ? 'md' : 'lg'} />
                        <div className="min-w-0 truncate text-sm font-bold text-slate-900">{getTeamName(match, 'away')}</div>
                    </div>
                </div>

                {!compact && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><CalendarDays size={13} />{match.match_date ? formatThaiDate(match.match_date) : '-'}</span>
                        <span className="flex items-center gap-1"><MapPin size={13} />{match.stadium_name || match.location || '-'}</span>
                        {match.round_name && <span>{match.round_name}</span>}
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="app-page min-h-screen pb-16 font-sans text-slate-800">
            <PublicHeader />
            {(loadError || competitionError || statisticsError) && <div className="mx-auto max-w-[1400px] px-4 py-4"><Feedback error title={isThai ? 'โหลดข้อมูลไม่สำเร็จ' : 'Unable to load competition data'} description={isThai ? 'ตรวจสอบการเชื่อมต่อแล้วลองใหม่' : 'Check your connection and try again.'} onRetry={() => setReloadKey(key => key + 1)} retryLabel={isThai ? 'ลองใหม่' : 'Retry'} /></div>}

            <section className="bg-[#122b52] text-white">
                <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-12">
                    <div className="flex flex-col justify-center">
                        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-50">
                            <Trophy size={15} />
                            {isThai ? 'ศูนย์กลางการแข่งขันวอลเลย์บอล' : 'Volleyball Competition Centre'}
                        </div>
                        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">{isThai ? 'ทุกการแข่งขัน ในที่เดียว' : 'Every match. One place.'}</h1>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-blue-50 md:text-lg">
                            {isThai
                                ? 'ติดตามแมตช์สด ตารางแข่งขัน ผลการแข่งขัน ตารางคะแนน และสถิตินักกีฬาของทุกรายการแข่งขัน'
                                : 'Follow live matches, schedules, results, standings, and player statistics across competitions.'}
                        </p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            <button onClick={() => navigate('/matches')} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-blue-950 hover:bg-blue-50">
                                {isThai ? 'ดูตารางแข่งขัน' : 'View Schedule'} <ArrowRight size={18} />
                            </button>
                            <button onClick={() => navigate('/teams')} className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
                                {isThai ? 'ทีมเข้าร่วม' : 'Teams'} <Users size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={liveMatches.length ? 'live' : 'info'} dot>{liveMatches.length ? 'LIVE' : (isThai ? 'แมตช์เด่น' : 'Featured')}</StatusBadge>{lastUpdated && <span className="text-xs text-blue-100">{isThai ? 'อัปเดต' : 'Updated'} {lastUpdated.toLocaleTimeString(isThai ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}</div>
                                <div className="mt-1 text-lg font-black">{selectedTitle}</div>
                            </div>
                            {featuredMatch && (
                                <button onClick={() => navigate(`/match-centre/${featuredMatch.id}`)} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-950 hover:bg-blue-50">
                                    Match Centre
                                </button>
                            )}
                        </div>
                        <MatchCard match={featuredMatch} />
                    </div>
                </div>
            </section>

            <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h2 className="flex items-center gap-2 text-xl font-black text-blue-950">
                                <Trophy size={22} /> {isThai ? 'เลือกรายการแข่งขัน' : 'Choose Competition'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {isThai ? 'เลือกชื่อรายการหลัก แล้วเลือกประเภทหรือรุ่นการแข่งขันด้านล่าง' : 'Choose a competition, then select a category below.'}
                            </p>
                        </div>
                        <select
                            value={selectedGroup?.key || ''}
                            onChange={(event) => selectCompetitionGroup(event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:max-w-sm"
                        >
                            {competitionGroups.length === 0 ? (
                                <option>{isThai ? 'ไม่มีรายการแข่งขัน' : 'No competition'}</option>
                            ) : competitionGroups.map((group) => (
                                <option key={group.key} value={group.key}>{group.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {competitionGroups.map((group) => {
                            const isSelected = group.key === selectedGroup?.key;
                            return (
                                <button
                                    key={group.key}
                                    type="button"
                                    onClick={() => setSelectedCompetitionId(String(group.items[0]?.id || ''))}
                                    className={`flex min-h-[86px] items-center gap-3 rounded-xl border p-3 text-left transition ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                        {group.logo_url ? <img src={group.logo_url} alt={group.title} className="h-full w-full object-contain p-1" /> : <Trophy size={22} className="text-slate-300" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-black text-slate-900">{group.title}</div>
                                        <div className="mt-1 text-xs text-slate-500">{group.items.length} {isThai ? 'รุ่น/ประเภท' : 'categories'}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selectedGroup?.items.length > 1 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {selectedGroup.items.map((competition) => (
                                <button
                                    key={competition.id}
                                    type="button"
                                    onClick={() => setSelectedCompetitionId(String(competition.id))}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${String(selectedCompetitionId) === String(competition.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'}`}
                                >
                                    {getPublicCompetitionVariantLabel(competition, language)}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="space-y-6">
                        <div className="rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                <h2 className="flex items-center gap-2 font-black text-blue-950">
                                    <CalendarDays size={20} /> {isThai ? 'โปรแกรมและผลล่าสุด' : 'Schedule & Results'}
                                </h2>
                                <button onClick={() => navigate('/matches')} className="text-sm font-bold text-blue-600 hover:text-blue-700">
                                    {isThai ? 'ดูทั้งหมด' : 'View all'}
                                </button>
                            </div>
                            <div className="space-y-3 p-5">
                                {loading ? (
                                    <div className="py-12 text-center text-sm text-slate-500">{t('common.loading')}</div>
                                ) : matches.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500">
                                        {isThai ? 'ยังไม่มีโปรแกรมการแข่งขันในรายการนี้' : 'No matches in this competition yet.'}
                                    </div>
                                ) : (
                                    [...liveMatches, ...upcomingMatches, ...recentResults].slice(0, 5).map((match) => (
                                        <MatchCard key={match.id} match={match} compact />
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {quickLinks.map((link) => (
                                <button
                                    key={link.path}
                                    onClick={() => navigate(link.path)}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm font-black text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                                >
                                    {link.icon} {link.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <aside className="space-y-6">
                        <div className="rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                <h2 className="flex items-center gap-2 font-black text-blue-950">
                                    <BarChart3 size={20} /> {isThai ? 'อันดับทีม' : 'Standings'}
                                </h2>
                                <button onClick={() => navigate('/standings')} className="text-sm font-bold text-blue-600 hover:text-blue-700">
                                    {isThai ? 'ตารางเต็ม' : 'Full table'}
                                </button>
                            </div>
                            <div className="p-5">
                                {standingsPreview.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                                        {isThai ? 'ยังไม่มีคะแนนสะสม' : 'No standings yet.'}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {standingsPreview.map((team, index) => (
                                            <div key={team.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                                <div className="w-6 text-center text-sm font-black text-blue-700">{index + 1}</div>
                                                <TeamBadge name={team.name} logoUrl={team.logo_url} />
                                                <div className="min-w-0 flex-1 truncate text-sm font-bold">{team.name}</div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-slate-900">{team.points}</div>
                                                    <div className="text-[10px] uppercase text-slate-400">PTS</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                <h2 className="flex items-center gap-2 font-black text-blue-950">
                                    <Star size={20} /> {isThai ? 'นักกีฬาน่าสนใจ' : 'Top Performers'}
                                </h2>
                                <button onClick={() => navigate('/stats')} className="text-sm font-bold text-blue-600 hover:text-blue-700">
                                    {isThai ? 'สถิติทั้งหมด' : 'All stats'}
                                </button>
                            </div>
                            <div className="p-5">
                                {topPlayers.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                                        {isThai ? 'ยังไม่มีข้อมูลสถิตินักกีฬา' : 'No player statistics yet.'}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {topPlayers.map((item) => (
                                            <div key={item.key} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                                                    {item.icon}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-slate-500">{item.label}</div>
                                                    <div className="truncate text-sm font-black text-slate-900">
                                                        {item.player.player_name || item.player.name || `${item.player.first_name || ''} ${item.player.last_name || ''}`.trim() || '-'}
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm font-black text-blue-700">
                                                    {item.player.total ?? item.player.points ?? item.player.value ?? ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </section>
            </main>

            <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
                Copyright {new Date().getFullYear()} Volley Manager. All rights reserved.
            </footer>
        </div>
    );
}
