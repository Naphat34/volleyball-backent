import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardRefresh } from './dashboardRefresh.js';
test('dashboard coalesces events during a slow request and stops cleanly on navigation', async () => {
    const target = new EventTarget(), page = Object.assign(new EventTarget(), { hidden: false });
    let release, calls = 0, active = 0, maxActive = 0;
    const updates = dashboardRefresh(async () => {
        calls++; active++; maxActive = Math.max(active, maxActive);
        if (calls === 1) await new Promise(resolve => { release = resolve; });
        active--;
    }, { target, page, intervalMs: 60000 });
    try {
        const initial = updates.refresh(false);
        target.dispatchEvent(new Event('focus')); target.dispatchEvent(new Event('online'));
        assert.equal(calls, 1); release(); await initial; await Promise.resolve();
        assert.equal(calls, 2); assert.equal(maxActive, 1);
        page.hidden = true; await updates.refresh(); assert.equal(calls, 2);
        page.hidden = false; page.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
        assert.equal(calls, 3);
        updates.stop(); target.dispatchEvent(new Event('vis-local-updated')); await updates.refresh();
        assert.equal(calls, 3);
    } finally { updates.stop(); }
});
