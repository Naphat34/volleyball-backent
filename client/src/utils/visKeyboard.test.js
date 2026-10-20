import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVisInput, resolveVisSpaceInput } from './visKeyboard.js';

// Both teams have jersey 21; selection must be resolved before using a player ID.
const teams = {
    A: { key: 'away', name: 'Team A', players: [{ id: 123, number: 21 }, { id: 124, number: 7 }], lineup: [{ id: 123 }] },
    B: { key: 'home', name: 'Team B', players: [{ id: 456, number: '21' }, { id: 457, number: 7 }], lineup: [{ id: 456 }, { id: 457 }] },
};

test('single space retains team and double space resolves the opposite roster', () => {
    assert.equal(resolveVisSpaceInput('S21#', 'A', 1, teams).entry.command.player, 123);
    assert.equal(resolveVisSpaceInput('S21#', 'A', 2, teams).entry.command.player, 456);
    assert.equal(resolveVisSpaceInput('S21#', 'B', 2, teams).entry.command.player, 123);
    const prefixed = resolveVisSpaceInput('B:S21#', 'B', 2, teams);
    assert.equal(prefixed.label, 'A');
    assert.equal(prefixed.draft, 'S21#');
    assert.equal(prefixed.entry.command.player, 123);
    assert.ok(resolveVisSpaceInput('R7+', 'B', 2, teams).entry.error);
    assert.equal(resolveVisSpaceInput('', 'A', 2, teams).label, 'B');
    assert.equal(resolveVisSpaceInput('', 'A', 2, teams).entry.empty, true);
});

test('keyboard entry resolves the selected team, jersey and canonical STAT command', () => {
    const entry = resolveVisInput(' s21# ', 'A', teams);
    assert.equal(entry.code, 'S21#');
    assert.deepEqual(entry.command, { type: 'STAT', team: 'away', player: 123, skill: 'S', grade: '#' });
    assert.equal(resolveVisInput('S21#', 'B', teams).command.player, 456);
});
test('explicit prefixes override selection, while A without a colon remains an attack skill', () => {
    assert.equal(resolveVisInput('b:r7+', 'A', teams).command.player, 457);
    assert.equal(resolveVisInput('A21=', 'A', teams).command.skill, 'A');
    assert.equal(resolveVisInput('A:S21#', 'B', teams).command.player, 123);
});
test('all six skills and five grades resolve without assigning points in the parser', () => {
    for (const skill of ['S', 'R', 'A', 'B', 'D', 'E']) for (const grade of ['#', '+', '!', '-', '=']) {
        const entry = resolveVisInput(`${skill}21${grade}`, 'B', teams);
        assert.equal(entry.command.skill, skill);
        assert.equal(entry.command.grade, grade);
        assert.equal(entry.command.type, 'STAT');
        assert.equal(entry.command.score, undefined);
    }
});
test('rejects missing, bench-only, duplicate or malformed player codes', () => {
    for (const text of ['S', 'S21', 'S21?', 'C:S21#', 'S21# A21#', 'S-1#', 'S1.5#', 'S21 ']) assert.ok(resolveVisInput(text, 'A', teams).error, text);
    assert.ok(resolveVisInput('S99#', 'A', teams).error);
    assert.match(resolveVisInput('R7+', 'A', teams).error, /ไม่ได้อยู่ในสนาม/);
    const duplicate = { ...teams, A: { ...teams.A, players: [...teams.A.players, { id: 999, number: 21 }] } };
    assert.match(resolveVisInput('S21#', 'A', duplicate).error, /ซ้ำ/);
    assert.equal(resolveVisInput('', 'A', teams).empty, true);
});

test('keyboard entry accepts a registered player before eScoreControl publishes a lineup', () => {
    const beforeLineup = { ...teams, A: { ...teams.A, lineup: [] } };
    assert.equal(resolveVisInput('R7+', 'A', beforeLineup).command.player, 124);
});
