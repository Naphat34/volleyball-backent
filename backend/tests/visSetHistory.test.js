const test = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, commandPayload, view } = require('../utils/customVis');

test('set history retains starting lineups and completed scores when the next lineup is saved', () => {
    const players = prefix => Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: prefix, last_name: String(i) }));
    let payload = createPayload({ title: 'Set history', maxSets: 5, home: { name: 'H', players: players('H') }, away: { name: 'A', players: players('A') } }, 'custom-set-history');
    let sequence = 0;
    const send = command => {
        payload = commandPayload(payload, { operationId: `set-history-operation-${++sequence}`, revision: payload.revision, command: { ...command, context: { key: view(payload).state.context.key } } }).payload;
    };
    const lineups = { home: [1, 2, 3, 4, 5, 6], away: [1001, 1002, 1003, 1004, 1005, 1006] };
    send({ type: 'SET_LINEUP', lineups, servingTeam: 'home', firstSetHomeLeft: true });
    for (let i = 0; i < 25; i++) send({ type: 'RALLY', events: [{ team: 'home', player: null, skill: 'OP', grade: '#' }] });
    let state = view(payload).state;
    assert.equal(state.currentSet, 2);
    assert.equal(state.setupComplete, false);
    assert.deepEqual(state.completedSets, [{ set: 1, home: 25, away: 0 }]);
    assert.deepEqual(state.setLineups[1].home, lineups.home);
    assert.equal(state.setLineups[2], undefined);
    const second = { home: [7, 2, 3, 4, 5, 6], away: lineups.away };
    send({ type: 'SET_LINEUP', lineups: second });
    state = view(JSON.parse(JSON.stringify(payload))).state;
    assert.equal(state.setupComplete, true);
    assert.deepEqual(state.setLineups[1].home, lineups.home);
    assert.deepEqual(state.setLineups[2].home, second.home);
    assert.equal(state.completedSets[0].set, 1);
    assert.equal(payload.actions.filter(a => a.set_number === 2).length, 0);
});
