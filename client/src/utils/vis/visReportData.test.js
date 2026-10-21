import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attempts, buildVisReport, percentage, playerPoints } from './visReportData.js';

const data = () => ({
    match: { id: 1, home_team_id: 10, away_team_id: 20, status: 'live', home_team_name: 'Home', away_team_name: 'Away',
        left_side_team_id: 20,
        live_state: JSON.stringify({ scoringSource: 'escore', workflowStep: 'RALLY', matchData: { currentSet: 2 },
            score: { home: 3, away: 4 }, setsWon: { home: 1, away: 0 }, completedSets: [{ set: 1, home: 25, away: 19 }],
            vis: { score: { home: 99, away: 99 }, setsWon: { home: 9, away: 9 } } }) },
    homePlayers: [{ id: 101, number: 21, first_name: 'Player' }, { id: 102, number: 9 }],
    awayPlayers: [{ id: 201, number: 21 }],
    sets: [{ set_number: 2, home_score: 0, away_score: 0 }],
    events: [
        { id: 1, team_id: 10, player_id: 101, skill: 'S', grade: '#', details: '{"jersey_number":12}', set_id: 1 },
        { id: 2, team_id: 10, player_id: 101, skill: 'A', grade: '#', set_id: 1 },
        { id: 3, team_id: 10, player_id: 101, skill: 'A', grade: '=', set_id: 1 },
        { id: 4, team_id: 10, player_id: 101, skill: 'A', grade: '+', set_id: 1 },
        { id: 5, team_id: 10, player_id: 101, skill: 'R', grade: '#', set_id: 1 },
        { id: 6, team_id: 10, player_id: 101, skill: 'R', grade: '+', set_id: 1 },
        { id: 7, team_id: 10, player_id: 101, skill: 'R', grade: '-', set_id: 1 },
        { id: 8, team_id: 20, player_id: 201, skill: 'B', grade: '#', set_id: 1 },
        { id: 9, team_id: 10, player_id: 101, skill: 'SANCTION', grade: null },
        { id: 10, team_id: 10, player_id: 101, skill: 'S', grade: 'ACE' },
    ],
});
test('report uses immutable A/B mapping, authoritative scores and recorded jerseys', () => {
    const input = data();
    const report = buildVisReport(input);
    assert.equal(report.teams[0].key, 'away');
    assert.equal(report.teams[1].players[0].number, 12);
    assert.deepEqual(report.sets.map(set => [set.home, set.away]), [[25, 19], [3, 4]]);
    assert.deepEqual(report.wins, { home: 1, away: 0 });
    assert.equal(input.homePlayers[0].number, 21);
});
test('individual points exclude reception winners and opponent errors; percentages use attempts', () => {
    const report = buildVisReport(data());
    const home = report.teams.find(team => team.key === 'home');
    const away = report.teams.find(team => team.key === 'away');
    assert.equal(playerPoints(home.stats), 2);
    assert.equal(playerPoints(away.stats), 1);
    assert.equal(away.opponentErrors, 1);
    assert.equal(attempts(home.stats, 'A'), 3);
    assert.equal(percentage(home.stats.A['#'] - home.stats.A['='], attempts(home.stats, 'A')), '0.0%');
    assert.equal(percentage(home.stats.R['#'] + home.stats.R['+'], attempts(home.stats, 'R')), '66.7%');
    assert.equal(report.excluded, 1);
    assert.equal(home.players[1].count, 0);
});
test('missing statistics and legacy scores stay distinguishable from recorded zero', () => {
    const input = data();
    input.events = [];
    input.match.live_state = null;
    input.match.status = 'completed';
    const report = buildVisReport(input);
    assert.equal(report.hasStats, false);
    assert.equal(report.completed, true);
    assert.equal(report.teams[0].count, 0);
    assert.equal(percentage(0, 0), '-');
    assert.equal(percentage(0, 5), '0.0%');
});
test('events whose players left the roster are retained, with no mutation or loss', () => {
    const input = data();
    input.events.push({ id: 11, player_id: 999, team_id: 20, skill: 'S', grade: '#', details: { jersey_number: 42 } });
    const report = buildVisReport(input);
    const former = report.teams.find(team => team.key === 'away').players.find(player => player.id === 999);
    assert.equal(former.number, 42);
    assert.equal(playerPoints(former.stats), 1);
    assert.equal(input.awayPlayers.length, 1);
});

test('old VIS scores and later statistical event scores cannot override official results', () => {
    const input = data();
    input.match.live_state = { workflowStep: 'SERVING', vis: { phase: 'MATCH_FINISHED', score: { home: 99, away: 0 }, setsWon: { home: 9, away: 0 } } };
    input.match.home_set_score = 1;
    input.match.away_set_score = 0;
    input.sets = [{ set_number: 1, home_score: 25, away_score: 19, end_time: '2026-10-19' }];
    input.events.push({ id: 11, skill: 'S', grade: '#', team_id: 10, player_id: 101, set_id: 2, score_home: 99, score_away: 0, details: { vis: true } });
    const report = buildVisReport(input);
    assert.deepEqual(report.wins, { home: 1, away: 0 });
    assert.deepEqual(report.sets.map(set => [set.number, set.home, set.away]), [[1, 25, 19]]);
    assert.equal(report.completed, false);
});
