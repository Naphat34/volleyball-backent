import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createPayload, commandPayload, view, importCustomVis } from './visEngine.js';
const require = createRequire(import.meta.url);
const server = require('../../../backend/utils/customVis.js');
const serverImport = require('../../../backend/utils/importCustomVis.js');
test('browser engine matches server through complete match, substitutions, controls and Undo', () => {
    const config = { title: 'Parity', maxSets: 3,
        home: { name: 'H', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'H', last_name: String(i) })) },
        away: { name: 'A', players: Array.from({ length: 7 }, (_, i) => ({ number: i + 1, first_name: 'A', last_name: String(i) })) } };
    let local = createPayload(config, 'custom-test'), remote = server.createPayload(config, 'custom-test');
    let n = 0;
    const send = command => {
        const operation = { operationId: `parity-operation-${++n}`, revision: local.revision, command: { ...command, context: { key: view(local).state.context.key } } };
        local = commandPayload(local, operation).payload; remote = server.commandPayload(remote, operation).payload;
        assert.deepEqual(view(local), server.view(remote));
    };
    const setup = { type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'home', firstSetHomeLeft: true };
    send(setup); send({ type: 'TIMEOUT', team: 'home' });
    send({ type: 'SUBSTITUTION', team: 'home', playerOut: 1, playerIn: 7 }); send({ type: 'UNDO' });
    for (let set = 0; set < 2; set++) {
        if (set) send(setup);
        for (let i = 0; i < 25; i++) send({ type: 'RALLY', events: [{ team: 'home', player: null, skill: 'OP', grade: '#' }] });
    }
    assert.equal(view(local).state.phase, 'MATCH_FINISHED');
    send({ type: 'UNDO' });
    assert.equal(view(local).state.phase, 'PLAYING');
    const backup = { config: local.config, match: local.match, actions: local.actions };
    assert.deepEqual(view(importCustomVis(backup, 'custom-copy')), server.view(serverImport.importCustomVis(backup, 'custom-copy')));
});
