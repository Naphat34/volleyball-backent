import test from 'node:test';
import assert from 'node:assert/strict';
import { visPanelState } from './visPanelState.js';

const ready = { profile: { expiresAt: 200 }, userId: 7, grant: { id: 7, role: 'statistician' }, offline: false, readOnly: false, online: true, onlineUserId: 7, pwaReady: true, shellRequired: true, now: 100 };

test('another offline profile requests current-account preparation instead of PIN unlock', () => {
    const model = visPanelState({ ...ready, profileMismatch: true });
    assert.equal(model.action, 'setup'); assert.equal(model.unlocked, false);
    assert.equal(model.canDownload, false); assert.equal(model.canSync, false);
    assert.equal(model.permit, 'บัญชี Offline ไม่ตรงกัน');
    assert.equal(visPanelState({ ...ready, profileMismatch: true, onlineUserId: null }).action, 'signin');
});
test('PIN is required before downloading or syncing, including another online account', () => {
    const locked = visPanelState({ ...ready, grant: null });
    assert.equal(locked.action, 'unlock'); assert.equal(locked.canDownload, false); assert.equal(locked.canSync, false);
    assert.equal(visPanelState({ ...ready, grant: { id: 99, role: 'statistician' } }).canDownload, false);
    assert.equal(visPanelState({ ...ready, onlineUserId: 99 }).canSync, false);
    assert.equal(visPanelState({ ...ready, grant: { id: 7, role: 'scorer' } }).canDownload, false);
    assert.equal(visPanelState({ ...ready, readOnly: true }).canSync, false);
    assert.equal(visPanelState({ ...ready, profile: { expiresAt: 50 } }).canDownload, false);
});
test('missing preparation and expired backup sessions have explicit recovery actions', () => {
    assert.equal(visPanelState({ ...ready, profile: null, grant: null }).action, 'setup');
    assert.equal(visPanelState({ ...ready, profile: null, grant: null, onlineUserId: null }).action, 'signin');
    const expired = visPanelState({ ...ready, profile: { expiresAt: 50 }, grant: null, readOnly: true });
    assert.equal(expired.label, 'ต่ออายุสิทธิ์'); assert.equal(expired.canSync, false);
    assert.equal(visPanelState({ ...ready, profile: { expiresAt: 50 }, grant: null }).label, 'ปลดล็อกเพื่อสำรองข้อมูล');
});
test('mode, connectivity and app readiness independently control the actions', () => {
    assert.equal(visPanelState(ready).canDownload, true);
    const local = visPanelState({ ...ready, offline: true });
    assert.equal(local.canDownload, false); assert.equal(local.canSync, true); assert.equal(local.label, 'กลับโหมดออนไลน์');
    const disconnected = visPanelState({ ...ready, offline: true, online: false });
    assert.equal(disconnected.disabled, true); assert.equal(disconnected.canSync, false);
    const preparing = visPanelState({ ...ready, pwaReady: false });
    assert.equal(preparing.disabled, true); assert.equal(preparing.canDownload, false);
    assert.equal(visPanelState({ ...ready, pwaReady: false, shellRequired: false }).canDownload, true);
    assert.equal(visPanelState({ ...ready, offline: true, onlineUserId: null }).action, 'signin');
});
