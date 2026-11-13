import { getPlayerId, isPlayerLibero, isPlayingPlayer } from './playerFilters.js';

export function resolveApprovedLineup(details, roster) {
    const rows = Array.isArray(details?.lineup) ? [...details.lineup] : [];
    rows.sort((a, b) => Number(a.position) - Number(b.position));
    const ids = rows.map(row => row.player_id ?? row.id);
    if (rows.length !== 6 || rows.some((row, index) => Number(row.position) !== index + 1)
        || ids.some(id => id == null) || new Set(ids.map(String)).size !== 6) {
        throw new Error('The submitted lineup must contain six different players in positions 1–6.');
    }
    return ids.map((id, originalPos) => {
        const player = roster.find(row => String(getPlayerId(row)) === String(id));
        if (!player || !isPlayingPlayer(player) || isPlayerLibero(player)) {
            throw new Error('A submitted player is unavailable in the match roster or is a Libero. Ask the team to review the lineup.');
        }
        return { ...player, originalPos };
    });
}

export const hasCompleteStartingLineup = lineup => Array.isArray(lineup) && lineup.length === 6
    && lineup.every(player => player && getPlayerId(player) != null)
    && new Set(lineup.map(player => String(getPlayerId(player)))).size === 6;
