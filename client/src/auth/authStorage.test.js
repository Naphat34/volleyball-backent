import test from 'node:test';
import assert from 'node:assert/strict';
import { getOfflineUser, offlineProfileMatchesUser } from '../offline/offlineAuth.js';
import {
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  setAuthSession,
  adoptOfflineIdentity,
  getAuthSessionVersion,
} from './authStorage.js';

const createStorage = () => {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
};

test.beforeEach(() => {
  globalThis.localStorage = createStorage();
  globalThis.sessionStorage = createStorage();
});

test('setAuthSession stores auth data in sessionStorage only', () => {
  setAuthSession({
    token: 'session-token',
    user: { id: 1, username: 'admin', role: 'admin' },
  });

  assert.equal(sessionStorage.getItem('token'), 'session-token');
  assert.equal(localStorage.getItem('token'), null);
  assert.deepEqual(getStoredUser(), { id: 1, username: 'admin', role: 'admin' });
});

test('login to another account clears the unlocked grant while retaining the encrypted offline profile', () => {
  const profile = '{"userId":7,"user":"vis","encrypted":"keep-backup"}';
  localStorage.setItem('vis_offline_profile_v1', profile);
  sessionStorage.setItem('vis_offline_unlocked_v1', JSON.stringify({ user: { id: 7, role: 'statistician' }, expiresAt: Date.now() + 60000 }));
  setAuthSession({ token: 'scorer-token', user: { id: 8, username: 'scorer', role: 'scorer' } });
  assert.equal(getOfflineUser({ readOnly: true }), null);
  assert.equal(localStorage.getItem('vis_offline_profile_v1'), profile);
  assert.equal(getStoredUser().id, 8);
  assert.equal(getAuthToken(), 'scorer-token');
});

test('profile ownership follows user ID rather than names or roles', () => {
  assert.equal(offlineProfileMatchesUser({ userId: '7', user: 'old' }, { id: 7, username: 'renamed' }), true);
  assert.equal(offlineProfileMatchesUser({ userId: 7, user: 'scorer' }, { id: 8, username: 'scorer' }), false);
  assert.equal(offlineProfileMatchesUser({ user: 'scorer' }, { id: 8, username: 'scorer' }), false);
});

test('a new login and logout each advance the in-memory session even for the same user', () => {
  const before = getAuthSessionVersion();
  setAuthSession({ token: 'one', user: { id: 7 } });
  const first = getAuthSessionVersion(); assert.ok(first > before);
  setAuthSession({ token: 'two', user: { id: 7 } }); assert.ok(getAuthSessionVersion() > first);
  const second = getAuthSessionVersion(); clearAuthSession(); assert.ok(getAuthSessionVersion() > second);
});

test('PIN identity discards another online account and preserves the unlocked grant', () => {
  setAuthSession({ token: 'other-token', user: { id: 2 } });
  sessionStorage.setItem('vis_offline_unlocked_v1', '{"user":{"id":1}}');
  adoptOfflineIdentity({ id: 1 });
  assert.equal(getAuthToken(), null);
  assert.equal(sessionStorage.getItem('user'), null);
  assert.ok(sessionStorage.getItem('vis_offline_unlocked_v1'));
});

test('PIN identity retains the same account online session', () => {
  setAuthSession({ token: 'same-token', user: { id: 1 } });
  adoptOfflineIdentity({ id: '1' });
  assert.equal(getAuthToken(), 'same-token');
});

test('getAuthToken migrates legacy localStorage token to sessionStorage', () => {
  localStorage.setItem('token', 'legacy-token');

  assert.equal(getAuthToken(), 'legacy-token');
  assert.equal(sessionStorage.getItem('token'), 'legacy-token');
  assert.equal(localStorage.getItem('token'), null);
});

test('clearAuthSession removes auth data from both storage locations', () => {
  sessionStorage.setItem('token', 'session-token');
  sessionStorage.setItem('user', '{"id":1}');
  localStorage.setItem('token', 'legacy-token');
  localStorage.setItem('user', '{"id":2}');

  clearAuthSession();

  assert.equal(sessionStorage.getItem('token'), null);
  assert.equal(sessionStorage.getItem('user'), null);
  assert.equal(localStorage.getItem('token'), null);
  assert.equal(localStorage.getItem('user'), null);
});
