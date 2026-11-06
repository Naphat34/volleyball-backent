import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardMatchStatus, dashboardMatchStatusLabel } from './dashboardStatus.js';

test('recording takes precedence over a scheduled official status', () => {
    const match = { status: 'scheduled', vis_summary: { status: 'recording' } };
    assert.equal(dashboardMatchStatus(match), 'live');
    assert.equal(dashboardMatchStatusLabel(match), 'กำลังบันทึก');
});

test('finished VIS and official results display finished even if the other source is idle', () => {
    for (const match of [
        { status: 'scheduled', vis_summary: { status: 'review' } },
        { status: 'scheduled', vis_summary: { status: 'confirmed' } },
        { status: 'completed', vis_summary: { status: 'idle' } },
        { status: 'scheduled', home_set_score: 3, away_set_score: 0 },
        { is_custom_vis: true, max_sets: 3, vis_summary: { status: 'recording', setsWon: { home: 1, away: 2 } } },
    ]) {
        assert.equal(dashboardMatchStatus(match), 'completed');
        assert.equal(dashboardMatchStatusLabel(match), 'จบแล้ว');
    }
});

test('partial results stay live and setup alone stays scheduled', () => {
    assert.equal(dashboardMatchStatus({ status: 'live', official_summary: { setsWon: { home: 1, away: 0 } } }), 'live');
    assert.equal(dashboardMatchStatus({ status: 'scheduled', vis_summary: { status: 'ready', hasActivity: true } }), 'scheduled');
    assert.equal(dashboardMatchStatusLabel({}), 'ยังไม่เริ่ม');
    assert.equal(dashboardMatchStatus({ status: 'cancelled', home_set_score: 3 }), 'cancelled');
});
