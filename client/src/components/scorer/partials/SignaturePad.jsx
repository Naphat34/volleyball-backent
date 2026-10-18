import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

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


export default SignaturePad;
