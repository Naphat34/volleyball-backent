const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { substitutionBatchEvents } = require('../utils/substitutionBatch');
const body = { event_type: 'SUBSTITUTION_BATCH', local_event_id: 'batch-123', set_number: 1, team_id: 10, score_home: 12, score_away: 10,
    pairs: [{ in: 7, out: 1 }, { in: 8, out: 2 }, { in: 9, out: 3 }] };

function fixture(failAt = 0) {
    const state = { committed: [], staged: [], deleted: null, attempts: 0, rollbacks: 0 };
    const connection = {
        async beginTransaction() { state.staged = []; state.deleted = null; },
        async commit() { state.committed = state.committed.filter(e => !state.deleted || e.details.batchLocalEventId !== state.deleted); state.committed.push(...state.staged); state.staged = []; },
        async rollback() { state.staged = []; state.deleted = null; state.rollbacks++; }, release() {},
        async query(sql, args) {
            if (sql === 'INSERT TEST') {
                if (++state.attempts === failAt) throw Error('Injected insert failure');
                const event = { ...args[0], id: state.attempts }; state.staged.push(event); return { rows: [event] };
            }
            if (sql.startsWith('DELETE FROM match_events')) { state.deleted = args[1]; return { rows: [] }; }
            if (sql.startsWith('SELECT status FROM matches')) return { rows: [{ status: 'live' }] };
            if (sql.includes('FROM match_events')) return { rows: state.committed.filter(e => e.details.batchLocalEventId === args[1] || e.details.batchCancelledId === args[1]) };
            return { rows: [] };
        }
    };
    const filename = require.resolve('../controllers/scorerOfflineController');
    const localRequire = createRequire(filename);
    const fakeController = "const db = require('../config/db'); module.exports = { updateLiveState: async(req,res) => res.json({success:true}), saveMatchEvent: async (req,res) => { const result = await db.query('INSERT TEST',[req.body]); res.json({event:result.rows[0]}); } };";
    const scope = { exports: {}, console, require: name => {
        if (name === '../config/db') return { connect: async () => connection };
        if (name === 'node:fs') return { ...fs, readFileSync: () => fakeController };
        if (name === './officialVisOfflineController') return { assertOnline: async () => {} };
        return localRequire(name);
    }};
    scope.require.resolve = localRequire.resolve;
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), scope, { filename });
    const req = { params: { matchId: 42 }, body: structuredClone(body), app: { get: () => null } };
    const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; } });
    return { controller: scope.exports, state, req, response };
}

test('batch persists three standard substitution rows in a single transaction; retries are idempotent', async () => {
    const f = fixture(), response = f.response();
    await f.controller.online('saveMatchEvent')(f.req, response);
    assert.equal(response.code, 200);
    assert.equal(f.state.committed.length, 3);
    assert.deepEqual(f.state.committed.map(e => e.player_id), [7, 8, 9]);
    assert.ok(f.state.committed.every(e => e.event_type === 'SUBSTITUTION' && e.details.batchLocalEventId === body.local_event_id));
    await f.controller.online('saveMatchEvent')(f.req, f.response());
    assert.equal(f.state.committed.length, 3);
});

test('failure in the second pair rolls back all pairs', async () => {
    const f = fixture(2), response = f.response();
    await f.controller.online('saveMatchEvent')(f.req, response);
    assert.equal(response.code, 500);
    assert.equal(f.state.committed.length, 0);
    assert.equal(f.state.rollbacks, 1);
});

test('cancelled batches cannot be replayed by a delayed queue retry', async () => {
    const f = fixture();
    f.state.committed.push({ id: 1, details: { batchCancelledId: body.local_event_id } });
    const response = f.response();
    await f.controller.online('saveMatchEvent')(f.req, response);
    assert.equal(response.code, 200);
    assert.equal(f.state.attempts, 0);
    assert.equal(f.state.committed.length, 1);
});

test('online undo removes every pair and prevents delayed re-insertion', async () => {
    const f = fixture();
    await f.controller.online('saveMatchEvent')(f.req, f.response());
    const response = f.response();
    await f.controller.online('undoSubstitutionBatch')({ ...f.req, body: { batchId: body.local_event_id, state: { score: { home: 12, away: 10 }, matchData: { currentSet: 1 } } } }, response);
    assert.equal(response.code, 200);
    assert.equal(f.state.committed.filter(e => e.event_type === 'SUBSTITUTION').length, 0);
    await f.controller.online('saveMatchEvent')(f.req, f.response());
    assert.equal(f.state.committed.filter(e => e.event_type === 'SUBSTITUTION').length, 0);
});

test('invalid and duplicate players are rejected before the first insert', () => {
    assert.throws(() => substitutionBatchEvents({ ...body, pairs: [{ in: 7, out: 1 }, { in: 7, out: 2 }] }), /duplicate/);
    assert.throws(() => substitutionBatchEvents({ ...body, pairs: [{ in: 7, out: 1 }, { in: 1, out: 2 }] }), /enter and leave/);
    assert.throws(() => substitutionBatchEvents({ ...body, pairs: [] }), /Invalid/);
});
