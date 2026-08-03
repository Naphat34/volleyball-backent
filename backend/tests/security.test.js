const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_JWT_SECRET,
  createCorsOptions,
  getAuthCookieOptions,
  getJwtSecret,
} = require('../config/security');

const withEnv = (values, fn) => {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  try {
    return fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
};

test('getJwtSecret rejects missing or default production secrets', () => {
  withEnv({ NODE_ENV: 'production', JWT_SECRET: undefined }, () => {
    assert.throws(() => getJwtSecret(), /JWT_SECRET must be set/);
  });

  withEnv({ NODE_ENV: 'production', JWT_SECRET: DEFAULT_JWT_SECRET }, () => {
    assert.throws(() => getJwtSecret(), /JWT_SECRET must be set/);
  });
});

test('createCorsOptions allows configured production origins only', async () => {
  const options = withEnv({
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://example.com,https://admin.example.com',
  }, () => createCorsOptions());

  await new Promise((resolve, reject) => {
    options.origin('https://example.com', (err, allowed) => {
      try {
        assert.ifError(err);
        assert.equal(allowed, true);
        resolve();
      } catch (assertErr) {
        reject(assertErr);
      }
    });
  });

  await new Promise((resolve) => {
    options.origin('https://evil.example', (err) => {
      assert.match(err.message, /not allowed by CORS/);
      resolve();
    });
  });
});

test('auth cookie defaults are httpOnly, secure, and same-site in production', () => {
  const options = withEnv({ NODE_ENV: 'production' }, () => getAuthCookieOptions());
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
});
