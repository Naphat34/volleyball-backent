import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardSetResult, officialCompletedSetScores } from './dashboardResult.js';

test('completed official scores omit live set points and show colon-separated scores', () => {
    assert.deepEqual(officialCompletedSetScores({ set_scores: '["25-15","20-25"]', official_summary: { score: { home: 8, away: 6 } } }), ['25:15', '20:25']);
    assert.deepEqual(officialCompletedSetScores({ set_scores: ['25:19', '0-0', 'bad'] }), ['25:19']);
    assert.deepEqual(officialCompletedSetScores({ set_scores: 'invalid' }), []);
    assert.deepEqual(officialCompletedSetScores({ official_summary: { score: { home: 25, away: 15 } } }), []);
});

test('unplayed matches and prepared lineups display a dash', () => {
    assert.equal(dashboardSetResult({ status: 'scheduled' }), '-');
    assert.equal(dashboardSetResult({ status: 'scheduled', vis_summary: { status: 'ready', hasActivity: true, setsWon: { home: 0, away: 0 } } }), '-');
});

test('official results use sets won, independently of VIS point scores', () => {
    assert.equal(dashboardSetResult({ status: 'completed', official_summary: { setsWon: { home: 3, away: 0 } }, vis_summary: { score: { home: 25, away: 17 } } }), '3 - 0');
    assert.equal(dashboardSetResult({ status: 'completed', home_set_score: 1, away_set_score: 3 }), '1 - 3');
    assert.equal(dashboardSetResult({ status: 'scheduled', home_set_score: 3, away_set_score: 0 }), '3 - 0');
    assert.equal(dashboardSetResult({ status: 'live', official_summary: { setsWon: { home: 0, away: 0 } } }), '0 - 0');
});

test('custom VIS and independently recorded matches display VIS sets won', () => {
    assert.equal(dashboardSetResult({ is_custom_vis: true, status: 'completed', vis_summary: { status: 'review', setsWon: { home: 3, away: 1 }, score: { home: 25, away: 20 } } }), '3 - 1');
    assert.equal(dashboardSetResult({ status: 'scheduled', vis_summary: { status: 'recording', setsWon: { home: 1, away: 0 } } }), '1 - 0');
    assert.equal(dashboardSetResult({ is_custom_vis: true, vis_summary: { status: 'recording', score: { home: 10, away: 8 } } }), '0 - 0');
});
