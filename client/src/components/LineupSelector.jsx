import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle } from 'lucide-react';

const LineupSelector = ({ teamName, players, onConfirm }) => {
    const [selectedStarters, setSelectedStarters] = useState([]);
    const [selectedLibero, setSelectedLibero] = useState(null);

    // Auto-select Libero based on position 'L'
    useEffect(() => {
        const liberos = players.filter(p => p.position === 'L');
        if (liberos.length > 0 && !selectedLibero) {
            const timer = setTimeout(() => {
                setSelectedLibero(liberos[0]);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [players, selectedLibero]);

    const toggleStarter = (player) => {
        // Deselect Libero if selected as starter
        if (selectedLibero?.id === player.id) {
            setSelectedLibero(null);
        }
        
        if (selectedStarters.find(p => p.id === player.id)) {
            setSelectedStarters(selectedStarters.filter(p => p.id !== player.id));
        } else if (selectedStarters.length < 6) {
            setSelectedStarters([...selectedStarters, player]);
        }
    };

    const selectLibero = (player) => {
        if (selectedStarters.find(p => p.id === player.id)) return;
        setSelectedLibero(selectedLibero?.id === player.id ? null : player);
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-6 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 hidden sm:block">
                    <Shield className="text-blue-600" size={20} />
                </div>
                {teamName}
            </h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {players.map(player => {
                    const isStarter = selectedStarters.find(s => s.id === player.id);
                    const isLibero = selectedLibero?.id === player.id;
                    const isLiberoPos = player.position === 'L';
                    
                    let containerClass = 'p-4 rounded-xl border-2 transition-all duration-200';
                    
                    if (isStarter) {
                        containerClass += ' bg-blue-50 border-blue-600 shadow-sm';
                    } else if (isLibero) {
                        containerClass += ' bg-yellow-50 border-yellow-500 shadow-sm';
                    } else {
                        containerClass += ' bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm';
                    }
                    
                    if (isLiberoPos && !isLibero) {
                        containerClass += ' ring-2 ring-yellow-400/30';
                    }

                    return (
                        <div key={player.id} className={containerClass}>
                            <div className="flex justify-between items-start mb-4">
                                <span className={`text-2xl font-bold font-mono ${isStarter ? 'text-blue-700' : isLibero ? 'text-yellow-700' : 'text-gray-900'}`}>#{player.number}</span>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]" title={player.name}>
                                        {player.name}
                                    </span>
                                    {isLiberoPos && (
                                        <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full font-bold">
                                            LIBERO
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => toggleStarter(player)} 
                                    disabled={isLibero}
                                    className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all border ${
                                        isStarter 
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isStarter ? '✓ Starter' : 'Starter'}
                                </button>
                                <button 
                                    onClick={() => selectLibero(player)} 
                                    disabled={isStarter}
                                    className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all border ${
                                        isLibero 
                                            ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm' 
                                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {isLibero ? '✓ Libero' : 'Libero'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 rounded-xl p-4 border border-gray-200 gap-4">
                <div className="flex flex-wrap items-center gap-6 text-sm">
                    <span className="text-gray-600 font-medium">
                        Starters: <span className={`font-bold ml-1 px-2 py-1 rounded-md ${
                            selectedStarters.length === 6 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {selectedStarters.length} / 6
                        </span>
                    </span>
                    <span className="text-gray-600 font-medium">
                        Libero: <span className="font-bold ml-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded-md">
                            {selectedLibero ? `#${selectedLibero.number}` : 'None'}
                        </span>
                    </span>
                </div>
                
                <button 
                    onClick={() => onConfirm(selectedStarters, selectedLibero)} 
                    disabled={selectedStarters.length !== 6}
                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg 
                             disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none
                             disabled:cursor-not-allowed shadow-sm 
                             transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <CheckCircle size={18} />
                    Confirm {teamName}
                </button>
            </div>
        </div>
    );
};

export default LineupSelector;