const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeRole, roleHasPermission } = require('../config/permissions');

test('legacy score role maps to scorer permissions', () => {
  assert.equal(normalizeRole('score'), 'scorer');
  assert.equal(roleHasPermission('score', 'match.score'), true);
});

test('statisticians have statistics-only permission without score recording', () => {
  assert.equal(normalizeRole('statistician'), 'vims_operator');
  assert.equal(roleHasPermission('statistician', 'match.score'), false)
  assert.equal(roleHasPermission('statistician','vims.record'),true);
  assert.equal(roleHasPermission('statistician', 'competition.manage'), false);
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

test('admin retains management and reports but cannot record', () => {
 assert.equal(roleHasPermission('admin', 'match.score'), false);
 for (const permission of ['admin.manage', 'competition.manage', 'team.manage', 'match.manage', 'report.export', 'socket.monitor']) assert.equal(roleHasPermission('admin', permission), true);
});
