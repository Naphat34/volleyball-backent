import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScorerLiveState, replaceLineupPlayer, isLineupSetupLocked, saveRosterApproval } from './scorerHelpers.js';
import { getPlayerId, getPlayerNumber } from './playerFilters.js';

test('player IDs support restored primitive IDs and all API field aliases', () => {
    for (const player of [42, { id: 42 }, { player_id: 42 }, { playerId: 42 }]) {
        assert.equal(getPlayerId(player), 42);
    }
    assert.equal(getPlayerId('42'), '42');
    assert.equal(getPlayerId({ id: 0, player_id: 42 }), 0);
    assert.equal(getPlayerId(null), null);
    assert.equal(getPlayerId({}), null);
});

test('jersey number contexts retain their existing precedence and empty values', () => {
    const player = { entry_number: 8, jersey_number: 9, shirt_number: 10 };
    assert.equal(getPlayerNumber(player), 9);
    const staffOptions = {
        fields: ['number', 'entry_number', 'shirt_number', 'jersey_number'],
        fallback: '', preserveEmpty: true
    };
    assert.equal(getPlayerNumber(player, staffOptions), 8);
    assert.equal(getPlayerNumber({ ...player, number: '' }, staffOptions), '');
    assert.equal(getPlayerNumber({ ...player, number: 0 }, staffOptions), 0);
    const reportOptions = { fields: ['number', 'shirt_number', 'jersey_number', 'shirtNumber'], fallback: '' };
    assert.equal(getPlayerNumber(player, reportOptions), 10);
    assert.equal(getPlayerNumber({ shirtNumber: 11 }, reportOptions), 11);
    assert.equal(getPlayerNumber(null, reportOptions), '');
    assert.equal(getPlayerNumber(null), '?');
});

test('workflow snapshots retain shared fields and use fresh signatures without mutating state', () => {
    const state = {
        workflowStep: 'READY', matchSignatures: { homeCaptain: 'old' },
        firstServeSet1: 'home', currentChallengeReview: null,
        homeRoster: [{ id: 1 }], score: { home: 25, away: 20 }, history: ['local only']
    };
    const finalSignatures = { homeCaptain: 'new' };
    const result = buildScorerLiveState(state, {
        workflowStep: 'MATCH_FINISHED', matchSignatures: finalSignatures, updatedAt: 123
    });
    assert.equal(result.workflowStep, 'MATCH_FINISHED');
    assert.equal(result.matchSignatures, finalSignatures);
    assert.equal(result.firstServeSet1, 'home');
    assert.equal(result.currentChallengeReview, null);
    assert.deepEqual(result.score, { home: 25, away: 20 });
    assert.equal(result.updatedAt, 123);
    assert.equal('history' in result, false);
    assert.equal(state.workflowStep, 'READY');
    assert.equal(state.matchSignatures.homeCaptain, 'old');
});

test('start and roster saves support fresh fields and numeric sync timestamps', () => {
    const events = [{ id: 'start' }];
    const roster = [{ id: 2 }];
    const result = buildScorerLiveState({ homeRoster: [{ id: 1 }] }, {
        homeRoster: roster, workflowStep: 'SERVING', isTimerRunning: true, matchEvents: events
    });
    assert.equal(result.homeRoster, roster);
    assert.equal(result.matchEvents, events);
    assert.equal(result.isTimerRunning, true);
    assert.equal(Number.isFinite(result.updatedAt), true);
});

test('multiple substitutions preserve original positions and previous lineup snapshots', () => {
    const lineup = [{ id: 1, originalPos: 4 }, { id: 2, originalPos: 0 }];
    const first = replaceLineupPlayer(lineup, 0, { id: 7, originalPos: 99 }, 4);
    const second = replaceLineupPlayer(first, 1, { id: 8 }, 0);
    assert.deepEqual(second, [{ id: 7, originalPos: 4 }, { id: 8, originalPos: 0 }]);
    assert.deepEqual(lineup, [{ id: 1, originalPos: 4 }, { id: 2, originalPos: 0 }]);
    assert.equal(first[1].id, 2);
});

test('first-set setup locks each saved action independently and stays locked in later sets', () => {
    const setup = { home: { rosterLocked: true }, away: { colorLocked: true } };
    assert.equal(isLineupSetupLocked(1, {}, 'home', 'rosterLocked'), false);
    assert.equal(isLineupSetupLocked(1, setup, 'home', 'rosterLocked'), true);
    assert.equal(isLineupSetupLocked(1, setup, 'home', 'colorLocked'), false);
    assert.equal(isLineupSetupLocked(1, setup, 'away', 'rosterLocked'), false);
    assert.equal(isLineupSetupLocked(1, setup, 'away', 'colorLocked'), true);
    for (const team of ['home', 'away']) {
        for (const field of ['rosterLocked', 'colorLocked']) {
            assert.equal(isLineupSetupLocked('2', {}, team, field), true);
        }
    }
});

test('saved roster approvals cannot be overwritten or cleared and lock the signed team', () => {
    const empty = {};
    assert.equal(saveRosterApproval(empty, 'homeCaptain', null), empty);
    assert.equal(saveRosterApproval(empty, 'referee1', 'signature'), empty);
    const setup = saveRosterApproval(empty, 'homeCaptain', 'captain-signature');
    assert.equal(saveRosterApproval(setup, 'homeCaptain', 'replacement'), setup);
    assert.equal(saveRosterApproval(setup, 'homeCaptain', null), setup);
    assert.equal(isLineupSetupLocked(1, setup, 'home', 'rosterLocked'), true);
    assert.equal(isLineupSetupLocked(1, setup, 'home', 'colorLocked'), true);
    assert.equal(isLineupSetupLocked(1, setup, 'away', 'rosterLocked'), false);
    const withCoach = saveRosterApproval(setup, 'homeCoach', 'coach-signature');
    assert.deepEqual(withCoach.approvals, { homeCaptain: 'captain-signature', homeCoach: 'coach-signature' });
    assert.equal(empty.approvals, undefined);
});

test('live-state round trips retain roster locks, color locks and approvals', () => {
    const lineupSetup = saveRosterApproval({ home: { rosterLocked: true, colorLocked: true } }, 'homeCaptain', 'signature');
    const restored = JSON.parse(JSON.stringify(buildScorerLiveState({ lineupSetup })));
    assert.deepEqual(restored.lineupSetup, lineupSetup);
    assert.equal(isLineupSetupLocked(1, restored.lineupSetup, 'home', 'rosterLocked'), true);
    assert.equal(saveRosterApproval(restored.lineupSetup, 'homeCaptain', 'changed'), restored.lineupSetup);
});
