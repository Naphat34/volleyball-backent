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

test('authController.getMe returns safe user profile fields', async () => {
  const fakeDb = {
    query: async (sql) => {
      if (/information_schema\.columns/i.test(sql)) {
        return { rows: [{ column_name: 'email' }, { column_name: 'phone' }] };
      }
      if (/SELECT id, username, role, status, team_id, email, phone FROM users/i.test(sql)) {
        return {
          rows: [{
            id: 7,
            username: 'teamuser',
            role: 'team_staff',
            status: 'approved',
            team_id: 3,
            email: 'team@example.com',
            phone: '123',
          }],
        };
      }
      return { rows: [] };
    },
  };
  const authController = loadControllerWithDb('../controllers/authController', fakeDb);
  const req = { user: { id: 7 } };
  const res = createResponse();

  await authController.getMe(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.username, 'teamuser');
  assert.equal(res.body.email, 'team@example.com');
  assert.equal(res.body.password_hash, undefined);
});

test('authController.updateMe updates allowed profile fields and refreshes token', async () => {
  const queries = [];
  const fakeDb = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/information_schema\.columns/i.test(sql)) {
        return { rows: [{ column_name: 'email' }, { column_name: 'phone' }] };
      }
      if (/SELECT id FROM users WHERE username/i.test(sql)) return { rows: [] };
      if (/UPDATE users SET/i.test(sql)) return { rows: [], affectedRows: 1, rowCount: 1 };
      if (/SELECT id, username, role, status, team_id, email, phone FROM users/i.test(sql)) {
        return {
          rows: [{
            id: 7,
            username: 'newname',
            role: 'team_staff',
            status: 'approved',
            team_id: 3,
            email: 'new@example.com',
            phone: '456',
          }],
        };
      }
      if (/INSERT INTO audit_logs/i.test(sql)) return { rows: [], insertId: 1 };
      return { rows: [] };
    },
  };
  const authController = loadControllerWithDb('../controllers/authController', fakeDb);
  const req = {
    user: { id: 7, username: 'teamuser', role: 'team_staff' },
    body: { username: 'newname', email: 'new@example.com', phone: '456', role: 'admin' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();

  await authController.updateMe(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.username, 'newname');
  assert.ok(res.body.token);
  assert.ok(queries.some((query) => /UPDATE users SET username = \?, email = \?, phone = \?/i.test(query.sql)));
  assert.ok(!queries.some((query) => /role = \?/i.test(query.sql)));
  assert.ok(queries.some((query) => /INSERT INTO audit_logs/i.test(query.sql)));
});

test('authController.updateMe rejects duplicate username', async () => {
  const fakeDb = {
    query: async (sql) => {
      if (/information_schema\.columns/i.test(sql)) return { rows: [] };
      if (/SELECT id FROM users WHERE username/i.test(sql)) return { rows: [{ id: 9 }] };
      return { rows: [] };
    },
  };
  const authController = loadControllerWithDb('../controllers/authController', fakeDb);
  const req = { user: { id: 7 }, body: { username: 'taken' }, headers: {}, socket: {} };
  const res = createResponse();

  await authController.updateMe(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Username already exists');
});

test('authController.changeMyPassword verifies current password and updates hash', async () => {
  const currentHash = await bcrypt.hash('oldpassword', 8);
  const queries = [];
  const fakeDb = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/SELECT id, username, password_hash FROM users/i.test(sql)) {
        return { rows: [{ id: 7, username: 'teamuser', password_hash: currentHash }] };
      }
      if (/UPDATE users SET password_hash/i.test(sql)) return { rows: [], affectedRows: 1, rowCount: 1 };
      if (/INSERT INTO audit_logs/i.test(sql)) return { rows: [], insertId: 1 };
      return { rows: [] };
    },
  };
  const authController = loadControllerWithDb('../controllers/authController', fakeDb);
  const req = {
    user: { id: 7, username: 'teamuser', role: 'team_staff' },
    body: {
      current_password: 'oldpassword',
      new_password: 'newpassword',
      confirm_password: 'newpassword',
    },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();

  await authController.changeMyPassword(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Password changed successfully');
  assert.ok(queries.some((query) => /UPDATE users SET password_hash/i.test(query.sql)));
  assert.ok(queries.some((query) => /INSERT INTO audit_logs/i.test(query.sql)));
});

test('authController.changeMyPassword rejects incorrect current password', async () => {
  const currentHash = await bcrypt.hash('oldpassword', 8);
  const fakeDb = {
    query: async (sql) => {
      if (/SELECT id, username, password_hash FROM users/i.test(sql)) {
        return { rows: [{ id: 7, username: 'teamuser', password_hash: currentHash }] };
      }
      return { rows: [] };
    },
  };
  const authController = loadControllerWithDb('../controllers/authController', fakeDb);
  const req = {
    user: { id: 7 },
    body: {
      current_password: 'wrongpassword',
      new_password: 'newpassword',
      confirm_password: 'newpassword',
    },
    headers: {},
    socket: {},
  };
  const res = createResponse();

  await authController.changeMyPassword(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Current password is incorrect');
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

test('competitionsController.toggleCompetitionStatus updates and returns the competition', async () => {
  const queries = [];
  const fakeDb = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/UPDATE competitions SET status/i.test(sql)) return { rows: [], affectedRows: 1, rowCount: 1 };
      if (/SELECT \* FROM competitions/i.test(sql)) return { rows: [{ id: 5, title: 'Cup', status: 'closed' }] };
      return { rows: [] };
    },
  };
  const competitionsController = loadControllerWithDb('../controllers/competitionsController', fakeDb);
  const req = { params: { id: '5' }, body: { status: 'Closed' } };
  const res = createResponse();

  await competitionsController.toggleCompetitionStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'closed');
  assert.deepEqual(queries[0].params, ['closed', '5']);
});

test('competitionsController.toggleCompetitionStatus rejects invalid status', async () => {
  const fakeDb = {
    query: async () => {
      throw new Error('query should not be called for invalid status');
    },
  };
  const competitionsController = loadControllerWithDb('../controllers/competitionsController', fakeDb);
  const req = { params: { id: '5' }, body: { status: 'paused' } };
  const res = createResponse();

  await competitionsController.toggleCompetitionStatus(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Invalid competition status');
});

test('competitionsController.removeTeamFromCompetition removes registration rows and audits deletion', async () => {
  const queries = [];
  const fakeClient = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (/FROM team_entries te/i.test(sql)) {
        return {
          rows: [{
            id: 41,
            team_id: 9,
            competition_id: 7,
            display_name: 'Team A - Cup',
            status: 'pending',
            competition_title: 'Cup',
            team_name: 'Team A',
          }],
        };
      }
      if (/FROM matches/i.test(sql)) return { rows: [] };
      if (/information_schema\.TABLES/i.test(sql)) return { rows: [{ count: 1 }] };
      if (/INSERT INTO audit_logs/i.test(sql)) return { rows: [], insertId: 1 };
      return { rows: [], affectedRows: 1, rowCount: 1 };
    },
    release() {},
  };
  const fakeDb = { pool: { connect: async () => fakeClient } };
  const competitionsController = loadControllerWithDb('../controllers/competitionsController', fakeDb);
  const req = {
    params: { competitionId: '7', teamId: '9' },
    user: { id: 1, username: 'admin', role: 'admin' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();

  await competitionsController.removeTeamFromCompetition(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Team removed from competition');
  assert.ok(queries.some((query) => /DELETE FROM team_entry_staff/i.test(query.sql)));
  assert.ok(queries.some((query) => /DELETE FROM team_entry_players/i.test(query.sql)));
  assert.ok(queries.some((query) => /DELETE FROM team_entries/i.test(query.sql)));
  assert.ok(queries.some((query) => /DELETE FROM team_competitions/i.test(query.sql)));
  assert.ok(queries.some((query) => /INSERT INTO audit_logs/i.test(query.sql)));
});

test('competitionsController.removeTeamFromCompetition blocks removal after matches exist', async () => {
  const fakeClient = {
    query: async (sql) => {
      if (/FROM team_entries te/i.test(sql)) {
        return { rows: [{ id: 41, team_id: 9, competition_id: 7 }] };
      }
      if (/FROM matches/i.test(sql)) return { rows: [{ id: 99 }] };
      return { rows: [], affectedRows: 1, rowCount: 1 };
    },
    release() {},
  };
  const fakeDb = { pool: { connect: async () => fakeClient } };
  const competitionsController = loadControllerWithDb('../controllers/competitionsController', fakeDb);
  const req = {
    params: { competitionId: '7', teamId: '9' },
    user: { id: 1, username: 'admin', role: 'admin' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createResponse();

  await competitionsController.removeTeamFromCompetition(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Cannot remove a team after matches have been generated for this registration');
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
