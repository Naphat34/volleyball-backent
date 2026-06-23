import React, { useRef, useState, useEffect } from 'react';
import { PenTool, XCircle, RotateCcw, CheckCircle } from 'lucide-react';

const SignaturePad = ({ title, width = 500, height = 220, onSave }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#1e293b'; // slate-800
    }, []);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        // Scale factor: internal width/height divided by client rect display width/height
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
                    <div className="absolute inset-0 z-0 flex items-center justify-center font-bold text-slate-350 pointer-events-none select-none uppercase tracking-widest text-sm">
                        ลงลายมือชื่อที่นี่ (Sign Here)
                    </div>
                )}
                {hasDrawn && (
                    <button
                        type="button"
                        onClick={clearCanvas}
                        className="absolute top-3 right-3 z-20 bg-white/90 p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-md active:scale-95"
                        title="ล้างหน้าจอ"
                    >
                        <RotateCcw size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

const SignatureBox = ({ title, value, onClick }) => {
    return (
        <div className="flex flex-col gap-2 w-full">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</span>
            <button
                type="button"
                onClick={onClick}
                className="w-full h-[130px] rounded-3xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 shadow-sm flex flex-col items-center justify-center gap-2 transition-all group overflow-hidden relative"
            >
                {value ? (
                    <div className="w-full h-full p-3 flex items-center justify-center bg-white relative">
                        <img src={value} alt={title} className="max-w-full max-h-full object-contain" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5">
                            <PenTool size={14} /> แก้ไขลายเซ็น
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-500 flex items-center justify-center transition-all group-hover:scale-105">
                            <PenTool size={18} />
                        </div>
                        <span className="text-[11px] font-black text-slate-400 group-hover:text-indigo-500 transition-colors uppercase tracking-wider">
                            คลิกเพื่อลงชื่อ
                        </span>
                    </>
                )}
            </button>
        </div>
    );
};

export default function SignatureModal({ isOpen, teamHome, teamAway, onConfirm, isPostMatch, matchSignatures }) {
    const [signatures, setSignatures] = useState({
        homeCoach: null,
        homeCaptain: null,
        awayCoach: null,
        awayCaptain: null,
        referee2: null,
        referee1: null
    });

    const [activeField, setActiveField] = useState(null); // Field being signed: 'homeCoach', etc.
    const tempSignatureRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setSignatures({
                homeCoach: matchSignatures?.homeCoach || null,
                homeCaptain: matchSignatures?.homeCaptain || null,
                awayCoach: matchSignatures?.awayCoach || null,
                awayCaptain: matchSignatures?.awayCaptain || null,
                referee2: matchSignatures?.referee2 || null,
                referee1: matchSignatures?.referee1 || null
            });
            setActiveField(null);
            tempSignatureRef.current = null;
        }
    }, [isOpen, isPostMatch, matchSignatures]);

    if (!isOpen) return null;

    const allSigned = !!(
        signatures.homeCaptain &&
        signatures.awayCaptain &&
        signatures.referee2 &&
        signatures.referee1
    );

    const handleSaveSignatures = () => {
        onConfirm(signatures);
    };

    // Helper for overlay field titles
    const getFieldTitle = (field) => {
        switch (field) {
            case 'homeCoach': return `${teamHome} Coach`;
            case 'homeCaptain': return `${teamHome} Captain`;
            case 'awayCoach': return `${teamAway} Coach`;
            case 'awayCaptain': return `${teamAway} Captain`;
            case 'referee2': return '2nd Referee (ผู้ตัดสินที่ 2)';
            case 'referee1': return '1st Referee (ผู้ตัดสินที่ 1)';
            default: return '';
        }
    };

    return (
        <div className="fixed inset-0 z-[110] pointer-events-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all font-sans">
            <div className="bg-white p-8 rounded-[2.5rem] max-w-2xl w-full flex flex-col items-center justify-center space-y-8 shadow-2xl animate-in zoom-in duration-300">
                <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-semibold flex items-center justify-center gap-3 text-slate-800 tracking-tight">
                        <PenTool className="text-blue-600" size={28} /> 
                        {isPostMatch ? 'FINAL MATCH SIGNATURES (ลงนามท้ายแมตช์)' : 'OFFICIAL SIGNATURES (ลงนามก่อนแข่ง)'}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        {isPostMatch ? 'Captains and Referees sign to verify final scoresheet' : 'Sign before the match (Optional)'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                    {isPostMatch ? (
                        <>
                            {/* Captains Column */}
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-2 border-b-2 border-blue-100 pb-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                                    <span className="font-semibold text-slate-700 uppercase">Captains (กัปตันทีม)</span>
                                </div>
                                <div className="flex flex-col gap-4">
                                    <SignatureBox
                                        title={`${teamHome} Captain`}
                                        value={signatures.homeCaptain}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.homeCaptain;
                                            setActiveField('homeCaptain');
                                        }}
                                    />
                                    <SignatureBox
                                        title={`${teamAway} Captain`}
                                        value={signatures.awayCaptain}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.awayCaptain;
                                            setActiveField('awayCaptain');
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Referees Column */}
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-2 border-b-2 border-indigo-100 pb-2">
                                    <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
                                    <span className="font-semibold text-slate-700 uppercase">Referees (ผู้ตัดสิน)</span>
                                </div>
                                <div className="flex flex-col gap-4">
                                    <SignatureBox
                                        title="2nd Referee (ผู้ตัดสินที่ 2)"
                                        value={signatures.referee2}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.referee2;
                                            setActiveField('referee2');
                                        }}
                                    />
                                    <SignatureBox
                                        title="1st Referee (ผู้ตัดสินที่ 1)"
                                        value={signatures.referee1}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.referee1;
                                            setActiveField('referee1');
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Home Side */}
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-2 border-b-2 border-blue-100 pb-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                                    <span className="font-semibold text-slate-700 uppercase">{teamHome}</span>
                                </div>
                                <div className="flex flex-col gap-4">
                                    <SignatureBox
                                        title="Home Coach"
                                        value={signatures.homeCoach}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.homeCoach;
                                            setActiveField('homeCoach');
                                        }}
                                    />
                                    <SignatureBox
                                        title="Home Captain"
                                        value={signatures.homeCaptain}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.homeCaptain;
                                            setActiveField('homeCaptain');
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Away Side */}
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-2 border-b-2 border-rose-100 pb-2">
                                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                                    <span className="font-semibold text-slate-700 uppercase">{teamAway}</span>
                                </div>
                                <div className="flex flex-col gap-4">
                                    <SignatureBox
                                        title="Away Coach"
                                        value={signatures.awayCoach}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.awayCoach;
                                            setActiveField('awayCoach');
                                        }}
                                    />
                                    <SignatureBox
                                        title="Away Captain"
                                        value={signatures.awayCaptain}
                                        onClick={() => {
                                            tempSignatureRef.current = signatures.awayCaptain;
                                            setActiveField('awayCaptain');
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="pt-2 w-full max-w-md mx-auto">
                    {isPostMatch ? (
                        allSigned ? (
                            <button 
                                onClick={handleSaveSignatures} 
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold uppercase tracking-[0.2em] text-sm transition-all shadow-xl shadow-emerald-200 active:scale-95 flex justify-center items-center gap-2"
                            >
                                กลับหน้าหลัก <CheckCircle size={18} />
                            </button>
                        ) : (
                            <div className="w-full py-4 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl font-bold text-xs text-center px-4 animate-pulse">
                                ⚠️ กรุณาลงนามกัปตันทั้งสองทีม และผู้ตัดสินที่ 1-2 ให้ครบเพื่อเปิดปุ่มกลับหน้าหลัก
                            </div>
                        )
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => onConfirm(signatures)} 
                                className="w-full py-4 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg font-semibold uppercase tracking-[0.2em] text-sm transition-all active:scale-95 flex justify-center items-center gap-2"
                            >
                                <XCircle size={18} /> SKIP / NEXT
                            </button>
                            <button 
                                onClick={handleSaveSignatures} 
                                className="w-full py-4 bg-blue-600 hover:bg-indigo-700 text-white rounded-lg font-semibold uppercase tracking-[0.2em] text-sm transition-all shadow-xl shadow-indigo-200 active:scale-95 flex justify-center items-center gap-2"
                            >
                                SAVE & CONTINUE <CheckCircle size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 📝 LARGE SIGNATURE OVERLAY DIALOG 📝 */}
            {activeField && (
                <div className="fixed inset-0 z-[120] bg-slate-955/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-6 rounded-[2rem] max-w-xl w-full flex flex-col gap-6 shadow-2xl border border-slate-100 animate-in zoom-in duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <PenTool className="text-indigo-600" size={22} />
                                ลงลายมือชื่อ — {getFieldTitle(activeField)}
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveField(null);
                                    tempSignatureRef.current = null;
                                }}
                                className="text-slate-400 hover:text-slate-600 transition-colors active:scale-90"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        {/* Large Responsive Drawing Pad */}
                        <div className="w-full flex justify-center">
                            <SignaturePad
                                title={getFieldTitle(activeField)}
                                width={550}
                                height={240}
                                onSave={(data) => {
                                    tempSignatureRef.current = data;
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveField(null);
                                    tempSignatureRef.current = null;
                                }}
                                className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl uppercase tracking-wider text-sm transition-all active:scale-95"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSignatures(prev => ({ ...prev, [activeField]: tempSignatureRef.current }));
                                    setActiveField(null);
                                    tempSignatureRef.current = null;
                                }}
                                className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl uppercase tracking-wider text-sm transition-all shadow-md shadow-indigo-200 active:scale-95"
                            >
                                บันทึก (Save)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
