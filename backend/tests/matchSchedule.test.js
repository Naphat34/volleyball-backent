const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMatchSchedule } = require('../utils/matchSchedule');
test('normalizer preserves SQL date and time and removes the raw transport field', () => {
    assert.deepEqual(normalizeMatchSchedule({ id: 1, match_date: '2026-11-10', raw_start_time: '14:30:00' }), { id: 1, match_date: '2026-11-10', start_time: '14:30' });
    assert.equal(normalizeMatchSchedule({ raw_start_time: '00:00:00' }).start_time, '00:00');
});
test('normalizer converts instants to Bangkok and does not overwrite the explicit fixture date', () => {
    assert.deepEqual(normalizeMatchSchedule({ raw_start_time: '2026-11-10T18:30:00Z' }), { match_date: '2026-11-11', start_time: '01:30' });
    assert.deepEqual(normalizeMatchSchedule({ match_date: new Date('2026-11-09T17:00:00Z'), raw_start_time: '2026-11-10 14:30:00' }), { match_date: '2026-11-10', start_time: '14:30' });
    assert.deepEqual(normalizeMatchSchedule({ match_date: '2026-11-12', raw_start_time: '2026-11-10T18:30:00Z' }), { match_date: '2026-11-12', start_time: '01:30' });
});
test('missing and invalid times are not replaced with midnight', () => {
    assert.deepEqual(normalizeMatchSchedule({ match_date: '2026-11-10', raw_start_time: null }), { match_date: '2026-11-10', start_time: null });
    assert.equal(normalizeMatchSchedule({ raw_start_time: 'invalid' }).start_time, null);
});
