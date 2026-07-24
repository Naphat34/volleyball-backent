import React from 'react';
import ballIcon from '../assets/img/match-court-ball.svg';
import matchCourt from '../assets/img/match-court.svg';
import AngleDownIcon from '../assets/img/angle-down.svg';

const getContrastColorClass = (hexColor) => {
    if (!hexColor || !hexColor.startsWith('#')) return 'text-white';
    const cleanHex = hexColor.substring(0, 7).replace('#', '');
    if (cleanHex.length !== 6) return 'text-white';
    
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'text-black' : 'text-white';
};

// Component ย่อย: ตัวผู้เล่นในสนาม (Declared outside of CourtView to prevent recreate-on-render issue)
const PlayerToken = ({ 
    player, 
    side, 
    originalPlayer, 
    colorClass, 
    onClick,
    hideTokens,
    leftSubTracker,
    rightSubTracker,
    leftTeam,
    rightTeam,
    tokenNumberClass = 'text-[28.5px] lg:text-[57px]',
    tokenBoxClass = 'w-[53px] h-[53px] lg:w-[91px] lg:h-[91px]'
}) => {
    if (hideTokens) return null;
    if (!player) return null;

    const pId = player?.id || player?.player_id;
    
    // 1. เช็ค Libero Swap
    const isLiberoSwap = originalPlayer != null;
    
    // 2. เช็ค Regular Substitution
    let starterNumber = null;
    const currentTracker = side === 'left' ? leftSubTracker : rightSubTracker;
    const currentRoster = side === 'left' ? leftTeam?.roster : rightTeam?.roster;
    
    if (!isLiberoSwap && currentTracker && currentTracker.positions && pId != null) {
        const trackedPair = Object.values(currentTracker.positions).find(posData => {
            if (!posData) return false;
            const starterId = posData.starterId;
            const subId = posData.subId;
            return [starterId, subId].some(id => id != null && String(id) === String(pId));
        });

        if (trackedPair) {
            const isStarterOnCourt = String(trackedPair.starterId) === String(pId);
            const counterpartId = isStarterOnCourt ? trackedPair.subId : trackedPair.starterId;
            starterNumber = isStarterOnCourt ? trackedPair.subNumber : trackedPair.starterNumber;

            if (!starterNumber && counterpartId != null) {
                const counterpart = currentRoster?.find(r => String(r.id || r.player_id) === String(counterpartId));
                if (counterpart) starterNumber = counterpart.number;
            }
        }
    }

    const isLibero = (player && player.isLibero) || isLiberoSwap;
    const isHex = colorClass && colorClass.startsWith('#');
    
    const finalColorClass = isLibero ? 'bg-[#ffff99]' : (isHex ? '' : colorClass);
    const finalStyle = (!isLibero && isHex) ? { backgroundColor: colorClass } : {};
    const finalTextColorClass = isLibero ? 'text-black' : getContrastColorClass(colorClass);
    const isCaptain = player?.isCaptain || player?.is_captain || player?.role === 'C' || player?.role?.includes('C');

    return (
        <div 
            className="flex flex-col items-center justify-center w-full h-full p-1 group cursor-pointer"
            onClick={onClick}
        >
            <div 
                className={`
                    relative
                    ${tokenBoxClass}
                    rounded-md lg:rounded-xl border-[2px] border-white 
                    flex flex-col items-center justify-center 
                    transition-transform transform group-hover:scale-105 hover:border-blue-500
                    ${finalColorClass}
                `}
                style={finalStyle}
            >
                {/* หมายเลขตรงกลาง */}
                <span className={`
                    ${tokenNumberClass} font-bold drop-shadow-sm leading-none
                    ${finalTextColorClass}
                    ${isCaptain ? 'border-b-[3px] lg:border-b-[6px] border-current pb-0.5' : ''}
                `}>
                    {player ? player.number : ''}
                </span>

                {/* หมายเลขผู้เล่นตัวจริงที่ถูกเปลี่ยนออก (มุมขวาล่างสำหรับ Libero Swap) */}
                {(isLiberoSwap && originalPlayer && !player?.replacedLiberoNumber) && (
                    <div className="absolute -bottom-1 -right-1 lg:-bottom-2 lg:-right-2 w-5 h-5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center bg-slate-500 text-white text-[9px] lg:text-[12px] font-extrabold shadow-md border border-white leading-none">
                        {originalPlayer.number}
                    </div>
                )}

                {/* หมายเลข Libero ที่ถูกเปลี่ยนออก (กรณี Libero-to-Libero swap) */}
                {(isLiberoSwap && player?.replacedLiberoNumber) && (
                    <div className="absolute -bottom-1 -left-1 lg:-bottom-2 lg:-left-2 w-5 h-5 lg:w-7 lg:h-7 rounded-full flex items-center justify-center bg-amber-500 text-white text-[9px] lg:text-[12px] font-extrabold shadow-md border border-white leading-none" title={`ตัวรับอิสระที่ถูกเปลี่ยนตัวออกหมายเลข #${player.replacedLiberoNumber}`}>
                        {player.replacedLiberoNumber}
                    </div>
                )}
                
                {/* หมายเลขผู้เล่นตัวจริงที่ถูกเปลี่ยนออก (สำหรับ Substitution ปกติ) */}
                {(!isLiberoSwap && starterNumber) && (
                    <div
                        className={"absolute bottom-1 right-1 lg:-bottom-1 lg:-right-2 w-6 h-6 lg:w-11 lg:h-7 rounded-sm flex items-center justify-center bg-white text-slate-900 text-[9px] lg:text-[12px] font-extrabold shadow-md leading-none"}
                        style={isHex ? { borderColor: colorClass, borderWidth: '2px' } : {}}
                    >
                        <span className="text-rose-600 mr-1.5"><img src={AngleDownIcon} alt="Down" className="w-3 h-3"/></span>
                        <span>{starterNumber}</span>
                    </div>
                )}
            </div>
            
            <div className="mt-1 text-center w-full">
                {player && (
                    <div className="hidden lg:flex items-center justify-center gap-0.5 text-[10px] font-medium text-white drop-shadow-md w-full">
                        <span className="truncate max-w-[60px]">
                            {player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const CourtView = ({ 
    homePositions = [], 
    awayPositions = [], 
    servingSide, 
    hideTokens = false, 
    onPlayerClick, 
    leftTeam,
    rightTeam,
    homeSubTracker,
    awaySubTracker,
    isHomeLeft,
    tokenNumberClass,
    tokenBoxClass,
    className = 'max-w-3xl'
}) => {

    const leftColor = leftTeam?.bg || 'bg-blue-600';
    const rightColor = rightTeam?.bg || 'bg-pink-600';

    // ดึงประวัติการเปลี่ยนตัว Libero และ Substitution ของฝั่งซ้ายและขวา
    const leftSwaps = leftTeam?.liberoSwaps || {};
    const rightSwaps = rightTeam?.liberoSwaps || {};
    
    const leftSubTracker = leftTeam?.code === 'home' ? homeSubTracker : (leftTeam?.code === 'away' ? awaySubTracker : (isHomeLeft ? homeSubTracker : awaySubTracker));
    const rightSubTracker = rightTeam?.code === 'home' ? homeSubTracker : (rightTeam?.code === 'away' ? awaySubTracker : (isHomeLeft ? awaySubTracker : homeSubTracker));

    const commonProps = {
        hideTokens,
        leftSubTracker,
        rightSubTracker,
        leftTeam,
        rightTeam,
        tokenNumberClass,
        tokenBoxClass
    };

    return (
        <div className={`w-full mx-auto ${className}`}>
            <div className="relative w-full aspect-[538/300] rounded-sm overflow-hidden flex select-none">
                
                {/* Background Image */}
                <img 
                    src={matchCourt} 
                    alt="Volleyball Court" 
                    className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0" 
                />

                {/* --- HOME TEAM (ซ้าย) --- */}
                <div className="flex-1 relative h-full z-10">
                    <div className="absolute inset-y-[10%] left-[10.8%] right-0 z-10 rounded-sm">
                        <div className="grid grid-cols-2 grid-rows-3 w-full h-full relative">
                            {/* Row 1 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="left" posIndex={4} player={homePositions[4]} originalPlayer={leftSwaps[4]} colorClass={leftColor} onClick={() => onPlayerClick && onPlayerClick('home', 4)} /></div> {/* P5 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="left" posIndex={3} player={homePositions[3]} originalPlayer={leftSwaps[3]} colorClass={leftColor} onClick={() => onPlayerClick && onPlayerClick('home', 3)} /></div> {/* P4 */}
                            {/* Row 2 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="left" posIndex={5} player={homePositions[5]} originalPlayer={leftSwaps[5]} colorClass={leftColor} onClick={() => onPlayerClick && onPlayerClick('home', 5)} /></div> {/* P6 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="left" posIndex={2} player={homePositions[2]} originalPlayer={leftSwaps[2]} colorClass={leftColor} onClick={() => onPlayerClick && onPlayerClick('home', 2)} /></div> {/* P3 */}
                            {/* Row 3 */}
                            <div className="flex items-center justify-center relative">
                                <PlayerToken {...commonProps} side="left" posIndex={0} player={homePositions[0]} originalPlayer={leftSwaps[0]} colorClass={leftColor} onClick={() => onPlayerClick && onPlayerClick('home', 0)} /> {/* P1 */}
                                {servingSide === 'left' && !hideTokens && (
                                    <div className="absolute -bottom-2 -left-4 lg:-left-6 text-xl lg:text-3xl drop-shadow-md z-20">
                                        <img src={ballIcon} width="70px" height="70px" alt="ball"/>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="left" posIndex={1} player={homePositions[1]} originalPlayer={leftSwaps[1]} colorClass={leftColor} onClick={() => onPlayerClick && onPlayerClick('home', 1)} /></div> {/* P2 */}
                        </div>
                    </div>
                </div>
            
                {/* --- AWAY TEAM (ขวา) --- */}
                <div className="flex-1 relative h-full z-10">
                    <div className="absolute inset-y-[10%] right-[10.8%] left-0 z-10 rounded-sm">
                        <div className="grid grid-cols-2 grid-rows-3 w-full h-full relative">
                            {/* Row 1 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="right" posIndex={1} player={awayPositions[1]} originalPlayer={rightSwaps[1]} colorClass={rightColor} onClick={() => onPlayerClick && onPlayerClick('away', 1)} /></div> {/* P2 */}
                            <div className="flex items-center justify-center relative">
                                <PlayerToken {...commonProps} side="right" posIndex={0} player={awayPositions[0]} originalPlayer={rightSwaps[0]} colorClass={rightColor} onClick={() => onPlayerClick && onPlayerClick('away', 0)} /> {/* P1 */}
                                {servingSide === 'right' && !hideTokens && (
                                    <div className="absolute -top-2 -right-4 lg:-right-6 text-xl lg:text-3xl drop-shadow-md z-20">
                                        <img src={ballIcon} width="70px" height="70px" alt="ball"/>
                                    </div>
                                )}
                            </div>
                            {/* Row 2 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="right" posIndex={2} player={awayPositions[2]} originalPlayer={rightSwaps[2]} colorClass={rightColor} onClick={() => onPlayerClick && onPlayerClick('away', 2)} /></div> {/* P3 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="right" posIndex={5} player={awayPositions[5]} originalPlayer={rightSwaps[5]} colorClass={rightColor} onClick={() => onPlayerClick && onPlayerClick('away', 5)} /></div> {/* P6 */}
                            {/* Row 3 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="right" posIndex={3} player={awayPositions[3]} originalPlayer={rightSwaps[3]} colorClass={rightColor} onClick={() => onPlayerClick && onPlayerClick('away', 3)} /></div> {/* P4 */}
                            <div className="flex items-center justify-center"><PlayerToken {...commonProps} side="right" posIndex={4} player={awayPositions[4]} originalPlayer={rightSwaps[4]} colorClass={rightColor} onClick={() => onPlayerClick && onPlayerClick('away', 4)} /></div> {/* P5 */}
                        </div>
                    </div>
                </div>
            </div>             
        </div>
    );
};

export default CourtView;
