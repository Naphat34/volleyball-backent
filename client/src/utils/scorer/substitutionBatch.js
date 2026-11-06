import { isPlayerLibero } from './playerFilters.js';
const id = p => String(p?.id || p?.player_id || '');

export function applySubstitutionBatch({ lineup, roster, tracker, pairs, disqualified = [], limit = 8, score = '' }) {
    if (!Array.isArray(pairs) || !pairs.length || pairs.length > 6) throw Error('Select between 1 and 6 pairs.');
    if ((tracker?.count || 0) + pairs.length > limit) throw Error('Substitution limit exceeded.');
    const next = lineup.map(p => p && { ...p });
    const updated = structuredClone(tracker || { count: 0, positions: {}, usedPlayers: [] });
    updated.positions ||= {}; updated.usedPlayers ||= [];
    const incoming = new Set(), outgoing = new Set();
    for (const pair of pairs) {
        const position = pair.posIndex, out = lineup[position];
        const player = roster.find(p => id(p) === id(pair.playerIn));
        if (!Number.isInteger(position) || !out || id(out) !== id(pair.playerOut) || outgoing.has(position)) throw Error('The on-court lineup has changed. Review the pairs.');
        if (!player || incoming.has(id(player)) || lineup.some(p => p && id(p) === id(player)) || disqualified.some(p => String(p) === id(player))) throw Error('A replacement is unavailable or selected twice.');
        if (isPlayerLibero(player) || isPlayerLibero(out)) throw Error('Use Libero replacement for Libero players.');
        const entry = Object.entries(updated.positions).find(([, data]) => String(data.currentOnCourt ?? data.subId) === id(out));
        const originalPos = entry ? Number(entry[0]) : out.originalPos ?? position;
        const prior = updated.positions[originalPos];
        if (prior?.returned) throw Error('This position has already used its return substitution.');
        if (prior && String(prior.starterId) !== id(player)) throw Error('Only the original starter can return to this position.');
        if (!prior && updated.usedPlayers.some(p => String(p) === id(player))) throw Error('This replacement has already played in another substitution.');
        const substitutionHistory = [...(prior?.substitutionHistory || [
            ...(prior?.subScore ? [{ outId: prior.starterId, inId: prior.subId, score: prior.subScore }] : []),
            ...(prior?.returnScore ? [{ outId: prior.subId, inId: prior.starterId, score: prior.returnScore }] : [])
        ]), { outId: out.id || out.player_id, inId: player.id || player.player_id, score }];
        updated.positions[originalPos] = prior ? { ...prior, currentOnCourt: player.id || player.player_id, returned: true, returnScore: score, substitutionHistory } : {
            starterId: out.id || out.player_id, starterNumber: out.number, subId: player.id || player.player_id, subNumber: player.number,
            currentOnCourt: player.id || player.player_id, returned: false, subScore: score, substitutionHistory
        };
        for (const value of [out.id || out.player_id, player.id || player.player_id]) if (!updated.usedPlayers.some(p => String(p) === String(value))) updated.usedPlayers.push(value);
        updated.count = (updated.count || 0) + 1;
        next[position] = { ...player, originalPos };
        incoming.add(id(player)); outgoing.add(position);
    }
    return { lineup: next, tracker: updated };
}
