export const lineupCourtOrder = [3, 2, 1, 4, 5, 0];

export function initialLineup(team) {
    return Array.from({ length: 6 }, (_, index) => {
        const id = Number(team.lineup?.[index]?.id ?? team.lineup?.[index]);
        return Number.isSafeInteger(id) && id > 0 && team.players.some(player => Number(player.id) === id) ? id : '';
    });
}

export function validLineup(slots, players) {
    return slots?.length === 6 && new Set(slots).size === 6
        && slots.every(id => Number.isSafeInteger(id) && id > 0 && players.some(player => Number(player.id) === id));
}

export function assignLineupPlayer(slots, position, playerId) {
    const next = [...slots], previous = next.indexOf(playerId);
    if (previous === position) next[position] = '';
    else {
        if (previous >= 0) next[previous] = next[position];
        next[position] = playerId;
    }
    return next;
}

export function rotateLineup(slots, direction) {
    return direction === 1 ? [...slots.slice(1), slots[0]] : [slots[5], ...slots.slice(0, 5)];
}
