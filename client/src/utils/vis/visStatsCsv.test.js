import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchStats, buildSetStats, matchStatsCsv, detailedStats } from './visStatsCsv.js';

const match = { id: 84, home_team_id: 1, away_team_id: 2 };
const teams = [
    { key: 'home', name: 'ทีม ก', players: [{ id: 10, number: 3, name: 'นักกีฬา ก' }] },
    { key: 'away', name: 'ทีม ข', players: [{ id: 20, number: 4, name: 'นักกีฬา ข' }] },
];

test('court summary counts only the current set and counts paired opponent errors once', () => {
    const events = [
        { team_id: 1, skill: 'A', grade: '#', set_id: 1 },
        { team_id: 1, skill: 'S', grade: '#', set_id: 2 },
        { team_id: 2, skill: 'B', grade: '#', set_number: 2 },
        { team_id: 2, skill: 'S', grade: '=', set_id: 2, details: { rallyId: 'error' } },
        { team_id: 1, skill: 'OP', grade: '#', set_id: 2, details: '{"rallyId":"error"}' },
        { team_id: 1, skill: 'A', grade: '#', set_id: 2, details: { rallyId: 'kill' } },
        { team_id: 2, skill: 'T', grade: '=', set_id: 2, details: { rallyId: 'kill' } },
    ];
    const stats = buildSetStats(match, teams, events, 2);
    assert.equal(stats[0].total.attack[1], 1);
    assert.equal(stats[0].total.serve[1], 1);
    assert.equal(stats[1].total.block[0], 1);
    assert.equal(stats[0].opponentErrors, 1);
    assert.equal(stats[1].opponentErrors, 0);
    assert.ok(buildSetStats(match, teams, events, 3).every(team => team.total.points === 0 && team.opponentErrors === 0));
});
test('CSV and modal share player counts and team grades without mixing teams or controls', () => {
    const stats = buildMatchStats(match, teams, [
        { team_id: 1, player_id: 10, skill: 'S', grade: '#' },
        { team_id: 1, player_id: 10, skill: 'R', grade: '#' },
        { team_id: 2, player_id: 20, skill: 'A', grade: '=' },
        { team_id: 1, player_id: null, skill: 'TIMEOUT' },
    ]);
    assert.deepEqual(stats[0].players[0].counts, [1, 1, 0, 0, 0, 0]);
    assert.equal(stats[0].players[0].points, 1);
    assert.equal(stats[1].players[0].errors, 1);
    assert.equal(stats[0].skills.find(item => item.skill === 'S').grades[0], 1);
    const csv = matchStatsCsv(match, stats);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.includes('"นักกีฬา ก"'));
    assert.equal(csv.trimEnd().split('\r\n').length, 5);
});
test('CSV escapes quotes, commas and newlines and protects text from spreadsheet formulas', () => {
    const stats = buildMatchStats(match, [{ ...teams[0], name: 'A,"B"\nC', players: [{ id: 10, number: 3, name: '=1+1' }] }], []);
    const csv = matchStatsCsv(match, stats);
    assert.ok(csv.includes('"A,""B""\nC"'));
    assert.ok(csv.includes('"\'=1+1"'));
    assert.ok(csv.endsWith('\r\n'));
});
test('attack errors and blocks reduce efficiency, reception positive includes perfect and positive passes', () => {
    const detail = detailedStats([
        ...['#', '#', '=', '/'].map(grade => ({ skill: 'A', grade })),
        ...['#', '+', '=', '-'].map(grade => ({ skill: 'R', grade })),
    ]);
    assert.deepEqual(detail.attack, [4, 2, 1, 1]);
    assert.equal(detail.efficiency, 0);
    assert.equal(detail.positive, 0.5);
    assert.equal(detail.points, 2);
    assert.equal(detailedStats([]).efficiency, null);
    const stats = buildMatchStats(match, teams, [
        { team_id: 1, player_id: 10, skill: 'A', grade: '#' },
        { team_id: 1, player_id: 99, skill: 'A', grade: '=' },
        { team_id: 1, player_id: 99, skill: 'A', grade: '-' },
    ]);
    assert.equal(stats[0].total.efficiency, 0);
});
