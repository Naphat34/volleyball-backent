import { GuardedButton } from '../../ui/GuardedAction';
import useScorerTranslation from '../useScorerTranslation';
import React, { useEffect, useState } from 'react';
import { X, Clock, Play, Pause, RotateCcw } from 'lucide-react';

const TimeoutTimerModal = ({ isOpen, onClose, duration = 30, title = 'Timeout', startTime = null }) => {
    const st = useScorerTranslation();
    const [timeLeft, setTimeLeft] = useState(duration);
    const [isRunning, setIsRunning] = useState(true);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            setIsRunning(true);
            
            // If startTime is provided by the server, calculate remaining time
            if (startTime) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const remaining = Math.max(0, duration - elapsed);
                setTimeLeft(remaining);
            } else {
                setTimeLeft(duration);
            }
        } else {
            setVisible(false);
            setIsRunning(false);
        }
    }, [isOpen, duration, startTime]);

    useEffect(() => {
        let interval = null;
        if (isOpen && isRunning && timeLeft > 0) {
            interval = setInterval(() => {
                // If we have a startTime, recalculate strictly to avoid drift
                if (startTime) {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const remaining = Math.max(0, duration - elapsed);
                    setTimeLeft(remaining);
                    if (remaining <= 0) setIsRunning(false);
                } else {
                    setTimeLeft((prev) => prev - 1);
                }
            }, 1000);
        } else if (timeLeft <= 0) {
            setIsRunning(false);
        }
        return () => clearInterval(interval);
    }, [isOpen, isRunning, timeLeft, startTime, duration]);

    // Keep component mounted during exit animation
    if (!isOpen && !visible) return null;

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    };

    const displayTime = duration >= 60 ? formatTime(timeLeft) : timeLeft;
    const durationText = duration >= 60 ? `${duration / 60} Minute${duration / 60 > 1 ? 's' : ''} Duration` : `${duration} Seconds Duration`;

    return (
        <div className={`fixed inset-0 z-[100] flex items-end justify-center pointer-events-none transition-all duration-300 ${isOpen ? 'visible' : 'invisible delay-300'}`}>
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose} 
            />
            
            {/* Bottom Sheet */}
            <div 
                className={`bg-white dark:bg-slate-800 w-full max-w-md mx-auto rounded-t-3xl p-6 shadow-2xl pointer-events-auto transform transition-transform duration-300 ease-out border-t border-gray-200 dark:border-slate-700 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-full">
                            <Clock className="text-yellow-600 dark:text-yellow-400" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-wider">{st(title)}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">{durationText}</p>
                        </div>
                    </div>
                    <GuardedButton aria-label={st('Close')}
                        onClick={onClose}
                        className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-500 dark:text-gray-300 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </GuardedButton>
                </div>

                {/* Timer Display */}
                <div className="flex flex-col items-center justify-center py-4">
                    <div className={`font-black font-mono tabular-nums tracking-tighter leading-none mb-2 ${
                        duration >= 60 ? 'text-8xl' : 'text-9xl'
                    } ${
                        timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-white'
                    }`}>
                        {displayTime}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-4 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-8">
                        <div 
                            className={`h-full transition-all duration-1000 ease-linear ${
                                timeLeft <= 5 ? 'bg-red-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${(timeLeft / duration) * 100}%` }}
                        />
                    </div>

                    {/* Controls */}
                    <div className="grid grid-cols-3 gap-3 w-full">
                        <GuardedButton
                            onClick={() => setIsRunning(!isRunning)}
                            className={`col-span-2 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                isRunning 
                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white' 
                                    : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
                            }`}
                        >
                            {isRunning ? <><Pause size={24}/>{' '}{st("PAUSE")}</> : <><Play size={24}/>{' '}{st("RESUME")}</>}
                        </GuardedButton>
                        <GuardedButton
                            onClick={() => { setTimeLeft(duration); setIsRunning(true); }}
                            className="col-span-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-300 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
                        >
                            <RotateCcw size={24} />
                        </GuardedButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeoutTimerModal;