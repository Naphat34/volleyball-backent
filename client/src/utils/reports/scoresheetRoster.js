export function scoresheetRoster({ maxPlayers = 14, playersA = [], playersB = [], liberosA = [], liberosB = [] }) {
    const capacity = Math.max(1, Math.trunc(Number(maxPlayers) || 14));
    const liberoA = liberosA.slice(0, Math.min(2, capacity));
    const liberoB = liberosB.slice(0, Math.min(2, capacity));
    const regularA = playersA.slice(0, capacity - liberoA.length);
    const regularB = playersB.slice(0, capacity - liberoB.length);
    return { capacity, playersA: regularA, playersB: regularB, liberosA: liberoA, liberosB: liberoB,
        regularRows: Math.max(1, regularA.length, regularB.length), liberoRows: Math.max(1, liberoA.length, liberoB.length) };
}
