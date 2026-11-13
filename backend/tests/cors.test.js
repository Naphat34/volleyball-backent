const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const http = require('node:http');
const { createCorsOptions, getAllowedOrigins, rejectCrossOriginMutations } = require('../config/security');

const fetch = (url, options) => new Promise((resolve, reject) => {
  const req = http.request(url, options, (res) => {
    res.resume();
    res.on('end', () => resolve({
      status: res.statusCode,
      headers: { get: (name) => res.headers[name.toLowerCase()] },
    }));
  });
  req.on('error', reject);
  req.end();
});

test('Vercel login preflight and POST use the same trusted frontend origins', async (t) => {
  const previous = { ...process.env };
  process.env.NODE_ENV = 'production';
  process.env.CORS_ORIGINS = 'https://volleyball-94d.pages.dev/';
  process.env.FRONTEND_URL = 'https://volleyball-backent.vercel.app/';
  t.after(() => {
    for (const key of ['NODE_ENV', 'CORS_ORIGINS', 'FRONTEND_URL']) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  const app = express();
  app.use(cors(createCorsOptions()));
  app.use(rejectCrossOriginMutations);
  app.post('/api/auth/login', (req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
  const origin = 'https://volleyball-backent.vercel.app';
  const preflight = await fetch(url, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.match(preflight.headers.get('access-control-allow-headers'), /content-type/i);
  assert.equal((await fetch(url, { method: 'POST', headers: { Origin: origin } })).status, 200);
  createCorsOptions().origin('https://untrusted.vercel.app', (error) => {
    assert.match(error.message, /not allowed by CORS/);
  });

  delete process.env.CORS_ORIGINS;
  assert.deepEqual(getAllowedOrigins(), [origin]);
  delete process.env.FRONTEND_URL;
  assert.throws(getAllowedOrigins, /must be configured in production/);
});
