const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminVisMatch } = require('../utils/adminVisSnapshot');
const { createPayload } = require('../utils/customVis');

test('admin snapshot strips offline tokens and raw state while exposing lease and lineup completeness', () => {
    const row = { id: 1, home_team_id: 10, away_team_id: 20, home_team: 'H', away_team: 'A', status: 'scheduled', max_sets: 5,
        vis_state: { lineups: { home: [1, 2, 3, 4, 5, 6], away: [] }, offlineVis: { payload: { offlineLease: { deviceId: 'secret-device', expiresAt: 2000 }, operations: ['secret-op'] }, checkoutToken: 'secret-token' } },
        live_state: {}, private_field: 'private', match_date: '2026-10-25' };
    const result = buildAdminVisMatch(row, [], false, 1000);
    assert.equal(result.offline_checked_out, true);
    assert.deepEqual(result.lineup_counts, { home: 6, away: 0 });
    assert.equal(result.match_date, '2026-10-25');
    assert.equal(result.owner, null);
    assert.ok(!JSON.stringify(result).includes('secret'));
    assert.ok(!JSON.stringify(result).includes('private'));
});

test('custom snapshots preserve separate owner identity and sanitize audit entries', () => {
    const payload = createPayload({ title: 'Closed competition', maxSets: 3, home: { name: 'H', players: [] }, away: { name: 'A', players: [] } }, 'custom-a');
    payload.audit = [{ actor_id: 8, action: 'CREATE', at: '2026-10-25', revision: 1, token: 'secret' }];
    const result = buildAdminVisMatch({ payload, owner_username: 'owner-a', published: 0 }, [], true);
    assert.equal(result.owner, 'owner-a');
    assert.equal(result.source, 'custom');
    assert.equal(result.competition_name, 'Closed competition');
    assert.equal(result.audit[0].actor_id, 8);
    assert.equal(result.audit[0].token, undefined);
});

test('statistics aggregate canonical VIS skills without treating receptions as points', () => {
    const match = { id: 1, home_team_id: 10, away_team_id: 20, home_team: 'H', away_team: 'A', status: 'scheduled' };
    const actions = ['#', '=', '/', '+'].map((grade, i) => ({ id: i, team_id: 10, player_id: 5, skill: 'A', grade }));
    actions.push({ team_id: 10, player_id: 5, skill: 'R', grade: '#' });
    const stat = buildAdminVisMatch(match, actions).statistics[0];
    assert.equal(stat.attack, 1);
    assert.equal(stat.attackAttempts, 4);
    assert.equal(stat.attackErrors, 1);
    assert.equal(stat.attackBlocked, 1);
    assert.equal(stat.attempts, 5);
});
