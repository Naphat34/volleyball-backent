import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const RosterVerification = () => {
    const { matchId } = useParams();
    const [matchData, setMatchData] = useState(null);
    const [homePlayers, setHomePlayers] = useState([]);
    const [awayPlayers, setAwayPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.getMatchScoresheetData(matchId);
                const data = res.data;
                setMatchData(data.match);
                setHomePlayers(data.homePlayers || []);
                setAwayPlayers(data.awayPlayers || []);
            } catch (err) {
                console.error("Failed to fetch match data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [matchId]);

    if (loading) return <div className="p-8 text-center text-gray-600 font-semibold">Loading Roster Verification...</div>;
    if (!matchData) return <div className="p-8 text-center text-red-500 font-bold">Match Data Not Found</div>;

    const compName = matchData.competition_name || matchData.competition_title || '';
    const matchNo = matchData.match_number || '';
    const city = matchData.city || matchData.stadium_city || '';
    const hall = matchData.location || matchData.stadium_name || '';
    const country = matchData.country || '';

    const getPlayerNo = (p) => p ? (p.number || p.shirt_number || p.jersey_number || '') : '';
    const getPlayerName = (p) => p ? `${p.first_name || ''} ${p.last_name || ''}`.trim().toUpperCase() : '';
    const getPlayerNat = (p) => p ? (p.nationality || '') : '';
    const getPlayerBirth = (p) => {
        if (!p || !p.birth_date) return '';
        try {
            const date = new Date(p.birth_date);
            if (isNaN(date.getTime())) return p.birth_date;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return p.birth_date;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 py-6 print:p-0 print:bg-white text-black font-sans">
            {/* Action Bar for Screen Only */}
            <div className="max-w-[287mm] mx-auto mb-4 flex justify-between items-center print:hidden px-4">
                <button 
                    onClick={() => window.history.back()}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 shadow transition-all font-semibold"
                >
                    Back
                </button>
                <button 
                    onClick={() => window.print()}
                    className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow transition-all"
                >
                    Print Roster Verification
                </button>
            </div>

            {/* Print Container (A4 Landscape) */}
            <div id="o2-form" className="w-[287mm] h-[198mm] bg-white mx-auto border border-gray-300 print:border-none shadow-lg print:shadow-none p-[6mm] flex flex-col justify-between box-border relative">
                
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
                            <span className="text-[10px] text-gray-700 uppercase font-semibold">Match no:</span>
                            <span className="font-bold text-sm text-center">{matchNo}</span>
                        </div>
                        {/* City / Hall */}
                        <div className="w-[45%] border-r-2 border-black flex flex-col justify-center px-3">
                            <div className="flex gap-1.5">
                                <span className="text-[10px] text-gray-700 font-semibold">City:</span>
                                <span className="font-bold">{city}</span>
                            </div>
                            <div className="flex gap-1.5 mt-0.5">
                                <span className="text-[10px] text-gray-700 font-semibold">Hall:</span>
                                <span className="font-bold truncate">{hall}</span>
                            </div>
                        </div>
                        {/* Country */}
                        <div className="w-[25%] flex flex-col justify-center px-3">
                            <span className="text-[10px] text-gray-700 uppercase font-semibold">Country:</span>
                            <span className="font-bold">{country}</span>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center my-2.5">
                    <h2 className="text-lg font-bold tracking-widest uppercase">Roster Verification</h2>
                </div>

                {/* Main Tables (Side-by-Side) */}
                <div className="flex flex-row justify-between gap-6 flex-grow">
                    
                    {/* Left Table: Team A */}
                    <div className="flex-1 flex flex-col">
                        <table className="w-full border-2 border-black table-fixed border-collapse">
                            <thead>
                                {/* Team Name Row */}
                                <tr>
                                    <th colSpan="4" className="bg-gray-200 border-b-2 border-black py-0.5 px-2 text-center font-bold text-lg truncate uppercase">
                                        {matchData.home_team_name || 'Team A'}
                                    </th>
                                </tr>
                                {/* Headers Row */}
                                <tr className="border-b-2 border-black text-center text-[12px] font-bold">
                                    <th className="w-[5%] border-r border-black py-0.5">N</th>
                                    <th className="w-[75%] border-r border-black py-0.5 text-left px-2">Name of the player</th>
                                    <th className="w-[7%] border-r border-black py-0.5">Nat.</th>
                                    <th className="w-[13%] py-0.5">Brith Day</th>
                                </tr>
                            </thead>
                            <tbody>
                                {homePlayers.map((p, idx) => (
                                    <tr key={`home-${idx}`} className="border-b border-black text-[12px] h-[6.2mm]">
                                        <td className="border-r border-black text-center font-bold bg-gray-50/50 print:bg-white">{getPlayerNo(p)}</td>
                                        <td className="border-r border-black px-2 truncate font-medium">{getPlayerName(p)}</td>
                                        <td className="border-r border-black text-center truncate">{getPlayerNat(p)}</td>
                                        <td className="text-center text-[10px] truncate">{getPlayerBirth(p)}</td>
                                    </tr>
                                ))}
                                {/* Officials Row */}
                                <tr className="bg-gray-200 border-t border-black text-[10px] font-bold text-center h-[6.5mm]">
                                    <td colSpan="4" className="py-0.5 tracking-wider">OFFICIALS</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Right Table: Team B */}
                    <div className="flex-1 flex flex-col">
                        <table className="w-full border-2 border-black table-fixed border-collapse">
                            <thead>
                                {/* Team Name Row */}
                                <tr>
                                    <th colSpan="4" className="bg-gray-200 border-b-2 border-black py-0.5 px-2 text-center font-bold text-lg truncate uppercase">
                                        {matchData.away_team_name || 'Team B'}
                                    </th>
                                </tr>
                                {/* Headers Row */}
                                <tr className="border-b-2 border-black text-center text-[12px] font-bold">
                                    <th className="w-[5%] border-r border-black py-0.5">N</th>
                                    <th className="w-[75%] border-r border-black py-0.5 text-left px-2">Name of the player</th>
                                    <th className="w-[7%] border-r border-black py-0.5">Nat.</th>
                                    <th className="w-[13%] py-0.5">Brith Day</th>
                                </tr>
                            </thead>
                            <tbody>
                                {awayPlayers.map((p, idx) => (
                                    <tr key={`away-${idx}`} className="border-b border-black text-[12px] h-[6.2mm]">
                                        <td className="border-r border-black text-center font-bold bg-gray-50/50 print:bg-white">{getPlayerNo(p)}</td>
                                        <td className="border-r border-black px-2 truncate font-medium">{getPlayerName(p)}</td>
                                        <td className="border-r border-black text-center truncate">{getPlayerNat(p)}</td>
                                        <td className="text-center text-[10px] truncate">{getPlayerBirth(p)}</td>
                                    </tr>
                                ))}
                                {/* Officials Row */}
                                <tr className="bg-gray-200 border-t border-black text-[10px] font-bold text-center h-[6.5mm]">
                                    <td colSpan="4" className="py-0.5 tracking-wider">OFFICIALS</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Signatures Section */}
                <div className="mt-3 pt-1 flex flex-col items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-2">Signature</h3>
                    <div className="w-[95%] flex flex-col gap-2">
                        {/* Coach Row */}
                        <div className="flex justify-between items-center text-xs font-semibold">
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                            <div className="w-[16%] text-center uppercase tracking-wider text-gray-800">Coach</div>
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                        </div>
                        {/* Captain Row */}
                        <div className="flex justify-between items-center text-xs font-semibold">
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                            <div className="w-[16%] text-center uppercase tracking-wider text-gray-800">Captain</div>
                            <div className="w-[42%] border-b border-black border-dashed h-4"></div>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="absolute bottom-2 left-[6mm] text-[9px] text-gray-500 font-mono tracking-tight print:text-black">
                    Printed by ({(() => {
                        try {
                            const u = localStorage.getItem('user');
                            return u ? JSON.parse(u).username : 'Admin';
                        } catch {
                            return 'Admin';
                        }
                    })()}) eScorersheet Version DEMO 2026.06.11
                </div>

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
                        height: 198mm !important;
                    }
                }
            `}} />
        </div>
    );
};

export default RosterVerification;
