import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVisRally, rallyCode } from './visRally.js';
const make = (key, numbers) => ({ key, players: numbers.map(number => ({ id: number + (key === 'away' ? 100 : 0), number })), lineup: numbers.map(number => ({ id: number + (key === 'away' ? 100 : 0), number })) });
const teams = { A: make('home', [3, 7, 9, 11, 12, 1]), B: make('away', [6, 4, 10, 13, 14, 2]) };
test('manual rally examples resolve to one winner with valid opponent suggestions', () => {
    for (const [text, winner] of [['*03S a 10#', 'away'], ['a4/', 'home'], ['3=', 'away'], ['*7S a4/', 'home'], ['*7S a13=', 'home'], ['a6S 11 14B#', 'away'], ['*OP#', 'home'], ['aT=', 'home']]) {
        const result = parseVisRally(text, teams, 'home');
        assert.deepEqual(result.errors, [], text);
        assert.equal(result.winner, winner, text);
    }
    const result = parseVisRally('a6S 11 14B#', teams, 'away');
    assert.equal(result.events[1].grade, '/');
    assert.equal(result.suggestions.length, 0);
    const blocked = parseVisRally('*7S a4/', teams, 'home');
    assert.ok(blocked.suggestions.some(event => rallyCode(event) === '*09B#'));
});
test('auto pairs, explicit paired results, full VIS and invalid entries', () => {
    assert.equal(rallyCode(parseVisRally('3#', teams, 'home').suggestions[0]), 'aT=');
    assert.equal(rallyCode(parseVisRally('3=', teams, 'home').suggestions[0]), 'aOP#');
    assert.equal(parseVisRally('*3S a10A# *7B=', teams, 'home').suggestions.length, 0);
    assert.deepEqual(parseVisRally('A:S3 a10R+ *7A#', teams, 'home').errors, []);
    assert.ok(parseVisRally('*99A#', teams, 'home').errors.length);
    assert.ok(parseVisRally('*3A# a10A#', teams, 'home').errors.length);
    assert.ok(parseVisRally('*3S/', teams, 'home').errors.length);
    assert.equal(parseVisRally('*3S', teams, 'home').winner, null);
});
