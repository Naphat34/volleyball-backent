const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function harness(fail = false) {
    const calls = [];
    const connection = { beginTransaction: async () => calls.push('begin'), commit: async () => calls.push('commit'), rollback: async () => calls.push('rollback'), release: () => calls.push('release'), query: async sql => {
        calls.push(sql);
        if (sql.includes('FROM custom_vis_matches')) { if (fail) throw Error('DB failed'); return { rows: [] }; }
        if (sql.includes('FROM match_actions')) return { rows: [] };
        return { rows: [{ id: 5, status: 'scheduled', home_team_id: 10, away_team_id: 20, competition_name: 'Closed competition' }] };
    } };
    const file = require.resolve('../controllers/adminVisController');
    const originalRequire = createRequire(file);
    const scope = { exports: {}, Date, console: { error() {} }, require: name => name === '../config/db' ? { connect: async () => connection } : originalRequire(name) };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope, { filename: file });
    const result = { status: 200, body: null };
    return { calls, result, run: () => scope.exports.overview({ user: { role: 'admin' } }, { status(code) { result.status = code; return this; }, json(body) { result.body = body; } }) };
}

test('overview reads one transaction and includes competitions without an open-status restriction', async () => {
    const h = harness(); await h.run();
    assert.equal(h.result.status, 200);
    assert.equal(h.result.body.matches.length, 1);
    assert.equal(h.result.body.matches[0].competition_name, 'Closed competition');
    assert.equal(h.result.body.offline_queue_visible, false);
    assert.equal(h.calls[0], 'begin');
    assert.deepEqual(h.calls.slice(-2), ['commit', 'release']);
    assert.ok(h.calls.filter(call => call.startsWith('SELECT')).every(sql => !/\b(UPDATE|DELETE|INSERT)\b/.test(sql)));
});

test('partial reads fail explicitly and release their transaction', async () => {
    const h = harness(true); await h.run();
    assert.equal(h.result.status, 500);
    assert.equal(h.result.body.matches, undefined);
    assert.deepEqual(h.calls.slice(-2), ['rollback', 'release']);
});

test('admin overview route requires approved authentication and admin permission', () => {
    const file = require.resolve('../routes/adminRoutes');
    const routes = [], middleware = [];
    const router = { use: (...handlers) => middleware.push(...handlers), get: (path, ...handlers) => routes.push({ path, handlers }), post() {}, put() {}, delete() {} };
    const auth = { verifyApprovedToken() {}, isAdmin() {}, canManageTeams() {} }, overview = () => {};
    const scope = { module: { exports: {} }, require: name => name === 'express' ? { Router: () => router } : name.includes('authMiddleware') ? auth : name.includes('adminVisController') ? { overview } : {} };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), scope);
    assert.equal(middleware[0], auth.verifyApprovedToken);
    const route = routes.find(item => item.path === '/vis/overview');
    assert.equal(route.handlers[0], auth.isAdmin);
    assert.equal(route.handlers[1], overview);
});
