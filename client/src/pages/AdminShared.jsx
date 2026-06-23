import Swal from 'sweetalert2';
import React from 'react';
import { Users } from 'lucide-react';

// --- Toast Config ---
export const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
});

// --- UI Components ---
export function ActionButton({ onClick, color, icon, label }) {
    const styles = {
        green: 'bg-green-50 hover:bg-green-100 text-green-600 border border-green-200',
        red: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
    };
    return <button onClick={onClick} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition ${styles[color]}`}>{icon} {label}</button>;
}

export function Input({ label, type = "text", value, onChange, required, placeholder }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase mb-1 text-gray-500">{label}</label>
            <input type={type} required={required} value={value} onChange={onChange} placeholder={placeholder}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition bg-white border-gray-300 text-gray-900"
            />
        </div>
    );
}

export function Button({ type, label, icon, full }) {
    return (
        <button type={type} className={`bg-blue-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center gap-2 ${full ? 'w-full' : ''}`}>
            {icon} {label}
        </button>
    );
}

export function EmptyState({ text }) {
    return (
        <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-gray-100">
                <Users className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">{text}</p>
        </div>
    );
}

export function DetailItem({ label, value, full }) {
    return (
        <div className={`p-3 rounded-lg border ${full ? 'col-span-2' : ''} bg-gray-50 border-gray-100`}>
            <span className="block text-xs font-bold uppercase mb-1 text-gray-500">{label}</span>
            <span className="font-bold text-lg">{value}</span>
        </div>
    );
}