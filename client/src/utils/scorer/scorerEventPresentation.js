import { abbreviateHistoryTeams, historyTeamName } from './historyTeamNames.js';

// Build display copy from event metadata. Never rewrite stored event descriptions.
export function formatScorerEvent(event, match, t) {
    const metadata = event.metadata || {};
    const type = metadata.type || event.event_type || event.type;
    const side = metadata.teamCode || (['home', 'away'].includes(metadata.team) ? metadata.team : null);
    const team = side ? historyTeamName(match, side) : abbreviateHistoryTeams(metadata.team || '', match);
    const labels = {
        POINT: 'Point', TIMEOUT: 'Timeout', CHALLENGE: 'Video Challenge',
        FIRST_SERVE: 'First Serve', COURT_SIDE_LEFT: 'Court Side A (Left)', COIN_TOSS_WINNER: 'Coin Toss Winner',
    };
    if (labels[type]) return `${t(labels[type])}${team ? `: ${team}` : ''}`;
    if (type === 'MATCH_START') return t('Match started (Set {0})', [event.set || 1]);
    if (type === 'SET_START') return t('Set {0} started', [event.set]);
    if (type === 'MATCH_FINISHED') return t('Match Finished');
    if (type === 'PROTEST') return t('Match protested');
    if (type === 'FORFEIT') return t('Match forfeited');
    if (type === 'SUBSTITUTION' || type === 'LIBERO') {
        return t('{0}: IN #{1} / OUT #{2} ({3})', [t(type === 'LIBERO' ? 'Libero' : 'Substitution'), metadata.in, metadata.out, team]);
    }
    if (type === 'SUBSTITUTION_BATCH') {
        return `${t('Substitution')} (${team}): ${(metadata.pairs || []).map(pair => `#${pair.outNumber} → #${pair.inNumber}`).join(', ')}`;
    }
    if (type === 'SANCTION') {
        const cards = { YELLOW: 'Yellow card', RED: 'Red card', EXPULSION: 'Expulsion', DISQUALIFICATION: 'Disqualification', DELAY_WARNING: 'Delay warning', DELAY_PENALTY: 'Delay penalty', IMPROPER_REQUEST: 'Improper request' };
        const receiver = metadata.receiver === 'PLAYER' ? `#${metadata.player}` : metadata.receiver === 'STAFF' ? (metadata.staff || t('Staff')) : t('Team');
        return `${t(cards[metadata.card || metadata.sanctionType] || 'Sanction')}: ${receiver}${team ? ` (${team})` : ''}`;
    }
    if (type === 'REPLAY_RALLY') return t('Replay rally ({0} served)', [team]);
    if (type === 'CHALLENGE_START') {
        return `${t('Challenge Review')}: ${team}${metadata.reason ? ` · ${t(metadata.reason)}` : ''}`;
    }
    if (type === 'CHALLENGE_FAULT_ADMISSION') {
        const awarded = event.description?.match(/^Player fault admission - Point awarded to (.+)$/)?.[1];
        return awarded ? t('Player fault admission - Point awarded to {0}', [abbreviateHistoryTeams(awarded, match)]) : t('Fault Admission');
    }
    if (type === 'CHALLENGE_END') {
        const outcome = { SUCCESSFUL: 'Successful', UNSUCCESSFUL: 'Unsuccessful', INCONCLUSIVE: 'Inconclusive' }[metadata.outcome];
        const reason = event.description?.match(/\(([^()]*)\)$/)?.[1];
        const awarded = event.description?.match(/^Challenge SUCCESSFUL: Point reverted to (.+) \(/)?.[1];
        return `${t('Challenge Review')}: ${t(outcome || metadata.outcome || '')}${awarded ? ` · ${t('Point awarded to {0}', [abbreviateHistoryTeams(awarded, match)])}` : ''}${reason ? ` (${t(reason)})` : ''}`;
    }
    if (type === 'LINEUP_CONFIRM' && event.description?.startsWith('Lineup Confirmed - ')) {
        return `${t('Lineup Confirmed')} - ${abbreviateHistoryTeams(event.description.slice('Lineup Confirmed - '.length), match)}`;
    }
    // Unrecognized and manually entered descriptions retain their original wording.
    return abbreviateHistoryTeams(event.description, match);
}
