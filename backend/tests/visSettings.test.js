const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, commandPayload, view } = require('../utils/customVis');
const { projectOfficialState, configureVisSettings } = require('../utils/visWorkflow');

function game() {
    const players = Array.from({ length: 12 }, (_, index) => ({ number: index + 1, first_name: 'Player', last_name: String(index + 1) }));
    let payload = createPayload({ title: 'Settings test', maxSets: 5, home: { name: 'H', players }, away: { name: 'A', players } }, 'custom-settings');
    let sequence = 0;
    return { get payload() { return payload; }, send(command) {
        const result = commandPayload(payload, { operationId: `settings-operation-${++sequence}`, revision: payload.revision, command });
        payload = result.payload;
        return result;
    } };
}
const lineup = { type: 'SET_LINEUP', servingTeam: 'away', firstSetHomeLeft: true, lineups: { home: [1, 2, 3, 4, 5, 6], away: [1001, 1002, 1003, 1004, 1005, 1006] } };

test('eight substitutions survive reload, accept seventh/eighth and reject ninth', () => {
    const g = game();
    g.send(lineup);
    g.send({ type: 'CONFIGURE_SETTINGS', substitutionLimit: 8, firstServingTeam: 'away' });
    for (let slot = 1; slot <= 4; slot++) {
        g.send({ type: 'SUBSTITUTION', team: 'home', playerOut: slot, playerIn: slot + 6 });
        g.send({ type: 'SUBSTITUTION', team: 'home', playerOut: slot + 6, playerIn: slot });
    }
    const restored = view(JSON.parse(JSON.stringify(g.payload))).state;
    assert.equal(restored.substitutionLimit, 8);
    assert.equal(restored.substitutions.home, 8);
    assert.throws(() => g.send({ type: 'SUBSTITUTION', team: 'home', playerOut: 5, playerIn: 11 }));
    assert.throws(() => g.send({ type: 'CONFIGURE_SETTINGS', substitutionLimit: 6, firstServingTeam: 'away' }), /already used/);
});

test('first server selection updates saved lineup and locks after a rally', () => {
    const g = game();
    g.send(lineup);
    g.send({ type: 'CONFIGURE_SETTINGS', substitutionLimit: 8, firstServingTeam: 'home' });
    assert.equal(view(g.payload).state.servingTeam, 'home');
    assert.equal(view(g.payload).state.firstServingTeam, 'home');
    g.send({ type: 'RALLY', context: { key: view(g.payload).state.context.key }, events: [{ team: 'home', player: null, skill: 'OP', grade: '#' }] });
    assert.throws(() => g.send({ type: 'CONFIGURE_SETTINGS', substitutionLimit: 8, firstServingTeam: 'away' }), /locked/);
    assert.equal(g.send({ type: 'CONFIGURE_SETTINGS', substitutionLimit: 7, firstServingTeam: 'home' }).response.state.substitutionLimit, 7);
});

test('official match settings persist in VIS state and reject limits outside 1–8', () => {
    const match = { max_sets: 5, vis_state: {} };
    const initial = projectOfficialState(match).state;
    assert.equal(initial.substitutionLimit, 6);
    for (const limit of [0, 9, 7.5, '8']) assert.throws(() => configureVisSettings({}, initial, { substitutionLimit: limit, firstServingTeam: 'home' }));
    match.vis_state = configureVisSettings({}, initial, { substitutionLimit: 8, firstServingTeam: 'away' });
    const restored = projectOfficialState(JSON.parse(JSON.stringify(match))).state;
    assert.equal(restored.substitutionLimit, 8);
    assert.equal(restored.servingTeam, 'away');
    assert.equal(restored.firstServingTeam, 'away');
});
