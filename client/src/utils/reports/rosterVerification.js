const identityFields = ['first_name_th', 'last_name_th', 'first_name_en', 'last_name_en', 'nationality', 'country', 'birth_date', 'birthdate', 'date_of_birth', 'dob'];
export function rosterVerificationModel(data) {
    if (!data?.match || !['home', 'away'].every(side => Array.isArray(data[side]?.players) && Array.isArray(data[side]?.staff))) {
        throw new Error('The match roster could not be loaded. Please reload this page.');
    }
    const result = { match: data.match };
    for (const side of ['home', 'away']) {
        const registered = new Map((data[side].availablePlayers || []).map(player => [String(player.id), player]));
        const players = data[side].players.map(player => {
            const merged = { ...player }, original = registered.get(String(player.id));
            // Keep the selected roster, shirt number and roles from the match snapshot.
            for (const field of identityFields) if (merged[field] == null || merged[field] === '') merged[field] = original?.[field] ?? merged[field];
            return merged;
        }).sort((a, b) => Number(a.number ?? a.shirt_number ?? a.jersey_number ?? Infinity) - Number(b.number ?? b.shirt_number ?? b.jersey_number ?? Infinity));
        result[side] = { players, staff: data[side].staff };
    }
    return result;
}

export function rosterBirthDate(player) {
    const raw = player?.birth_date || player?.birthdate || player?.date_of_birth || player?.dob;
    if (!raw) return '';
    const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/);
    if (!match) return '';
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return '';
    return `${day}/${month}/${year}`;
}

const flag = value => value === true || value === 1 || value === '1';
export function rosterRole(player) {
    const role = String(player?.role || '').toUpperCase();
    const tags = [];
    if (flag(player?.is_captain) || flag(player?.isCaptain) || ['C', 'L1+C', 'L2+C'].includes(role)) tags.push('C');
    if (flag(player?.is_libero2) || role.startsWith('L2')) tags.push('L2');
    else if (flag(player?.is_libero1) || role.startsWith('L1')) tags.push('L1');
    else if (flag(player?.is_libero) || flag(player?.isLibero) || ['L', 'LIBERO'].includes(role) || player?.position === 'L') tags.push('L');
    return tags.join(', ');
}
