import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySubstitutionBatch } from './substitutionBatch.js';
const roster = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, number: i + 1 }));
const lineup = roster.slice(0, 6);
const tracker = { count: 0, positions: {}, usedPlayers: [] };
const pairs = [0, 1, 2].map(posIndex => ({ posIndex, playerOut: lineup[posIndex], playerIn: roster[posIndex + 6] }));

test('three pairs update together with one immutable before-state for undo', () => {
    const before = structuredClone({ lineup, tracker });
    const result = applySubstitutionBatch({ lineup, roster, tracker, pairs, score: '12-10' });
    assert.deepEqual(result.lineup.map(p => p.number), [7, 8, 9, 4, 5, 6]);
    assert.equal(result.tracker.count, 3);
    assert.equal(result.tracker.positions[1].substitutionHistory[0].score, '12-10');
    assert.deepEqual({ lineup, tracker }, before);
});

test('an invalid second pair rejects the entire batch without mutation', () => {
    const before = structuredClone({ lineup, tracker });
    const invalid = [pairs[0], { ...pairs[1], playerIn: pairs[0].playerIn }];
    assert.throws(() => applySubstitutionBatch({ lineup, roster, tracker, pairs: invalid }), /twice/);
    assert.deepEqual({ lineup, tracker }, before);
    assert.throws(() => applySubstitutionBatch({ lineup, roster, tracker: { ...tracker, count: 6 }, pairs }), /limit/);
    assert.throws(() => applySubstitutionBatch({ lineup, roster, tracker, pairs, disqualified: [8] }), /unavailable/);
});

test('rotated substitutes can only return their original starters once', () => {
    const first = applySubstitutionBatch({ lineup, roster, tracker, pairs: [pairs[0]] });
    const rotated = [...first.lineup.slice(1), first.lineup[0]];
    assert.throws(() => applySubstitutionBatch({ lineup: rotated, roster, tracker: first.tracker, pairs: [{ posIndex: 5, playerOut: rotated[5], playerIn: roster[7] }] }), /original starter/);
    const returned = applySubstitutionBatch({ lineup: rotated, roster, tracker: first.tracker, pairs: [{ posIndex: 5, playerOut: rotated[5], playerIn: roster[0] }] });
    assert.equal(returned.tracker.positions[0].returned, true);
    assert.equal(returned.lineup[5].originalPos, 0);
    assert.throws(() => applySubstitutionBatch({ lineup: returned.lineup, roster, tracker: returned.tracker, pairs: [{ posIndex: 5, playerOut: roster[0], playerIn: roster[6] }] }), /already used/);
});

test('stale outgoing players and Libero entries are rejected', () => {
    assert.throws(() => applySubstitutionBatch({ lineup, roster, tracker, pairs: [{ ...pairs[0], playerOut: roster[1] }] }), /changed/);
    const liberoRoster = roster.map(p => p.id === 7 ? { ...p, isLibero: true } : p);
    assert.throws(() => applySubstitutionBatch({ lineup, roster: liberoRoster, tracker, pairs: [pairs[0]] }), /Libero/);
});
