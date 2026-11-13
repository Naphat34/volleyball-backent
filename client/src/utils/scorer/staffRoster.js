import { getPlayerId, getPlayerNumber } from './playerFilters.js';

export function hydrateStaffPlayer(player, roster = []) {
    const playerId = getPlayerId(player);
    if (playerId === null) return player;
    const raw = typeof player === 'object' ? player : { id: playerId };
    const registered = roster.find(row => String(getPlayerId(row)) === String(playerId));
    const readNumber = row => getPlayerNumber(row, {
        fields: ['number', 'entry_number', 'shirt_number', 'jersey_number'],
        fallback: '', preserveEmpty: true,
    });
    const number = [readNumber(registered), readNumber(raw)].find(value => value !== '' && value != null) ?? '';
    return {
        ...raw,
        ...registered,
        id: registered?.id ?? raw.id ?? raw.player_id ?? playerId,
        player_id: registered?.player_id ?? registered?.id ?? raw.player_id ?? raw.id ?? playerId,
        number,
    };
}
