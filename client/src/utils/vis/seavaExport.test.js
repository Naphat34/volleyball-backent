import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSeavaExport } from './seavaExport.js';
const require = createRequire(import.meta.url);
const { createPayload, commandPayload, view } = require('../../../../backend/utils/customVis.js');
const { importCustomVis } = require('../../../../backend/utils/importCustomVis.js');

function fixture() {
    const players = Array.from({ length: 7 }, (_, index) => ({ number: index + 1, first_name: 'Player', last_name: String(index + 1) }));
    let payload = createPayload({ title: 'Cup', maxSets: 3, gender: 'Female', date: '2026-10-25', time: '10:30', home: { name: 'Home', players }, away: { name: 'Away', players } }, 'custom-export');
    let n = 0;
    const send = command => { payload = commandPayload(payload, { operationId: `export-operation-${++n}`, revision: payload.revision,
        command: { ...command, context: { key: view(payload).state.context.key } } }).payload; };
    send({ type: 'SET_LINEUP', lineups: { home: [1, 2, 3, 4, 5, 6], away: [1001, 1002, 1003, 1004, 1005, 1006] }, servingTeam: 'away', firstSetHomeLeft: false });
    send({ type: 'CONFIGURE_SETTINGS', substitutionLimit: 8, firstServingTeam: 'away' });
    send({ type: 'RALLY', events: [{ team: 'away', player: 1001, skill: 'S', grade: '!' }, { team: 'away', player: 1002, skill: 'A', grade: '#' }] });
    send({ type: 'TIMEOUT', team: 'home' });
    send({ type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 7 });
    const result = view(payload);
    return { payload, result, saved: { ...result, backup: { config: payload.config, match: payload.match, actions: payload.actions } } };
}

test('exports reference SEAVA fields, jersey lineups and chronologically sequenced event codes', () => {
    const { result, saved } = fixture();
    const file = buildSeavaExport(result.match, result.roster, saved, { now: 123456, colors: { home: '#123456', away: '#654321' } });
    assert.equal(file.format, 'seava-vis');
    assert.equal(file.version, 1);
    assert.equal(file.match.config.gender, 'W');
    assert.equal(file.match.config.maxSubs, 8);
    assert.equal(file.match.config.home.color, '#123456');
    assert.deepEqual(Object.keys(file.match.config.home.players[0]), ['number', 'name', 'nameTh', 'role', 'captain']);
    assert.deepEqual(file.match.config.lineups[1].away, [1, 2, 3, 4, 5, 6]);
    assert.equal(file.match.config.firstServe, 'away');
    assert.equal(file.match.config.court.homeTop, false);
    assert.deepEqual(file.events.map(event => event.code), ['*L1,2,3,4,5,6', 'aL1,2,3,4,5,6', 'a01S!', 'a02A#', '*TO', '*SUB1,7']);
    assert.deepEqual(file.events.map(event => event.seq), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(Object.keys(file.events[0]), ['id', 'seq', 'ts', 'code', 'mt', 'stream', 'matchId']);
    assert.ok(file.events.every(event => event.stream === 'scout' && event.matchId === file.match.id));
});
test('exported backup restores rallies, controls, rotation and eight-substitution settings', () => {
    const { result, saved } = fixture();
    const file = JSON.parse(JSON.stringify(buildSeavaExport(result.match, result.roster, saved)));
    const restored = view(importCustomVis(file.backup, 'custom-restored')).state;
    assert.deepEqual(restored.score, result.state.score);
    assert.deepEqual(restored.lineups, result.state.lineups);
    assert.deepEqual(restored.timeouts, result.state.timeouts);
    assert.deepEqual(restored.substitutions, result.state.substitutions);
    assert.equal(restored.substitutionLimit, 8);
    assert.equal(restored.firstServingTeam, 'away');
});
