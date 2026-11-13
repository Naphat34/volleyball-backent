import { GuardedButton } from '../../components/ui/GuardedAction';
import useDisplayNames from '../../hooks/useDisplayNames';
import useUiTranslation from '../../hooks/useUiTranslation';
import { StatusBadge } from '../../components/ui/SystemUI';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { cleanCompetitionTitle } from '../../utils/formatters';
import { rosterVerificationModel, rosterBirthDate, rosterRole } from '../../utils/reports/rosterVerification';
import { getStoredUser } from '../../auth/authStorage';

const RosterVerification = () => {
    const displayNames = useDisplayNames('ENG');
    const ui = useUiTranslation('ENG');
    const { matchId } = useParams();
    const [matchData, setMatchData] = useState(null);
    const [homePlayers, setHomePlayers] = useState([]);
    const [awayPlayers, setAwayPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [homeStaff, setHomeStaff] = useState([]), [awayStaff, setAwayStaff] = useState([]);

    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setMatchData(null); setHomePlayers([]); setAwayPlayers([]); setHomeStaff([]); setAwayStaff([]);
        const fetchData = async () => {
            try {
                const res = await api.getMatchRosterData(matchId);
                const data = rosterVerificationModel(res.data);
                if (!active) return;
                setMatchData(data.match);
                setHomePlayers(data.home.players); setAwayPlayers(data.away.players);
                setHomeStaff(data.home.staff); setAwayStaff(data.away.staff);
            } catch (err) {
                if (active) setError(err.response?.status === 404 ? 'Match Data Not Found' : 'Unable to load the match roster. Please reload this page.');
            } finally {
                if (active) setLoading(false);
            }
        };
        void fetchData();
        return () => { active = false; };
    }, [matchId]);

    if (loading) return <div className="p-8 text-center text-gray-600 font-semibold">{ui("Loading Roster Verification...")}</div>;
    if (!matchData) return <div className="p-8 text-center text-red-500 font-bold" role="alert">{error || ui("Match Data Not Found")}</div>;

    const compName = cleanCompetitionTitle(displayNames.competitionName(matchData));
    const matchNo = matchData.match_number || '';
    const city = matchData.city || matchData.stadium_city || '';
    const hall = matchData.stadium_name || matchData.location || '';
    const country = matchData.country || '';

    const getPlayerNo = (p) => p ? (p.number ?? p.shirt_number ?? p.jersey_number ?? '') : '';

    const getPlayerNat = (p) => p ? (ui(p.nationality || p.country || '')) : '';
    const getPlayerBirth = rosterBirthDate;
    const missingEnglishNames = [...homePlayers, ...awayPlayers, ...homeStaff, ...awayStaff]
        .some(person => /[\u0e00-\u0e7f]/.test(displayNames.personName(person)));

    return (
        <div lang="en" className="min-h-screen bg-gray-100 py-6 print:p-0 print:bg-white text-black font-sans">
            {/* Action Bar for Screen Only */}
            <div className="max-w-[287mm] mx-auto mb-4 flex flex-wrap gap-3 justify-between items-center print:hidden px-4">
                <GuardedButton
                    onClick={() => window.history.back()}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 shadow transition-all font-semibold"
                >{ui("Back")}</GuardedButton>
                <GuardedButton
                    onClick={() => window.print()}
                    className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow transition-all"
                >{ui("Print Roster Verification")}</GuardedButton>
            </div>

            <div className="mx-auto mb-4 flex max-w-[287mm] flex-wrap items-center gap-3 px-4 print:hidden"><StatusBadge tone={homePlayers.length && awayPlayers.length ? 'success' : 'warning'}>{homePlayers.length && awayPlayers.length ? ui('Rosters available') : ui('Review missing rosters')}</StatusBadge><span className="text-sm text-slate-600">{ui("Home")}{' '}{homePlayers.length}{' '}{ui("· Away")}{' '}{awayPlayers.length}</span></div>
            {missingEnglishNames && <p role="status" className="mx-auto mb-4 max-w-[287mm] px-4 text-sm text-amber-700 print:hidden">Some English names are not registered. Original names are shown to preserve roster accuracy.</p>}
            {/* Print Container (A4 Landscape) */}
            <div data-theme-paper id="o2-form" className="w-[287mm] min-h-[198mm] bg-white mx-auto border border-gray-300 print:border-none shadow-lg print:shadow-none p-[6mm] pb-[12mm] flex flex-col justify-between box-border relative">

                {/* Top Headers */}
                <div className="flex justify-between gap-4">
                    {/* Left Box */}
                    <div className="w-[45%] h-[15mm] border-2 border-black bg-gray-200 flex items-center justify-center font-bold text-center px-4 uppercase text-sm tracking-wide">
                        {compName}
                    </div>
                    {/* Right Box */}
                    <div className="w-[55%] h-[15mm] border-2 border-black bg-gray-200 flex text-xs">
                        {/* Match No */}
                        <div className="w-[30%] border-r-2 border-black flex flex-col justify-center px-3">
                            <span className="text-[10px] text-gray-700 uppercase font-semibold">{ui("Match no:")}</span>
                            <span className="font-bold text-sm text-center">{matchNo}</span>
                        </div>
                        {/* City / Hall */}
                        <div className="w-[45%] border-r-2 border-black flex flex-col justify-center px-3">
                            <div className="flex gap-1.5">
                                <span className="text-[10px] text-gray-700 font-semibold">{ui("City:")}</span>
                                <span className="font-bold">{city}</span>
                            </div>
                            <div className="flex gap-1.5 mt-0.5">
                                <span className="text-[10px] text-gray-700 font-semibold">{ui("Hall:")}</span>
                                <span className="font-bold truncate">{hall}</span>
                            </div>
                        </div>
                        {/* Country */}
                        <div className="w-[25%] flex flex-col justify-center px-3">
                            <span className="text-[10px] text-gray-700 uppercase font-semibold">{ui("Country:")}</span>
                            <span className="font-bold">{country}</span>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center my-2.5">
                    <h2 className="text-lg font-bold tracking-widest uppercase">{ui("Roster Verification")}</h2>
                </div>

                {/* Main Tables (Side-by-Side) */}
                <div className="flex flex-row justify-between gap-6 flex-grow">

                    {/* Left Table: Team A */}
                    <div className="flex-1 flex flex-col">
                        <table className="w-full border-2 border-black table-fixed border-collapse"><colgroup><col style={{ width: '5%' }} /><col style={{ width: '75%' }} /><col style={{ width: '7%' }} /><col style={{ width: '13%' }} /></colgroup>
                            <thead>
                                {/* Team Name Row */}
                                <tr>
                                    <th colSpan="4" className="bg-gray-200 border-b-2 border-black py-0.5 px-2 text-center font-bold text-lg truncate uppercase">
                                        {(displayNames.matchTeamName(matchData, 'home')) || (ui('Team A'))}
                                    </th>
                                </tr>
                                {/* Headers Row */}
                                <tr className="border-b-2 border-black text-center text-[12px] font-bold">
                                    <th className="w-[5%] border-r border-black py-0.5">{ui("N")}</th>
                                    <th className="w-[75%] border-r border-black py-0.5 text-left px-2">{ui("Name of the player")}</th>
                                    <th className="w-[7%] border-r border-black py-0.5">{ui("Nat.")}</th>
                                    <th className="w-[13%] py-0.5">{ui("Date of Birth")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {homePlayers.map((p, idx) => (
                                    <tr key={`home-${idx}`} className="border-b border-black text-[12px] h-[6.2mm]">
                                        <td className="border-r border-black text-center font-bold bg-gray-50/50 print:bg-white">{getPlayerNo(p)}</td>
                                        <td className="border-r border-black px-2 break-words font-medium">{displayNames.personName(p)}{rosterRole(p) && <span className="ml-1 text-[10px] font-bold">({rosterRole(p)})</span>}</td>
                                        <td className="border-r border-black text-center truncate">{getPlayerNat(p)}</td>
                                        <td className="text-center text-[10px] truncate">{getPlayerBirth(p)}</td>
                                    </tr>
                                ))}
                                {/* Officials Row */}
                                <tr className="bg-gray-200 border-t border-black text-[10px] font-bold text-center h-[6.5mm]">
                                    <td colSpan="4" className="py-0.5 tracking-wider">{ui("OFFICIALS")}</td>
                                </tr>
                                {homeStaff.map((staff, index) => <tr key={staff.id || `staff-${index}`} className="border-b border-black text-[11px] h-[6mm]"><td colSpan="4" className="px-2"><span className="font-semibold">{ui(staff.role || 'Official')}:</span> {displayNames.personName(staff)}</td></tr>)}
                            </tbody>
                        </table>
                    </div>

                    {/* Right Table: Team B */}
                    <div className="flex-1 flex flex-col">
                        <table className="w-full border-2 border-black table-fixed border-collapse"><colgroup><col style={{ width: '5%' }} /><col style={{ width: '75%' }} /><col style={{ width: '7%' }} /><col style={{ width: '13%' }} /></colgroup>
                            <thead>
                                {/* Team Name Row */}
                                <tr>
                                    <th colSpan="4" className="bg-gray-200 border-b-2 border-black py-0.5 px-2 text-center font-bold text-lg truncate uppercase">
                                        {(displayNames.matchTeamName(matchData, 'away')) || (ui('Team B'))}
                                    </th>
                                </tr>
                                {/* Headers Row */}
                                <tr className="border-b-2 border-black text-center text-[12px] font-bold">
                                    <th className="w-[5%] border-r border-black py-0.5">{ui("N")}</th>
                                    <th className="w-[75%] border-r border-black py-0.5 text-left px-2">{ui("Name of the player")}</th>
                                    <th className="w-[7%] border-r border-black py-0.5">{ui("Nat.")}</th>
                                    <th className="w-[13%] py-0.5">{ui("Date of Birth")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awayPlayers.map((p, idx) => (
                                    <tr key={`away-${idx}`} className="border-b border-black text-[12px] h-[6.2mm]">
                                        <td className="border-r border-black text-center font-bold bg-gray-50/50 print:bg-white">{getPlayerNo(p)}</td>
                                        <td className="border-r border-black px-2 break-words font-medium">{displayNames.personName(p)}{rosterRole(p) && <span className="ml-1 text-[10px] font-bold">({rosterRole(p)})</span>}</td>
                                        <td className="border-r border-black text-center truncate">{getPlayerNat(p)}</td>
                                        <td className="text-center text-[10px] truncate">{getPlayerBirth(p)}</td>
                                    </tr>
                                ))}
                                {/* Officials Row */}
                                <tr className="bg-gray-200 border-t border-black text-[10px] font-bold text-center h-[6.5mm]">
                                    <td colSpan="4" className="py-0.5 tracking-wider">{ui("OFFICIALS")}</td>
                                </tr>
                                {awayStaff.map((staff, index) => <tr key={staff.id || `staff-${index}`} className="border-b border-black text-[11px] h-[6mm]"><td colSpan="4" className="px-2"><span className="font-semibold">{ui(staff.role || 'Official')}:</span> {displayNames.personName(staff)}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Signatures Section */}
                <div className="mt-3 pt-1 flex flex-col items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-2">{ui("Signature")}</h3>
                    <div className="w-[95%] flex flex-col gap-2">
                        {/* Coach Row */}
                        <div className="flex justify-between items-center text-xs font-semibold">
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                            <div className="w-[16%] text-center uppercase tracking-wider text-gray-800">{ui("Coach")}</div>
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                        </div>
                        {/* Captain Row */}
                        <div className="flex justify-between items-center text-xs font-semibold">
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                            <div className="w-[16%] text-center uppercase tracking-wider text-gray-800">{ui("Captain")}</div>
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="absolute bottom-2 left-[6mm] text-[9px] text-gray-500 font-mono tracking-tight print:text-black">{ui("Printed by (")}{(() => {
                        return getStoredUser()?.username || 'Admin';
                    })()}{ui(") eScorersheet Version DEMO 2026.06.11")}</div>

            </div>

            {/* Print specific CSS override */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 5mm;
                    }
                    body {
                        background-color: white;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    #o2-form {
                        min-height: 198mm !important;
                        height: auto !important;
                    }
                }
            `}} />
        </div>
    );
};

export default RosterVerification;
