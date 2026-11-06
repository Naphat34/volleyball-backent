import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkflowStepForMatch } from './scorerWorkflow.js';

test('new matches and old unsaved lineup steps require the toss first', () => {
    for (const step of [undefined, 'LINEUP', 'SIGNATURES']) {
        assert.equal(normalizeWorkflowStepForMatch(step, { isHomeLeft: true }), 'COIN_TOSS');
    }
});

test('completed toss allows lineup and refresh keeps active match phases', () => {
    assert.equal(normalizeWorkflowStepForMatch('LINEUP', { firstServeSet1: 'home' }), 'LINEUP');
    assert.equal(normalizeWorkflowStepForMatch('LINEUP', { matchEvents: [{ event_type: 'FIRST_SERVE' }] }), 'LINEUP');
    for (const step of ['READY', 'SERVING', 'RALLY', 'SET_FINISHED']) {
        assert.equal(normalizeWorkflowStepForMatch(step, { score: { home: 2, away: 1 } }), step);
    }
    assert.equal(normalizeWorkflowStepForMatch('LINEUP', { completedSets: [{}] }), 'LINEUP');
});
