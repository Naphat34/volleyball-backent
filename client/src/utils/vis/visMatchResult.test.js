import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVisReport } from './visReportData.js';
import { buildMatchResult } from './visMatchResult.js';

test('Match Result separates starting positions, substitutes, per-set points and scoring attempts', () => {
    const data = { match: { home_team_id: 10, away_team_id: 20, home_team_name: 'Home', away_team_name: 'Away' },
        homePlayers: [{ id: 1, number: 7 }, { id: 2, number: 12 }], awayPlayers: [{ id: 3, number: 7 }],
        lineups: [{ team_id: 10, set_number: 1, player_id_p1: 1 }],
        sets: [{ set_number: 1, home_score: 25, away_score: 20, end_time: '2026-10-20T11:00:00Z' }],
        events: [{ id: 1, team_id: 10, player_id: 1, set_id: 1, skill: 'A', grade: '#' },
            { id: 2, team_id: 10, player_id: 1, set_id: 1, skill: 'A', grade: '=' },
            { id: 3, team_id: 10, set_id: 1, skill: 'SUBSTITUTION', details: { playerOut: 1, playerIn: 2 } },
            { id: 4, team_id: 10, player_id: 2, set_id: 1, skill: 'S', grade: '#' },
            { id: 5, team_id: 20, player_id: 3, set_id: 1, skill: 'B', grade: '#' }] };
    const result = buildMatchResult(data, buildVisReport(data));
    assert.deepEqual(result[0].roster[0].lineup[0], { value: 1, starter: true });
    assert.deepEqual(result[0].roster[1].lineup[0], { value: 7, starter: false });
    assert.deepEqual(result[0].roster[0].setPoints, [1, 0, 0, 0, 0]);
    assert.deepEqual(result[0].performance[0].top.map(player => player.id), [1]);
    assert.equal(result[0].performance[0].attempts, 2);
    assert.equal(result[0].totalPoints, 25);
    assert.equal(result[1].totalPoints, 20);
    assert.equal(result[1].performance[1].won, 1);
    assert.equal(result[0].roster[0].lineup[1].value, '-');
});

test('VIS setup starters are available without official lineups, while absent data remains unknown', () => {
    const data = { match: { home_team_id: 10, away_team_id: 20, vis_state: { lineups: { home: [1], away: [] } } },
        homePlayers: [{ id: 1, number: 2 }], awayPlayers: [], events: [] };
    const result = buildMatchResult(data, buildVisReport(data));
    assert.equal(result[0].roster[0].lineup[0].value, 1);
    assert.equal(result[0].totalPoints, null);
    assert.deepEqual(result[0].best, []);
});
