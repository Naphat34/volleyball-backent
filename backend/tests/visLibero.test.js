const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, commandPayload, view } = require('../utils/customVis');
const { importCustomVis } = require('../utils/importCustomVis');

function fixture() {
    const players = Array.from({ length: 9 }, (_, i) => ({ number: i + 1, first_name: 'Player', last_name: String(i + 1), position: i >= 7 ? 'L' : 'OH' }));
    let payload = createPayload({ title: 'Libero', maxSets: 3, home: { name: 'H', players }, away: { name: 'A', players } }, 'libero-test');
    let sequence = 0;
    const send = command => {
        const state = view(payload).state;
        const operation = { operationId: `libero-operation-${++sequence}`, revision: payload.revision, command: { ...command, context: state.context } };
        const result = commandPayload(payload, operation);
        payload = result.payload;
        return result.response.state;
    };
    send({ type: 'SET_LINEUP', lineups: { home: [1,2,3,4,5,6], away: [1001,1002,1003,1004,1005,1006] }, servingTeam: 'away', firstSetHomeLeft: true });
    return { send, state: () => view(payload).state, payload: () => payload,
        swap: (playerOut, playerIn) => send({ type: 'LIBERO_REPLACEMENT', team: 'home', playerOut, playerIn }),
        rally: (team = 'away') => send({ type: 'RALLY', events: [{ team, player: null, skill: 'OP', grade: '#' }] }) };
}

test('Libero replacements do not use substitution quota; require a rally and the original partner', () => {
    const f = fixture();
    assert.throws(() => f.swap(2,8), /back-row/);
    assert.throws(() => f.send({ type: 'SUBSTITUTION', team: 'home', playerOut: 5, playerIn: 8 }), /Libero/);
    let state = f.swap(5,8);
    assert.equal(state.lineups.home[4], 8);
    assert.equal(state.substitutions.home, 0);
    assert.throws(() => f.swap(8,5), /แรลลี่จบ/);
    assert.throws(() => f.send({ type: 'RALLY', events: [{team:'home', player:8, skill:'B', grade:'#'}] }), /cannot serve or block/);
    f.send({ type: 'RALLY', events: [{team:'home', player:8, skill:'D', grade:'+'}, {team:'away', player:null, skill:'OP', grade:'#'}] });
    assert.throws(() => f.swap(8,7), /replaced player/);
    state = f.swap(8,9);
    assert.deepEqual(state.liberoReplacements.home, {libero:9, regular:5});
    f.rally();
    state = f.swap(9,5);
    assert.equal(state.liberoReplacements.home, null);
    f.rally();
    state = f.swap(5,8);
    assert.equal(state.substitutions.home, 0);
    assert.equal(state.lineups.home[4], 8);
});

test('rotation requires Libero to return before the next rally; Undo restores replacement and rotation', () => {
    const f = fixture();
    f.swap(5,8);
    let state = f.rally('home');
    assert.equal(state.lineups.home[3], 8);
    assert.throws(() => f.rally(), /ผู้เล่นเดิมกลับ/);
    state = f.swap(8,5);
    assert.equal(state.lineups.home[3],5);
    state = f.send({type:'UNDO'});
    assert.equal(state.lineups.home[3],8);
    state = f.send({type:'UNDO'});
    assert.equal(state.lineups.home[4],8);
    assert.equal(state.score.home,0);
    state = f.send({type:'UNDO'});
    assert.equal(state.liberoReplacements.home,null);
    assert.equal(state.lineups.home[4],5);
});

test('Libero backup import preserves replacements and supports further undo', () => {
    const f = fixture();
    f.swap(5,8); f.rally(); f.swap(8,9);
    const imported = importCustomVis(f.payload(), 'imported-libero');
    assert.deepEqual(view(imported).state.liberoReplacements, f.state().liberoReplacements);
    assert.deepEqual(view(imported).state.lineups, f.state().lineups);
    assert.deepEqual(view(imported).state.substitutions,{home:0,away:0});
});

test('generated offline engine matches server for Libero entry, rally, second Libero and Undo', async () => {
    const offline = await import('../../client/src/offline/visEngine.js');
    const f=fixture();
    let payload=structuredClone(f.payload());
    for (const command of [
        {type:'LIBERO_REPLACEMENT',team:'home',playerOut:5,playerIn:8},
        {type:'RALLY',events:[{team:'away',player:null,skill:'OP',grade:'#'}]},
        {type:'LIBERO_REPLACEMENT',team:'home',playerOut:8,playerIn:9},
        {type:'UNDO'}
    ]) {
        const state=offline.view(payload).state;
        payload=offline.commandPayload(payload,{revision:payload.revision,operationId:'offline-parity-libero-'+payload.revision,command:{...command,context:state.context}}).payload;
        const expected=f.send(command), actual=offline.view(payload).state;
        assert.deepEqual(actual.lineups,expected.lineups);
        assert.deepEqual(actual.liberoReplacements,expected.liberoReplacements);
        assert.deepEqual(actual.substitutions,expected.substitutions);
    }
});

test('new sets reset Libero replacement state and reject serving-position entry', () => {
    const f=fixture();
    f.swap(1,8);
    f.rally('home');
    assert.equal(f.state().lineups.home[5],8);
    f.swap(8,1);
    assert.throws(() => f.swap(2,9), /แรลลี่จบ/);
    const g=fixture(); g.swap(5,8);
    for(let i=0;i<25;i++) g.rally();
    assert.equal(g.state().currentSet,2);
    assert.equal(g.state().liberoReplacements.home,null);
    assert.equal(g.state().lastLiberoRally.home,null);
    g.send({type:'SET_LINEUP',lineups:{home:[1,2,3,4,5,6],away:[1001,1002,1003,1004,1005,1006]}});
    assert.throws(() => g.swap(1,8), /back-row/);
});
