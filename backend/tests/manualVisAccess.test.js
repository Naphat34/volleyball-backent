const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canReadStatistics, assertStatisticsWriter } = require('../utils/manualVisAccess');
const fixture = () => ({ manual_owner_id: 7, manual_vis_shared: 1, manual_lifecycle: 'ready', status: 'live', manual_vis_assignee_id: 9 });
test('statistics opt-in is separate from Livescore visibility and never grants scorer-role access', () => {
    const match = fixture();
    assert.equal(canReadStatistics({ role: 'statistician', id: 9 }, match), true);
    assert.equal(canReadStatistics({ role: 'score', id: 7 }, match), false);
    assert.equal(canReadStatistics({ role: 'referee' }, match), false);
    assert.equal(canReadStatistics(null, match), false);
    for (const patch of [{ manual_vis_shared: 0, manual_published: 1 }, { manual_lifecycle: 'draft' }, { status: 'cancelled' }]) {
        assert.equal(canReadStatistics({ role: 'statistician' }, { ...match, ...patch }), false);
    }
});
test('only the current assigned statistician can write', () => {
    assert.doesNotThrow(() => assertStatisticsWriter({ role: 'statistician', id: 9 }, fixture()));
    for (const user of [{ role: 'statistician', id: 10 }]) {
        assert.throws(() => assertStatisticsWriter(user, fixture()), { status: 409 });
    }
    assert.throws(() => assertStatisticsWriter({ role: 'statistician', id: 9 }, { ...fixture(), manual_vis_shared: 0 }), { status: 403 });
    assert.throws(() => assertStatisticsWriter({ role: 'statistician', id: 9 }, { ...fixture(), manual_vis_assignee_id: null }), { status: 409 });
});

test('even an assigned administrator cannot record statistics', () => {
 assert.throws(() => assertStatisticsWriter({ role: 'admin', id: 9 }, fixture()), {status: 403});
});
