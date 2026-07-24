import React, { useState, useRef, useEffect } from 'react';
import { X, PenTool, RotateCcw } from 'lucide-react';
import { getContrastClass } from '../../../utils/colorUtils';

const SHIRT_COLOR_OPTIONS = [
    '#1e3a8a', '#2563eb', '#0f766e', '#16a34a', '#65a30d',
    '#eab308', '#f97316', '#dc2626', '#be123c', '#9333ea',
    '#334155', '#111827', '#f8fafc'
];

const SignaturePad = ({ width = 500, height = 220, onSave, defaultValue }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(!!defaultValue);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#1e293b'; // slate-800

        if (defaultValue) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = defaultValue;
        }
    }, [defaultValue]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if (e.touches && e.touches.length > 0) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        if (isDrawing) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.closePath();
            setIsDrawing(false);
            if (onSave && hasDrawn) {
                onSave(canvasRef.current.toDataURL('image/png'));
            }
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
        if (onSave) onSave(null);
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="relative rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-inner overflow-hidden aspect-[500/220] max-w-full">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="cursor-crosshair w-full h-full bg-slate-50/50 relative z-10 touch-none"
                />
                {!hasDrawn && (
                    <div className="absolute inset-0 z-0 flex items-center justify-center font-bold text-slate-350 pointer-events-none select-none uppercase tracking-widest text-sm text-slate-300">
                        ลงลายมือชื่อที่นี่ (Sign Here)
                    </div>
                )}
                {hasDrawn && (
                    <button
                        type="button"
                        onClick={clearCanvas}
                        className="absolute top-3 right-3 z-20 bg-white/90 p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-md active:scale-95"
                        title="Clear Signature"
                    >
                        <RotateCcw size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

const LineupModal = ({ 
    isOpen, 
    onClose,
    teamHome, 
    teamAway, 
    homeLogoUrl,
    awayLogoUrl,
    homeLineup, 
    awayLineup, 
    onSlotClick, 
    onConfirm,
    homeRoster = [],
    awayRoster = [],
    teamColors = { home: '#1e3a8a', away: '#eab308' },
    onSetRoster,
    onColorChange,
    onClearTeamLineup,
    signatures = {},
    onSignaturesChange
}) => {
    const [activeField, setActiveField] = useState(null);
    const [activeColorPicker, setActiveColorPicker] = useState(null);
    const tempSignatureRef = useRef(null);

    const handleButtonClick = (field) => {
        tempSignatureRef.current = signatures[field] || null;
        setActiveField(field);
    };

    const getFieldTitle = (field) => {
        switch (field) {
            case 'homeCaptain': return `${teamHome} Captain`;
            case 'homeCoach': return `${teamHome} Coach`;
            case 'awayCaptain': return `${teamAway} Captain`;
            case 'awayCoach': return `${teamAway} Coach`;
            default: return '';
        }
    };

    if (!isOpen) return null;

    // Display player names consistently as First name Last name.
    const formatPlayerName = (player) => {
        const lastName = (player.last_name || player.lastname || '').trim();
        const firstName = (player.first_name || player.firstname || '').trim();
        if (!lastName && !firstName) return '';
        if (!firstName) return lastName;
        if (!lastName) return firstName;
        return `${firstName} ${lastName}`;
    };

    // Helper to get role badge (C, L1, L2)
    const getPlayerBadge = (player) => {
        const isCap = player.isCaptain || player.is_captain || player.role === 'C' || player.role?.includes('C');
        const isL1 = player.role === 'L1' || player.role?.includes('L1') || player.isLibero1 || (player.isLibero && !player.role?.includes('L2'));
        const isL2 = player.role === 'L2' || player.role?.includes('L2') || player.isLibero2;
        
        const badges = [];
        if (isCap) {
            badges.push(<span key="cap" className="bg-[#2563eb] text-white text-[10px] font-black px-1.5 py-0.5 rounded-sm select-none">C</span>);
        }
        if (isL1) {
            badges.push(<span key="l1" className="bg-[#f97316] text-white text-[10px] font-black px-1 py-0.5 rounded-sm select-none">L1</span>);
        } else if (isL2) {
            badges.push(<span key="l2" className="bg-[#f97316] text-white text-[10px] font-black px-1 py-0.5 rounded-sm select-none">L2</span>);
        } else if (player.isLibero) {
            badges.push(<span key="lib" className="bg-[#f97316] text-white text-[10px] font-black px-1 py-0.5 rounded-sm select-none">L</span>);
        }
        
        if (badges.length === 0) return null;
        return <div className="flex gap-1">{badges}</div>;
    };

    // Helper to extract 3-letter code from team name
    const getTeamCode = (teamName) => {
        if (!teamName) return '';
        if (teamName.includes('-')) {
            return teamName.split('-')[0].trim().toUpperCase();
        }
        return teamName.substring(0, 3).toUpperCase();
    };

    const homeColor = teamColors.home || '#1e3a8a';
    const awayColor = teamColors.away || '#eab308';
    
    const homeCode = getTeamCode(teamHome);
    const awayCode = getTeamCode(teamAway);

    const safeHomeRoster = homeRoster || [];
    const safeAwayRoster = awayRoster || [];

    const selectShirtColor = (side, color) => {
        onColorChange(side, color);
        setActiveColorPicker(null);
    };

    const renderShirtColorPicker = (side, currentColor) => (
        <div className="relative flex-1">
            <button
                type="button"
                onClick={() => setActiveColorPicker((active) => active === side ? null : side)}
                className="w-full py-2 border border-slate-200 rounded text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                aria-expanded={activeColorPicker === side}
            >
                <span className="w-4 h-4 rounded-full border border-slate-300 shadow-inner" style={{ backgroundColor: currentColor }} />
                Shirt color
            </button>
            {activeColorPicker === side && (
                <div className={`absolute bottom-full z-30 mb-2 w-full min-w-[184px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl ${side === 'away' ? 'right-0' : 'left-0'}`}>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Select shirt color</div>
                    <div className="grid grid-cols-7 gap-2">
                        {SHIRT_COLOR_OPTIONS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => selectShirtColor(side, color)}
                                className={`h-6 w-6 rounded-full border-2 shadow-inner transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400 ${currentColor.toLowerCase() === color ? 'border-slate-900 ring-2 ring-slate-200' : 'border-white'}`}
                                style={{ backgroundColor: color }}
                                aria-label={`Select ${color} shirt color`}
                            />
                        ))}
                        <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-slate-200 bg-[conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)] shadow-inner" title="Custom color">
                            <input
                                type="color"
                                value={currentColor}
                                onChange={(e) => selectShirtColor(side, e.target.value)}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label="Choose custom shirt color"
                            />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all font-sans select-none">
            <div className="bg-white w-full max-w-[1100px] rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Starting lineup</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Three Columns Container */}
                <div className="flex-1 flex overflow-hidden min-h-0 bg-white">
                    
                    {/* Column 1: Home Team (Left) */}
                    <div className="w-[32%] flex flex-col p-6 min-h-0 border-r border-slate-100">
                        <h3 className="flex min-w-0 items-center justify-center gap-2 pb-2 text-center text-sm font-bold uppercase tracking-wider text-slate-700">
                            {homeLogoUrl && <img src={homeLogoUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-contain" />}
                            <span className="truncate" title={teamHome}>{teamHome}</span>
                        </h3>
                        <div className="border-b border-slate-100 w-full mb-3" />
                        
                        {/* Scrollable list */}
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {safeHomeRoster.length > 0 ? (
                                safeHomeRoster.map((player, index) => (
                                    <div 
                                        key={player.id} 
                                        className={`flex justify-between items-center py-2 px-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 rounded transition-colors ${
                                            index % 2 === 0 ? 'bg-slate-50/40' : 'bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-slate-900 w-5 text-left">{player.number}</span>
                                            <span className="text-sm text-slate-700">{formatPlayerName(player)}</span>
                                        </div>
                                        <div>
                                            {getPlayerBadge(player)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400 text-xs italic">No roster data</div>
                            )}
                        </div>
                        
                        {/* Column footer buttons */}
                        <div className="shrink-0 pt-4">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => onSetRoster('home')} 
                                    className={`flex-1 py-2 text-xs font-bold ${getContrastClass(homeColor)} rounded transition-colors shadow-sm hover:opacity-90 cursor-pointer`}
                                    style={{ backgroundColor: homeColor }}
                                >
                                    Set roster
                                </button>
                                {renderShirtColorPicker('home', homeColor)}
                            </div>
                            
                            <div className="text-[11px] font-bold text-slate-500 mt-4 mb-2 uppercase tracking-wide">Approvals - Roster</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleButtonClick('homeCaptain')}
                                    className={`flex-1 py-2.5 text-xs font-bold rounded transition-all text-center cursor-pointer ${
                                        signatures.homeCaptain 
                                        ? `${getContrastClass(homeColor)} border border-transparent shadow-sm` 
                                        : 'bg-white border text-slate-600 hover:bg-slate-50'
                                    }`}
                                    style={signatures.homeCaptain ? { backgroundColor: homeColor } : { borderColor: homeColor, color: homeColor }}
                                >
                                    Captain {homeCode}
                                </button>
                                <button
                                    onClick={() => handleButtonClick('homeCoach')}
                                    className={`flex-1 py-2.5 text-xs font-bold rounded transition-all text-center cursor-pointer ${
                                        signatures.homeCoach 
                                        ? `${getContrastClass(homeColor)} border border-transparent shadow-sm` 
                                        : 'bg-white border text-slate-600 hover:bg-slate-50'
                                    }`}
                                    style={signatures.homeCoach ? { backgroundColor: homeColor } : { borderColor: homeColor, color: homeColor }}
                                >
                                    Coach {homeCode}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Column 2: Court Diagrams (Middle) */}
                    <div className="w-[36%] flex flex-col p-6 bg-white border-r border-slate-100 overflow-y-auto justify-center gap-8">
                        {/* Home Court */}
                        <div className="w-[230px] flex flex-col self-start shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-lg overflow-hidden border border-slate-100">
                            <div className="flex min-w-0 items-center justify-center gap-2 border-b-[3px] bg-slate-100/90 px-4 py-2 text-center text-xs font-bold uppercase text-slate-700" style={{ borderBottomColor: homeColor }}>
                                {homeLogoUrl && <img src={homeLogoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />}
                                <span className="truncate" title={teamHome}>{teamHome}</span>
                            </div>
                            {/* Blue court margin background */}
                            <div className="bg-[#1b4fc6] p-2.5 pb-4 pt-0 relative aspect-[4/3] flex flex-col justify-between">
                                {/* Orange Court Area with white border lines */}
                                <div className="flex-1 bg-[#f2a167] border-[1.5px] border-white relative p-2.5 flex flex-col justify-between">
                                    {/* Attack Line */}
                                    <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-white -translate-y-1/2" />
                                    
                                    {/* Front Row (P4, P3, P2) */}
                                    <div className="grid grid-cols-3 gap-2.5 relative z-10">
                                        {[3, 2, 1].map((posIndex) => {
                                            const player = homeLineup[posIndex];
                                            return (
                                                <button 
                                                    key={posIndex}
                                                    onClick={() => onSlotClick('home', posIndex)}
                                                    className="aspect-square bg-white rounded-md border border-slate-200 flex items-center justify-center text-base font-bold text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                                                >
                                                    {player ? player.number : <span className="text-slate-300 text-sm font-normal">+</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Back Row (P5, P6, P1) */}
                                    <div className="grid grid-cols-3 gap-2.5 relative z-10">
                                        {[4, 5, 0].map((posIndex) => {
                                            const player = homeLineup[posIndex];
                                            return (
                                                <button 
                                                    key={posIndex}
                                                    onClick={() => onSlotClick('home', posIndex)}
                                                    className="aspect-square bg-white rounded-md border border-slate-200 flex items-center justify-center text-base font-bold text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                                                >
                                                    {player ? player.number : <span className="text-slate-300 text-sm font-normal">+</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => onClearTeamLineup('home')}
                                className="py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors border-t border-slate-100 cursor-pointer text-center"
                            >
                                Clear Lineup
                            </button>
                        </div>
                        
                        {/* Away Court */}
                        <div className="w-[230px] flex flex-col self-end shadow-[0_8px_30px_rgb(0,0,0,0.06)] rounded-lg overflow-hidden border border-slate-100">
                            <div className="flex min-w-0 items-center justify-center gap-2 border-b-[3px] bg-slate-100/90 px-4 py-2 text-center text-xs font-bold uppercase text-slate-700" style={{ borderBottomColor: awayColor }}>
                                {awayLogoUrl && <img src={awayLogoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />}
                                <span className="truncate" title={teamAway}>{teamAway}</span>
                            </div>
                            {/* Blue court margin background */}
                            <div className="bg-[#1b4fc6] p-2.5 pb-4 pt-0 relative aspect-[4/3] flex flex-col justify-between">
                                {/* Orange Court Area with white border lines */}
                                <div className="flex-1 bg-[#f2a167] border-[1.5px] border-white relative p-2.5 flex flex-col justify-between">
                                    {/* Attack Line */}
                                    <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-white -translate-y-1/2" />
                                    
                                    {/* Front Row (P4, P3, P2) */}
                                    <div className="grid grid-cols-3 gap-2.5 relative z-10">
                                        {[3, 2, 1].map((posIndex) => {
                                            const player = awayLineup[posIndex];
                                            return (
                                                <button 
                                                    key={posIndex}
                                                    onClick={() => onSlotClick('away', posIndex)}
                                                    className="aspect-square bg-white rounded-md border border-slate-200 flex items-center justify-center text-base font-bold text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                                                >
                                                    {player ? player.number : <span className="text-slate-300 text-sm font-normal">+</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Back Row (P5, P6, P1) */}
                                    <div className="grid grid-cols-3 gap-2.5 relative z-10">
                                        {[4, 5, 0].map((posIndex) => {
                                            const player = awayLineup[posIndex];
                                            return (
                                                <button 
                                                    key={posIndex}
                                                    onClick={() => onSlotClick('away', posIndex)}
                                                    className="aspect-square bg-white rounded-md border border-slate-200 flex items-center justify-center text-base font-bold text-slate-800 transition-all hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                                                >
                                                    {player ? player.number : <span className="text-slate-300 text-sm font-normal">+</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => onClearTeamLineup('away')}
                                className="py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors border-t border-slate-100 cursor-pointer text-center"
                            >
                                Clear Lineup
                            </button>
                        </div>
                    </div>
                    
                    {/* Column 3: Away Team (Right) */}
                    <div className="w-[32%] flex flex-col p-6 min-h-0">
                        <h3 className="flex min-w-0 items-center justify-center gap-2 pb-2 text-center text-sm font-bold uppercase tracking-wider text-slate-700">
                            {awayLogoUrl && <img src={awayLogoUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-contain" />}
                            <span className="truncate" title={teamAway}>{teamAway}</span>
                        </h3>
                        <div className="border-b border-slate-100 w-full mb-3" />
                        
                        {/* Scrollable list */}
                        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {safeAwayRoster.length > 0 ? (
                                safeAwayRoster.map((player, index) => (
                                    <div 
                                        key={player.id} 
                                        className={`flex justify-between items-center py-2 px-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 rounded transition-colors ${
                                            index % 2 === 0 ? 'bg-slate-50/40' : 'bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-slate-900 w-5 text-left">{player.number}</span>
                                            <span className="text-sm text-slate-700">{formatPlayerName(player)}</span>
                                        </div>
                                        <div>
                                            {getPlayerBadge(player)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400 text-xs italic">No roster data</div>
                            )}
                        </div>
                        
                        {/* Column footer buttons */}
                        <div className="shrink-0 pt-4">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => onSetRoster('away')} 
                                    className={`flex-1 py-2 text-xs font-bold ${getContrastClass(awayColor)} rounded transition-colors shadow-sm hover:opacity-90 cursor-pointer`}
                                    style={{ backgroundColor: awayColor }}
                                >
                                    Set roster
                                </button>
                                {renderShirtColorPicker('away', awayColor)}
                            </div>
                            
                            <div className="text-[11px] font-bold text-slate-500 mt-4 mb-2 uppercase tracking-wide">Approvals - Roster</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleButtonClick('awayCaptain')}
                                    className={`flex-1 py-2.5 text-xs font-bold rounded transition-all text-center cursor-pointer ${
                                        signatures.awayCaptain 
                                        ? `${getContrastClass(awayColor)} border border-transparent shadow-sm` 
                                        : 'bg-white border text-slate-600 hover:bg-slate-50'
                                    }`}
                                    style={signatures.awayCaptain ? { backgroundColor: awayColor } : { borderColor: awayColor, color: awayColor }}
                                >
                                    Captain {awayCode}
                                </button>
                                <button
                                    onClick={() => handleButtonClick('awayCoach')}
                                    className={`flex-1 py-2.5 text-xs font-bold rounded transition-all text-center cursor-pointer ${
                                        signatures.awayCoach 
                                        ? `${getContrastClass(awayColor)} border border-transparent shadow-sm` 
                                        : 'bg-white border text-slate-600 hover:bg-slate-50'
                                    }`}
                                    style={signatures.awayCoach ? { backgroundColor: awayColor } : { borderColor: awayColor, color: awayColor }}
                                >
                                    Coach {awayCode}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Modal Footer (Action Buttons) */}
                <div className="p-4 border-t border-slate-100 bg-white flex justify-center gap-3 shrink-0">
                    <button 
                        onClick={onClose} 
                        className="px-8 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-md text-sm transition-colors shadow-sm cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="px-8 py-2 bg-[#3b82f6] hover:bg-blue-600 text-white font-bold rounded-md text-sm transition-colors shadow-sm cursor-pointer"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* 📝 LARGE SIGNATURE OVERLAY DIALOG 📝 */}
            {activeField && (
                <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-6 rounded-[2rem] max-w-xl w-full flex flex-col gap-6 shadow-2xl border border-slate-100 animate-in zoom-in duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <PenTool className="text-indigo-600" size={22} />
                                Signature — {getFieldTitle(activeField)}
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveField(null);
                                    tempSignatureRef.current = null;
                                }}
                                className="text-slate-400 hover:text-slate-600 transition-colors active:scale-90"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Large Responsive Drawing Pad */}
                        <div className="w-full flex justify-center">
                            <SignaturePad
                                width={500}
                                height={220}
                                onSave={(data) => {
                                    tempSignatureRef.current = data;
                                }}
                                defaultValue={signatures[activeField]}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveField(null);
                                    tempSignatureRef.current = null;
                                }}
                                className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl uppercase tracking-wider text-sm transition-all active:scale-95 cursor-pointer text-center"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (onSignaturesChange) {
                                        onSignaturesChange(prev => ({ ...prev, [activeField]: tempSignatureRef.current }));
                                    }
                                    setActiveField(null);
                                    tempSignatureRef.current = null;
                                }}
                                className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl uppercase tracking-wider text-sm transition-all shadow-md shadow-indigo-200 active:scale-95 cursor-pointer text-center"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LineupModal;
