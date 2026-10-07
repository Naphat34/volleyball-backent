const test = require('node:test');
const assert = require('node:assert/strict');

const rateLimit = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');

const createResponse = () => {
  const response = {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return response;
};

test('validateRequest rejects invalid login payloads', () => {
  const middleware = validateRequest('login');
  const req = { body: { username: '', password: '' } };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Username is required');
});

test('validateRequest accepts valid match result payloads', () => {
  const middleware = validateRequest('updateMatchResult');
  const req = {
    body: {
      home_set_score: 3,
      away_set_score: 1,
      status: 'completed',
      set_scores: '["25-20","25-22","23-25","25-18"]',
    },
  };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('validateRequest accepts array match result payloads', () => {
  const middleware = validateRequest('updateMatchResult');
  const req = {
    body: {
      home_set_score: 2,
      away_set_score: 0,
      status: 'completed',
      set_scores: ['25-20', '25-22'],
    },
  };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('validateRequest rejects tied set scores', () => {
  const middleware = validateRequest('updateMatchResult');
  const req = {
    body: {
      home_set_score: 1,
      away_set_score: 0,
      status: 'completed',
      set_scores: ['25-25'],
    },
  };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Set scores cannot be tied');
});

test('validateRequest rejects VIS stats without a player', () => {
  const middleware = validateRequest('scorerEvent');
  const req = {
    body: {
      set_number: 1,
      event_type: 'VIS_STAT',
      team_id: 2,
      skill: 'A',
      grade: '#',
      score_home: 4,
      score_away: 3,
    },
  };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Player is required for VIS stats');
});

test('validateRequest accepts canonical VIS stat payloads', () => {
  const middleware = validateRequest('scorerEvent');
  const req = {
    body: {
      set_number: 1,
      event_type: 'VIS_STAT',
      team_id: 2,
      player_id: 9,
      skill: 'A',
      grade: '#',
      score_home: 4,
      score_away: 3,
    },
  };
  const res = createResponse();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('rateLimit returns 429 after the configured limit', () => {
  const middleware = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: `test-${Date.now()}` });
  const req = {
    headers: {},
    ip: '203.0.113.10',
    socket: { remoteAddress: '203.0.113.10' },
  };

  const firstRes = createResponse();
  let firstNextCalled = false;
  middleware(req, firstRes, () => {
    firstNextCalled = true;
  });

  const secondRes = createResponse();
  let secondNextCalled = false;
  middleware(req, secondRes, () => {
    secondNextCalled = true;
  });

  assert.equal(firstNextCalled, true);
  assert.equal(secondNextCalled, false);
  assert.equal(secondRes.statusCode, 429);
  assert.equal(secondRes.body.error, 'Too many requests. Please try again later.');
});
