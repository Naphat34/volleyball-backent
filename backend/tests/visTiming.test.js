const test = require('node:test');
const assert = require('node:assert/strict');
const { projectVisTiming, normalizeVisTiming } = require('../utils/visTiming');
const { createPayload, commandPayload, view } = require('../utils/customVis');

function event(set, minute, score = { home: 0, away: 0 }, startMinute = null) {
    const at = value => new Date(Date.UTC(2026, 10, 3, 0, value)).toISOString();
    return { action_type: 'VIS_STAT', set_number: set, details: { visContext: { scoreAfter: score }, visTiming: { setNumber: set, recordedAt: at(minute), setStartedAt: startMinute === null ? null : at(startMinute) } } };
}
test('set clocks freeze on winning event, exclude the inter-set wait, and include the first keystroke', () => {
    const actions = [event(1, 1, undefined, 0), event(1, 20, { home: 25, away: 10 }), event(2, 31, undefined, 30), event(2, 50, { home: 25, away: 20 })];
    const result = projectVisTiming(actions, [{ set: 1 }, { set: 2 }], 5);
    assert.deepEqual(result.sets.map(s => s.durationSeconds), [1200, 1200]);
    assert.equal(result.breakSeconds, 180);
    assert.equal(result.totalSeconds, 2580);
    const corrected = projectVisTiming([...actions, event(1, 200, { home: 25, away: 10 })], [{ set: 1 }, { set: 2 }], 5);
    assert.equal(corrected.sets[0].durationSeconds, 1200);
});
test('best-of-three and best-of-five skip only the interval before the deciding set', () => {
    const run = max => projectVisTiming(Array.from({ length: max }, (_, i) => [event(i + 1, i * 30, undefined, i * 30), event(i + 1, i * 30 + 20, { home: i + 1 === max ? 15 : 25, away: 0 })]).flat(), Array.from({ length: max }, (_, i) => ({ set: i + 1 })), max);
    assert.equal(run(3).breakSeconds, 180);
    assert.equal(run(3).totalSeconds, 3 * 1200 + 180);
    assert.equal(run(5).breakSeconds, 540);
    assert.equal(run(5).totalSeconds, 5 * 1200 + 540);
});
test('unfinished/undone sets stay open and missing legacy timestamps never fabricate a total', () => {
    const result = projectVisTiming([event(1, 0), event(1, 20, { home: 24, away: 10 })], [], 3);
    assert.equal(result.sets[0].endedAt, null);
    assert.equal(result.totalSeconds, null);
    assert.equal(projectVisTiming([event(2, 30), event(2, 50, { home: 25, away: 0 })], [{ set: 1 }, { set: 2 }], 5).totalSeconds, null);
    assert.equal(normalizeVisTiming({ setNumber: 2, recordedAt: 'invalid' }, 2), null);
    assert.equal(normalizeVisTiming({ setNumber: 1, recordedAt: '2026-11-03' }, 2), null);
});
test('custom payload persists event timing and rebuilding state retains it', () => {
    const players = prefix => Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: prefix, last_name: String(i) }));
    let payload = createPayload({ title: 'Timed', maxSets: 3, home: { name: 'H', players: players('H') }, away: { name: 'A', players: players('A') } }, 'custom-timing');
    const lineups = Object.fromEntries(['home', 'away'].map(key => [key, payload.config[key].players.map(p => p.id)]));
    payload = commandPayload(payload, { operationId: 'timing-lineup-operation', revision: 0, command: { type: 'SET_LINEUP', lineups, servingTeam: 'home', firstSetHomeLeft: true } }).payload;
    const operation = { operationId: 'timing-rally-operation', revision: payload.revision, timing: { setNumber: 1, recordedAt: '2026-11-03T01:01:00Z', setStartedAt: '2026-11-03T01:00:00Z' }, command: { type: 'RALLY', context: { key: view(payload).state.context.key }, events: [{ team: 'home', player: null, skill: 'OP', grade: '#' }] } };
    const result = commandPayload(payload, operation);
    assert.equal(result.payload.actions[0].created_at, new Date(operation.timing.recordedAt).toISOString());
    assert.equal(view(JSON.parse(JSON.stringify(result.payload))).state.timing.sets[0].startedAt, new Date(operation.timing.setStartedAt).toISOString());
    assert.equal(commandPayload(result.payload, operation).response.duplicate, true);
});
