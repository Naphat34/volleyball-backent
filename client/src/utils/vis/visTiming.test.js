import test from 'node:test';
import assert from 'node:assert/strict';
import { formatVisDuration, projectVisTiming } from './visTiming.js';

test('clock displays waiting, zero seconds and durations longer than one hour without resetting', () => {
    assert.equal(formatVisDuration(null), '–:–');
    assert.equal(formatVisDuration(0), '00:00');
    assert.equal(formatVisDuration(3661), '61:01');
    assert.equal(formatVisDuration(-1), '–:–');
});

test('legacy database timestamps recover completed set durations while the next set remains unstarted', () => {
    const actions = [{ action_type: 'VIS_STAT', set_number: 1, created_at: '2026-11-03T01:00:00Z', score_home: 1, score_away: 0 },
        { action_type: 'VIS_STAT', set_number: 1, created_at: '2026-11-03T01:20:00Z', score_home: 25, score_away: 0 }];
    const timing = projectVisTiming(actions, [{ set: 1 }], 5);
    assert.equal(timing.sets[0].durationSeconds, 1200);
    assert.equal(timing.sets.find(set => set.set === 2), undefined);
});
