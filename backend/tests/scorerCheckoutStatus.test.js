const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scorerCheckoutStatus } = require('../utils/scorerCheckoutStatus');
const match = { id: 1, status: 'scheduled', home_team_id: 21, away_team_id: 42 };
const now = 1000, device = 'primary-device-001';
test('Scorer checkout distinguishes own lease, another device/account and released/expired leases', () => {
    const lease = { owner_id: 7, device_id: device, released: 0, expires_at: 2000 };
    assert.equal(scorerCheckoutStatus(match, null, 7, device, now).state, 'available');
    assert.equal(scorerCheckoutStatus(match, lease, '7', device, now).state, 'own');
    assert.equal(scorerCheckoutStatus(match, lease, 8, device, now).canCheckout, false);
    assert.equal(scorerCheckoutStatus(match, lease, 7, 'another-device-002', now).canCheckout, false);
    assert.equal(scorerCheckoutStatus(match, { ...lease, released: 1 }, 8, device, now).canCheckout, true);
    assert.equal(scorerCheckoutStatus(match, { ...lease, expires_at: now }, 8, device, now).canCheckout, true);
});
test('Scorer checkout blocks active VIS leases, closed matches and missing teams', () => {
    const setup = { offlineVis: { payload: { offlineLease: { expiresAt: 2000 } } } };
    assert.equal(scorerCheckoutStatus({ ...match, vis_state: JSON.stringify(setup) }, null, 7, device, now).state, 'vis');
    assert.equal(scorerCheckoutStatus({ ...match, vis_state: setup }, null, 7, device, 2000).canCheckout, true);
    for (const status of ['completed','finished','match_finished','cancelled','canceled']) assert.equal(scorerCheckoutStatus({ ...match, status }, null, 7, device, now).canCheckout, false);
    assert.equal(scorerCheckoutStatus(null, null, 7, device, now).state, 'missing');
    assert.equal(scorerCheckoutStatus({ ...match, away_team_id: null }, null, 7, device, now).state, 'teams');
});
test('Scorer status endpoint reads a coherent lease without making a reservation', async () => {
    const fs = require('node:fs'), vm = require('node:vm'), { createRequire } = require('node:module');
    const file = require.resolve('../controllers/scorerOfflineController'), localRequire = createRequire(file);
    const queries = []; let committed = false, released = false;
    const connection = { beginTransaction: async () => {}, commit: async () => { committed = true; }, rollback: async () => {}, release() { released = true; }, query: async (sql, args) => {
        queries.push({ sql, args });
        return { rows: sql.includes('FROM matches') ? [match] : [{ owner_id: 8, device_id: device, released: 0, expires_at: Date.now() + 60000 }] };
    } };
    const scope = { exports: {}, console, require: name => name === '../config/db' ? { connect: async () => connection } : localRequire(name) };
    scope.require.resolve = localRequire.resolve;
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope, { filename: file });
    const res = { code: 200, set(name, value) { this.header = [name, value]; }, status(code) { this.code = code; return this; }, json(value) { this.data = value; } };
    await scope.exports.status({ params: { matchId: 1 }, query: { deviceId: device }, user: { id: 7 } }, res);
    assert.equal(res.code, 200); assert.equal(res.data.canCheckout, false); assert.equal(res.data.state, 'scorer');
    assert.deepEqual(res.header, ['Cache-Control', 'no-store']);
    assert.ok(committed && released); assert.ok(queries.every(item => item.sql.startsWith('SELECT') && item.sql.includes('FOR UPDATE')));
});
