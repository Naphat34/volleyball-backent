const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, view, commandPayload } = require('../utils/customVis');
const config = () => ({ title: 'Practice', maxSets: 3, date: '2026-10-20',
    home: { name: 'Home', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'Home', last_name: String(i) })) },
    away: { name: 'Away', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'Away', last_name: String(i) })) } });
function game() {
    let payload = createPayload(config(), 'custom-test');
    let n = 1;
    return { get payload() { return payload; }, send(command) {
        const state = view(payload).state;
        const operation = { revision: payload.revision, operationId: `custom-operation-${n++}`, command: { ...command, context: { key: state.context.key } } };
        const result = commandPayload(payload, operation); payload = result.payload; return { ...result, operation };
    } };
}
const lineup = { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] };
const setup = { type: 'SET_LINEUP', lineups: lineup, servingTeam: 'home', firstSetHomeLeft: true };
test('custom roster snapshots validate duplicates and remain isolated from source input', () => {
    const source = config(), payload = createPayload(source, 'custom-test');
    source.home.players[0].first_name = 'Changed';
    assert.equal(payload.config.home.players[0].first_name, 'Home');
    assert.notEqual(payload.config.home.players[0].id, payload.config.away.players[0].id);
    const invalid = config(); invalid.home.players[1].number = 1;
    assert.throws(() => createPayload(invalid, 'custom-test'), /ซ้ำ/);
});
test('rallies are idempotent, rotate once and undo restores the whole rally', () => {
    const g = game(); g.send(setup);
    const result = g.send({ type: 'RALLY', events: [{ team: 'away', player: 1001, skill: 'A', grade: '#' }, { team: 'home', player: 1, skill: 'B', grade: '=' }] });
    assert.deepEqual(result.response.state.score, { home: 0, away: 1 });
    assert.equal(result.response.state.context.serverPlayerId, 1002);
    assert.equal(commandPayload(g.payload, result.operation).response.duplicate, true);
    assert.equal(g.payload.actions.length, 2);
    const undo = g.send({ type: 'UNDO' });
    assert.equal(undo.response.deletedEventIds.length, 2);
    assert.equal(undo.response.state.context.serverPlayerId, 1);
    assert.deepEqual(undo.response.state.score, { home: 0, away: 0 });
    assert.equal(commandPayload(g.payload, undo.operation).response.duplicate, true);
});
test('end-to-end lifecycle finishes two sets, requires review and locks confirmed results', () => {
    const g = game(); g.send(setup);
    for (let set = 1; set <= 2; set++) {
        if (set > 1) g.send(setup);
        for (let point = 0; point < 25; point++) g.send({ type: 'RALLY', events: [{ team: 'home', player: 1, skill: 'A', grade: '#' }] });
    }
    assert.equal(view(g.payload).state.phase, 'MATCH_FINISHED');
    assert.equal(g.payload.lifecycle, 'review');
    g.send({ type: 'CONFIRM' });
    assert.equal(g.payload.lifecycle, 'confirmed');
    assert.equal(view(g.payload).match.status, 'completed');
    assert.throws(() => g.send({ type: 'UNDO' }), /ล็อก/);
});
test('timeouts and substitutions enforce limits, ownership of players and return pairs', () => {
    const g = game(); g.send(setup);
    g.send({ type: 'TIMEOUT', team: 'home' }); g.send({ type: 'TIMEOUT', team: 'home' });
    assert.throws(() => g.send({ type: 'TIMEOUT', team: 'home' }), /ครบ/);
    assert.throws(() => g.send({ type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 1007 }), /คู่/);
    g.send({ type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 7 });
    assert.equal(view(g.payload).state.lineups.home[0], 7);
    g.send({ type: 'SUBSTITUTION', team: 'home', playerOut: 7, playerIn: 1 });
    assert.throws(() => g.send({ type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 7 }), /คู่/);
});
