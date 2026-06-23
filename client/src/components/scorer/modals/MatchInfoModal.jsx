import React, { useState } from 'react';

export default function MatchInfoModal({ isOpen, matchData, onConfirm, onCancel }) {
    if (!isOpen) return null;

    // จำลองฟอร์มเบื้องต้น ดึงข้อมูลชื่อทีมและรายการมาจาก matchData
    const [formData, setFormData] = useState({
        competition: matchData?.competitionName || 'TEST Competition - TEST Championship',
        matchNo: matchData?.matchNo || '',
        date: matchData?.matchDate || '',
        teamHome: matchData?.teamHome || '<Choose a team>',
        teamAway: matchData?.teamAway || '<Choose a team>',
    });

    const handleSubmit = () => {
        // เมื่อกด OK ให้ส่งข้อมูลกลับไปและเปลี่ยนไปหน้าถัดไป (Coin Toss)
        onConfirm(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] select-none">
            {/* กล่องหลัก */}
            <div className="bg-white border-2 border-[#000080] w-[850px] shadow-2xl font-sans flex flex-col text-[11px] text-gray-700 relative">
                
                {/* Header */}
                <div className="bg-[#000080] text-white flex justify-between items-center px-2 py-1">
                    <span className="font-bold">Match info</span>
                    <span className="text-white/80">{formData.competition}</span>
                </div>

                {/* Body Content */}
                <div className="p-3 flex flex-col gap-3">
                    
                    {/* Row 1: Competition */}
                    <div className="flex gap-2 items-center">
                        <input type="text" value={formData.competition} readOnly className="flex-1 bg-[#b3c6ff] border border-[#8aaee0] h-6 px-2 font-bold text-black" />
                        <input type="text" value="2010 CEV J" readOnly className="w-24 bg-[#b3c6ff] border border-[#8aaee0] h-6 px-2 text-center" />
                        <input type="text" value="Men's" readOnly className="w-20 bg-[#b3c6ff] border border-[#8aaee0] h-6 px-2 text-center" />
                        <input type="text" value="Club Male" readOnly className="w-20 bg-[#b3c6ff] border border-[#8aaee0] h-6 px-2 text-center" />
                    </div>

                    {/* Row 2: Match No. */}
                    <div className="flex gap-4 items-center pl-8">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 w-16 text-right">Match no.</span>
                            <input type="text" value={formData.matchNo} className="w-16 border border-gray-400 h-5 px-1" />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 w-12 text-right">Day no.</span>
                            <input type="text" className="w-12 border border-gray-400 h-5 px-1" />
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                            <span className="text-gray-500 w-10 text-right">Phase</span>
                            <select className="flex-1 border border-gray-400 h-5 px-1 bg-white"></select>
                        </div>
                    </div>

                    {/* Row 3: Date & Time */}
                    <div className="flex gap-4 items-center pl-10">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 w-10 text-right">Date</span>
                            <input type="text" defaultValue="11/ 4/ 2569" className="w-24 border border-gray-400 h-5 px-1" />
                        </div>
                        <div className="flex items-center gap-1 flex-1 justify-center">
                            <span className="text-gray-500 text-right">Scheduled time</span>
                            <input type="text" defaultValue="  .  " className="w-14 border border-gray-400 h-5 px-1 text-center" />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-right">Real Starting Time</span>
                            <input type="text" className="w-20 bg-[#b3c6ff] border border-[#8aaee0] h-5 px-1" readOnly />
                        </div>
                    </div>

                    {/* Row 4: Teams */}
                    <div className="flex gap-6 mt-2">
                        {/* Team A (Blue) */}
                        <div className="flex-1 flex items-center gap-2">
                            {/* Shirt Icon */}
                            <svg viewBox="0 0 24 24" fill="#0066ff" className="w-10 h-10 drop-shadow-md">
                                <path d="M4 6 L10 2 L14 2 L20 6 L18 12 L16 10 L16 22 L8 22 L8 10 L6 12 Z" stroke="#000" strokeWidth="1" />
                            </svg>
                            <select className="flex-1 bg-[#0066ff] text-white border-2 border-[#0044cc] h-8 font-bold text-base px-2 shadow-sm text-center">
                                <option>{formData.teamHome}</option>
                            </select>
                        </div>
                        {/* Team B (Pink) */}
                        <div className="flex-1 flex items-center gap-2">
                            <select className="flex-1 bg-[#ff00ff] text-white border-2 border-[#cc00cc] h-8 font-bold text-base px-2 shadow-sm text-center">
                                <option>{formData.teamAway}</option>
                            </select>
                            {/* Shirt Icon */}
                            <svg viewBox="0 0 24 24" fill="#ff00ff" className="w-10 h-10 drop-shadow-md">
                                <path d="M4 6 L10 2 L14 2 L20 6 L18 12 L16 10 L16 22 L8 22 L8 10 L6 12 Z" stroke="#000" strokeWidth="1" />
                            </svg>
                        </div>
                    </div>

                    {/* Row 5: Location */}
                    <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 w-14 text-right">Country</span>
                            <input type="text" className="w-24 border border-gray-400 h-5 px-1" />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 w-10 text-right">City</span>
                            <input type="text" className="w-32 border border-gray-400 h-5 px-1" />
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                            <span className="text-gray-500 w-10 text-right">Hall</span>
                            <input type="text" className="flex-1 border border-gray-400 h-5 px-1" />
                        </div>
                    </div>

                    {/* Row 6: Details */}
                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 w-14 text-right">Spectators</span>
                            <input type="text" className="w-24 border border-gray-400 h-5 px-1" />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 w-14 text-right">Receipts</span>
                            <input type="text" className="w-28 border border-gray-400 h-5 px-1 text-right" />
                            <span>$</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 pl-4">
                            <span className="text-gray-500 text-right">COVID</span>
                            <select className="flex-1 border border-gray-400 h-5 px-1 bg-white">
                                <option>CHANGE COURT ENABLED</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 7: Webcast & Referees Grid */}
                    <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 mt-2">
                        {/* Left Column (Referees) */}
                        <div className="flex flex-col gap-1">
                            <div className="grid grid-cols-[70px_100px_100px_100px_30px] gap-1 text-center text-gray-500 italic mb-1">
                                <span></span><span>Family name</span><span>First name</span><span>City/Region</span><span>Nat</span>
                            </div>
                            {['1st Referee', '2nd Referee', 'Scorer', 'Assistant', 'Challenge Operator'].map((role, idx) => (
                                <div key={idx} className="grid grid-cols-[70px_100px_100px_100px_30px] gap-1 items-center">
                                    <div className="text-right text-gray-500 flex justify-end gap-1">
                                        {role} {(idx === 0 || idx === 1) && <select className="w-4 border border-gray-400 h-4 bg-gray-200"></select>}
                                    </div>
                                    <input type="text" className="border border-gray-400 h-5 px-1" />
                                    <input type="text" className="border border-gray-400 h-5 px-1" />
                                    <input type="text" className="border border-gray-400 h-5 px-1" />
                                    <input type="text" className="border border-gray-400 h-5 px-1" />
                                </div>
                            ))}
                        </div>

                        {/* Right Column (Webcast & Line Judges) */}
                        <div className="flex flex-col gap-1">
                            <div className="flex gap-2 items-center mb-1">
                                <span className="text-gray-500">Webcast Id</span>
                                <input type="text" className="w-20 bg-[#b3c6ff] border border-[#8aaee0] h-5 px-1" readOnly />
                                <span className="text-gray-500 ml-2">GameKey</span>
                                <input type="text" className="flex-1 bg-[#b3c6ff] border border-[#8aaee0] h-5 px-1" readOnly />
                            </div>
                            <div className="flex gap-1 items-center mb-4">
                                <span className="text-gray-500 w-[60px] text-right">Supervisor</span>
                                <select className="flex-1 border border-gray-400 h-5 px-1 bg-white"></select>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                    <div className="grid grid-cols-[70px_100px_100px] gap-1 text-center text-gray-500 italic mb-1">
                                        <span></span><span>Family name</span><span>First name</span>
                                    </div>
                                    {['Line Judge # 1', 'Line Judge # 2'].map((role, idx) => (
                                        <div key={idx} className="grid grid-cols-[70px_100px_100px] gap-1 items-center mb-1">
                                            <span className="text-right text-gray-500">{role}</span>
                                            <input type="text" className="border border-gray-400 h-5 px-1" />
                                            <input type="text" className="border border-gray-400 h-5 px-1" />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="grid grid-cols-[70px_100px_100px] gap-1 text-center text-gray-500 italic mb-1">
                                        <span></span><span>Family name</span><span>First name</span>
                                    </div>
                                    {['Line Judge # 3', 'Line Judge # 4'].map((role, idx) => (
                                        <div key={idx} className="grid grid-cols-[70px_100px_100px] gap-1 items-center mb-1">
                                            <span className="text-right text-gray-500">{role}</span>
                                            <input type="text" className="border border-gray-400 h-5 px-1" />
                                            <input type="text" className="border border-gray-400 h-5 px-1" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-2 flex gap-2 p-2 border-t border-gray-300">
                    <div className="flex-1 bg-[#ffedcc] border border-orange-300 p-2 text-center font-semibold text-[10px]">
                        Live Score Support wants to communicate with you: indicate a phone<br />
                        number of a person who could be contacted for urgent communications.<br />
                        <span className="font-bold mr-2">PHONE</span>
                        <input type="text" className="w-40 border border-gray-400 h-5 px-1" />
                    </div>
                    <div className="flex gap-2 items-end pb-1">
                        <button className="bg-[#cccccc] hover:bg-gray-400 text-black font-bold h-8 px-6 border border-gray-500 shadow-sm">
                            Comments
                        </button>
                        <button onClick={handleSubmit} className="bg-[#0044cc] hover:bg-blue-800 text-white font-bold h-8 w-40 border border-[#000080] shadow-sm">
                            Ok
                        </button>
                        <button onClick={onCancel} className="bg-[#666666] hover:bg-gray-600 text-white font-bold h-8 px-8 border border-gray-800 shadow-sm">
                            Cancel
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}