const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, commandPayload, view } = require('../utils/customVis');
const { importCustomVis } = require('../utils/importCustomVis');
const config = () => ({ title: 'Backup match', maxSets: 3, home: { name: 'H', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'H', last_name: String(i) })) }, away: { name: 'A', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'A', last_name: String(i) })) } });
function fixture() {
    let payload = createPayload(config(), 'custom-source'); let index = 0;
    return { get payload() { return payload; }, send(command) {
        payload = commandPayload(payload, { operationId: `source-operation-${String(++index).padStart(10, '0')}`, revision: payload.revision,
            command: { ...command, context: { key: view(payload).state.context.key } } }).payload;
    } };
}
const lineup = { type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true };
test('backup round-trip preserves score, rotation, timeout, substitutions without trusting saved score', () => {
    const game = fixture(); game.send(lineup);
    game.send({ type: 'RALLY', events: [{ team: 'away', player: 1001, skill: 'A', grade: '#' }, { team: 'home', player: null, skill: 'T', grade: '=' }] });
    game.send({ type: 'TIMEOUT', team: 'home' });
    game.send({ type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 7 });
    const backup = structuredClone(game.payload);
    backup.actions.forEach(event => { event.details.visContext.scoreAfter = { home: 999, away: 999 }; });
    const imported = importCustomVis(backup, 'custom-destination');
    assert.equal(imported.match.id, 'custom-destination');
    assert.deepEqual(view(imported).state.score, { home: 0, away: 1 });
    assert.equal(view(imported).state.context.serverPlayerId, 1002);
    assert.equal(view(imported).state.lineups.home[0], 7);
    assert.equal(view(imported).state.timeouts.home, 1);
    assert.equal(imported.audit, undefined);
});
test('complete multi-event rallies across set boundaries import as results awaiting review', () => {
    const game = fixture(); game.send(lineup);
    for (let set = 1; set <= 2; set++) {
        if (set > 1) game.send(lineup);
        for (let point = 0; point < 25; point++) game.send({ type: 'RALLY', events: [{ team: 'home', player: 1, skill: 'A', grade: '#' }, { team: 'away', player: null, skill: 'T', grade: '=' }] });
    }
    game.send({ type: 'CONFIRM' });
    const restored = importCustomVis(game.payload, 'custom-new');
    assert.equal(restored.lifecycle, 'review');
    assert.deepEqual(view(restored).state.setsWon, { home: 2, away: 0 });
});
test('unknown players and malformed backups are rejected', () => {
    assert.throws(() => importCustomVis({}, 'custom-new'), /ไม่ถูกต้อง/);
    const game = fixture(); game.send(lineup);
    game.send({ type: 'RALLY', events: [{ team: 'home', player: 1, skill: 'S', grade: '#' }] });
    const bad = structuredClone(game.payload); bad.actions[0].player_id = 999;
    assert.throws(() => importCustomVis(bad, 'custom-new'), /ผู้เล่น/);
});
