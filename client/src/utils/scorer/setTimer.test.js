import test from 'node:test';
import assert from 'node:assert/strict';
import { getSetElapsedSeconds, restoreSetTimer } from './setTimer.js';
import { buildScorerLiveState } from './scorerHelpers.js';

test('active set resumes from server even with a missing or stale running flag', () => {
    for (const workflowStep of ['SERVING', 'RALLY', 'CHALLENGE_REVIEW', 'SET_ENDING']) {
        const timer = restoreSetTimer({ workflowStep, matchDuration: '65', isTimerRunning: false }, 100000);
        assert.equal(timer.isTimerRunning, true);
        assert.equal(timer.matchDuration, 65);
        assert.equal(getSetElapsedSeconds(timer, 103000), 68);
    }
});

test('timestamp catches up after a suspended tab and after a reload', () => {
    const timer = { workflowStep: 'RALLY', matchDuration: 2, isTimerRunning: true, setTimerStartedAt: 100000 };
    assert.equal(getSetElapsedSeconds(timer, 165900), 65);
    const restored = restoreSetTimer(JSON.parse(JSON.stringify(buildScorerLiveState(timer))), 220000);
    assert.equal(restored.setTimerStartedAt, 100000);
    assert.equal(restored.matchDuration, 120);
    assert.equal(getSetElapsedSeconds(restored, 221000), 121);
});

test('completed sets remain stopped even if an older client saved running=true', () => {
    for (const workflowStep of ['SET_FINISHED', 'MATCH_FINISHED']) {
        const timer = restoreSetTimer({ workflowStep, matchDuration: 900, isTimerRunning: true, setTimerStartedAt: 100000 }, 1500000);
        assert.equal(timer.isTimerRunning, false);
        assert.equal(timer.setTimerStartedAt, null);
        assert.equal(getSetElapsedSeconds(timer, 1800000), 900);
    }
});

test('next set waits at zero during lineup preparation and starts a fresh clock', () => {
    const waiting = restoreSetTimer({ workflowStep: 'LINEUP', matchDuration: 0, isTimerRunning: false }, 1000000);
    assert.equal(getSetElapsedSeconds(waiting, 1200000), 0);
    const running = restoreSetTimer({ ...waiting, workflowStep: 'SERVING', setTimerStartedAt: 1200000 }, 1200000);
    assert.equal(getSetElapsedSeconds(running, 1205000), 5);
});

test('zero and string durations restore without retaining the previous set duration', () => {
    assert.equal(restoreSetTimer({ workflowStep: 'READY', matchDuration: 0 }, 100000).matchDuration, 0);
    assert.equal(restoreSetTimer({ workflowStep: 'RALLY', matchDuration: '12' }, 100000).matchDuration, 12);
    assert.equal(getSetElapsedSeconds({ isTimerRunning: true, setTimerStartedAt: 120000 }, 100000), 0);
});
