const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeRole, roleHasPermission } = require('../config/permissions');

test('legacy score role maps to scorer permissions', () => {
  assert.equal(normalizeRole('score'), 'scorer');
  assert.equal(roleHasPermission('score', 'match.score'), true);
});

test('organizer can manage competitions but cannot manage admin users', () => {
  assert.equal(roleHasPermission('organizer', 'competition.manage'), true);
  assert.equal(roleHasPermission('organizer', 'admin.manage'), false);
});

test('team staff can manage own team and request match changes only', () => {
  assert.equal(roleHasPermission('team_staff', 'team.self.manage'), true);
  assert.equal(roleHasPermission('team_staff', 'match.request'), true);
  assert.equal(roleHasPermission('team_staff', 'match.score'), false);
  assert.equal(roleHasPermission('team_staff', 'team.manage'), false);
});
