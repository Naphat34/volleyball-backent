import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchSchedule, matchScheduleDate, matchScheduleSortKey } from './matchSchedule.js';
test('SQL date and time use the scheduled Bangkok wall time, including midnight', () => {
    assert.deepEqual(matchSchedule({ match_date: '2026-11-10', start_time: '14:30:00' }), { day: '2026-11-10', time: '14:30' });
    assert.equal(matchSchedule({ match_date: '2026-11-10', start_time: '00:00:00' }).time, '00:00');
    assert.equal(matchSchedule({ match_date: '2026-11-10', start_time: '9:05:00' }).time, '09:05');
    assert.equal(matchScheduleDate({ match_date: '2026-11-10' }), '10/11/26');
});
test('UTC timestamps and cached MySQL dates are interpreted in Bangkok without slicing UTC hours', () => {
    assert.deepEqual(matchSchedule({ raw_start_time: '2026-11-10T18:30:00Z' }), { day: '2026-11-11', time: '01:30' });
    assert.deepEqual(matchSchedule({ match_date: '2026-11-09T17:00:00.000Z', start_time: '14:30:00' }), { day: '2026-11-10', time: '14:30' });
    assert.deepEqual(matchSchedule({ start_time: '2026-11-10 14:30:00' }), { day: '2026-11-10', time: '14:30' });
});
test('missing time stays unset and sorting orders fixtures within the same date', () => {
    assert.equal(matchSchedule({ match_date: '2026-11-10' }).time, '');
    assert.equal(matchSchedule({ start_time: '25:00:00' }).time, '');
    assert.equal(matchScheduleDate({}), '—');
    const matches = [{ id: 1, match_date: '2026-11-10', start_time: '16:00:00' }, { id: 2, match_date: '2026-11-10', start_time: '09:00:00' }];
    assert.deepEqual(matches.sort((a, b) => matchScheduleSortKey(a).localeCompare(matchScheduleSortKey(b))).map(match => match.id), [2, 1]);
});
