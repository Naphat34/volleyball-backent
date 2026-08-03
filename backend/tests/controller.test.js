const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const loadControllerWithDb = (controllerPath, fakeDb) => {
  const dbPath = require.resolve('../config/db');
  const resolvedControllerPath = require.resolve(controllerPath);
  const auditLoggerPath = require.resolve('../utils/auditLogger');

  delete require.cache[resolvedControllerPath];
  delete require.cache[dbPath];
  delete require.cache[auditLoggerPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: fakeDb,
  };

  return require(controllerPath);
};

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    cookies: {},
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
  return response;
};

test('authController.login returns user payload and sets auth cookie', async () => {
  const passwordHash = await bcrypt.hash('password123', 8);
  const fakeDb = {
    query: async () => ({
      rows: [{
        id: 7,
        username: 'admin',
        password_hash: passwordHash,
        role: 'admin',
        status: 'approved',
        team_id: null,
      }],
    }),
  };
  const authController = loadControllerWithDb('../controllers/authController', fakeDb);
  const req = { body: { username: 'admin', password: 'password123' } };
  const res = createResponse();

  await authController.login(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.username, 'admin');
  assert.equal(res.body.user.role, 'admin');
  assert.ok(res.body.token);
  assert.equal(res.cookies.token.options.httpOnly, true);
});

test('matchController.deleteMatch audits the deleted match', async () => {
  const queries = [];
  const fakeDb = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/SELECT \* FROM matches/i.test(sql)) return { rows: [{ id: 11, status: 'scheduled' }] };
      if (/DELETE FROM matches/i.test(sql)) return { rows: [], rowCount: 1, affectedRows: 1 };
      if (/INSERT INTO audit_logs/i.test(sql)) return { rows: [], insertId: 1 };
      return { rows: [] };
    },
  };
  const matchController = loadControllerWithDb('../controllers/matchController', fakeDb);
  const req = {
    params: { id: '11' },
    user: { id: 1, username: 'admin', role: 'admin' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();

  await matchController.deleteMatch(req, res);

  assert.equal(res.body.message, 'Match deleted');
  assert.ok(queries.some((query) => /INSERT INTO audit_logs/i.test(query.sql)));
});

test('competitionsController.deleteCompetition removes related rows and audits deletion', async () => {
  const queries = [];
  const fakeClient = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/SELECT \* FROM competitions/i.test(sql)) return { rows: [{ id: 3, title: 'Cup' }] };
      if (/SELECT id FROM matches/i.test(sql)) return { rows: [{ id: 21 }] };
      if (/SELECT id FROM team_entries/i.test(sql)) return { rows: [{ id: 31 }] };
      if (/DELETE FROM competitions/i.test(sql)) return { rows: [], affectedRows: 1, rowCount: 1 };
      return { rows: [], affectedRows: 1, rowCount: 1 };
    },
    release() {},
  };
  const fakeDb = { pool: { connect: async () => fakeClient } };
  const competitionsController = loadControllerWithDb('../controllers/competitionsController', fakeDb);
  const req = {
    params: { id: '3' },
    user: { id: 1, username: 'admin', role: 'admin' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();

  await competitionsController.deleteCompetition(req, res);

  assert.equal(res.body.message, 'Deleted successfully');
  assert.ok(queries.some((query) => /DELETE tep FROM team_entry_players/i.test(query.sql)));
  assert.ok(queries.some((query) => /INSERT INTO audit_logs/i.test(query.sql)));
});

test('scorerController.getLiveState parses stored JSON state', async () => {
  const fakeDb = {
    query: async () => ({ rows: [{ live_state: '{"workflowStep":"LIVE","score":{"home":5,"away":4}}' }] }),
  };
  const scorerController = loadControllerWithDb('../controllers/scorerController', fakeDb);
  const req = { params: { matchId: '9' } };
  const res = createResponse();

  await scorerController.getLiveState(req, res);

  assert.equal(res.body.workflowStep, 'LIVE');
  assert.deepEqual(res.body.score, { home: 5, away: 4 });
});
