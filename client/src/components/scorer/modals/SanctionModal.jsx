import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, UserRound, Users, X } from 'lucide-react';

const RECEIVERS = [
    { value: 'TEAM', label: 'Team', hint: 'Delays, improper requests' },
    { value: 'PLAYER', label: 'Player', hint: 'Athlete misconduct' },
    { value: 'STAFF', label: 'Staff', hint: 'Coaches and team officials' }
];

const PLAYER_SANCTIONS = [
    { value: 'YELLOW', label: 'Yellow card', hint: 'Warning', color: 'bg-amber-400' },
    { value: 'RED', label: 'Red card', hint: 'Penalty point', color: 'bg-rose-500' },
    { value: 'EXPULSION', label: 'Expulsion', hint: 'Red + yellow together', color: 'bg-orange-500' },
    { value: 'DISQUALIFICATION', label: 'Disqualification', hint: 'Red + yellow separately', color: 'bg-red-700' }
];

const TEAM_SANCTIONS = [
    { value: 'DELAY_WARNING', label: 'Delay warning', hint: 'Team delay warning', color: 'bg-amber-400' },
    { value: 'DELAY_PENALTY', label: 'Delay penalty', hint: 'Penalty point', color: 'bg-rose-500' },
    { value: 'IMPROPER_REQUEST', label: 'Improper request', hint: 'IR recorded', color: 'bg-sky-500' }
];

const DEFAULT_STAFF = [
    { id: 'coach', role: 'Coach', name: 'Coach' },
    { id: 'assistant_coach_1', role: 'Assistant Coach', name: 'Assistant Coach' },
    { id: 'team_manager', role: 'Team Manager', name: 'Team Manager' },
    { id: 'medical_doctor', role: 'Medical Doctor', name: 'Medical Doctor' }
];

const getPersonName = (person = {}) => (
    person.name
    || [person.first_name, person.last_name].filter(Boolean).join(' ')
    || [person.firstname, person.lastname].filter(Boolean).join(' ')
    || person.full_name
    || ''
);

const getPlayerNumber = (player = {}) => (
    player.number || player.entry_number || player.shirt_number || player.jersey_number || ''
);

const SanctionModal = ({
    isOpen,
    onClose,
    initialTeam = 'home',
    teams,
    teamName,
    roster = [],
    onConfirm
}) => {
    const normalizedTeams = useMemo(() => teams || {
        home: { name: teamName || 'Home', roster, staff: [] },
        away: { name: 'Away', roster: [], staff: [] }
    }, [teams, teamName, roster]);

    const [receiver, setReceiver] = useState('PLAYER');
    const [teamCode, setTeamCode] = useState(initialTeam || 'home');
    const [selectedPersonId, setSelectedPersonId] = useState('');
    const [sanctionType, setSanctionType] = useState('YELLOW');

    const activeTeam = normalizedTeams[teamCode] || normalizedTeams.home || { roster: [], staff: [] };
    const activeRoster = activeTeam.roster || [];
    const activeStaff = (activeTeam.staff && activeTeam.staff.length > 0) ? activeTeam.staff : DEFAULT_STAFF;
    const sanctionOptions = receiver === 'TEAM' ? TEAM_SANCTIONS : PLAYER_SANCTIONS;
    const needsPerson = receiver === 'PLAYER' || receiver === 'STAFF';

    useEffect(() => {
        if (!isOpen) return;
        setReceiver('PLAYER');
        setTeamCode(initialTeam || 'home');
        setSelectedPersonId('');
        setSanctionType('YELLOW');
    }, [isOpen, initialTeam]);

    useEffect(() => {
        setSelectedPersonId('');
        setSanctionType(receiver === 'TEAM' ? 'DELAY_WARNING' : 'YELLOW');
    }, [receiver, teamCode]);

    if (!isOpen) return null;

    const selectedPlayer = activeRoster.find(p => String(p.id) === String(selectedPersonId));
    const selectedStaff = activeStaff.find((s, index) => String(s.id || s.staff_id || index) === String(selectedPersonId));
    const canSubmit = !needsPerson || !!selectedPersonId;

    const handleConfirmClick = () => {
        if (!canSubmit) return;
        const selectedOption = sanctionOptions.find(option => option.value === sanctionType);

        onConfirm({
            receiver,
            teamCode,
            sanctionType,
            player: receiver === 'PLAYER' ? selectedPlayer : null,
            staff: receiver === 'STAFF'
                ? {
                    ...(selectedStaff || {}),
                    label: selectedStaff ? `${selectedStaff.role || 'Staff'} - ${getPersonName(selectedStaff) || selectedStaff.name || ''}` : ''
                }
                : null,
            details: {
                card: sanctionType,
                sanctionLabel: selectedOption?.label || sanctionType,
                receiver
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in transition-all">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="bg-slate-50/70 p-6 border-b border-slate-100 flex justify-between items-start gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 tracking-tight">
                            <div className="bg-rose-500 p-2 rounded-xl text-white shadow-lg shadow-rose-100">
                                <ShieldAlert size={21} />
                            </div>
                            Issue Sanction
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold mt-2">
                            Select receiver, team, sanction type, then submit.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 bg-white">
                    <section className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Receiver of sanction</label>
                        <div className="grid grid-cols-3 gap-3">
                            {RECEIVERS.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setReceiver(option.value)}
                                    className={`rounded-2xl border p-4 text-left transition-all ${receiver === option.value ? 'border-rose-300 bg-rose-50 text-rose-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}
                                >
                                    <div className="flex items-center gap-2 font-bold text-sm">
                                        {option.value === 'TEAM' ? <Users size={16} /> : option.value === 'PLAYER' ? <UserRound size={16} /> : <AlertTriangle size={16} />}
                                        {option.label}
                                    </div>
                                    <div className="mt-1 text-[10px] font-semibold text-slate-400">{option.hint}</div>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Team</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['home', 'away'].map(code => (
                                <button
                                    key={code}
                                    type="button"
                                    onClick={() => setTeamCode(code)}
                                    className={`rounded-2xl border px-4 py-3 text-left font-bold transition-all ${teamCode === code ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}
                                >
                                    <span className="block text-[10px] uppercase tracking-widest text-slate-400">{code}</span>
                                    <span className="block truncate text-sm">{normalizedTeams[code]?.name || code}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {needsPerson && (
                        <section className="space-y-2">
                            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {receiver === 'PLAYER' ? 'Penalized player' : 'Penalized staff'}
                            </label>
                            <select
                                value={selectedPersonId}
                                onChange={(e) => setSelectedPersonId(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                            >
                                <option value="">Select {receiver === 'PLAYER' ? 'player' : 'staff'}</option>
                                {receiver === 'PLAYER' ? (
                                    activeRoster.map(player => (
                                        <option key={player.id} value={player.id}>
                                            #{getPlayerNumber(player) || '-'} - {getPersonName(player) || player.name || 'Player'}
                                        </option>
                                    ))
                                ) : (
                                    activeStaff.map((staff, index) => {
                                        const id = staff.id || staff.staff_id || index;
                                        const name = getPersonName(staff) || staff.name || staff.role || 'Staff';
                                        return (
                                            <option key={id} value={id}>
                                                {staff.role || 'Staff'} - {name}
                                            </option>
                                        );
                                    })
                                )}
                            </select>
                        </section>
                    )}

                    <section className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Sanction type</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {sanctionOptions.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setSanctionType(option.value)}
                                    className={`rounded-2xl border p-4 text-left transition-all ${sanctionType === option.value ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`h-8 w-5 rounded ${option.color}`} />
                                        <div>
                                            <div className="font-bold text-sm">{option.label}</div>
                                            <div className={`text-[10px] font-semibold ${sanctionType === option.value ? 'text-slate-300' : 'text-slate-400'}`}>{option.hint}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="p-6 bg-slate-50/70 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-all">
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirmClick}
                        disabled={!canSubmit}
                        className="px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest bg-slate-900 hover:bg-black text-white disabled:opacity-25 disabled:grayscale transition-all shadow-xl active:scale-95 flex items-center gap-3"
                    >
                        Submit Sanction <CheckCircle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SanctionModal;
