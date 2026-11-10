import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionPlayers, compositionStaff, compositionRosterReady } from './compositionRoster.js';
import { compositionModel } from './teamComposition.js';
const competition = { team_entry_id: 42, gender: 'Male' };
test('entry selection overrides master numbers, specialty and explicit role zeroes without duplicate athletes', () => {
  const player = { id: 1, selected: 1, number: 3, entry_number: 28, position: 'L', entry_role: 'OPP', is_captain: 1, entry_is_captain: 0, is_libero1: 1, entry_is_libero1: 0, entry_is_libero2: 0, height_cm: 187, weight: 80, birth_date: '2004-03-08' };
  const players = compositionPlayers(competition, { players: [player, player, { id: 2, selected: 0 }] });
  assert.equal(players.length, 1);
  const model = compositionModel(players, new Date('2026-11-09'));
  assert.equal(model.rows[0].number, 28);
  assert.equal(model.rows[0].position, 'OP');
  assert.equal(model.rows[0].role, '');
  assert.equal(model.rows[0].height, 187);
  assert.equal(model.rows[0].birth, '08-Mar-2004');
});
test('libero captain combinations come from entry roles and flags', () => {
  const players = compositionPlayers(competition, { players: [{ id: 1, selected: 1, entry_role: 'L2+C', position: 'OH' }] });
  assert.equal(compositionModel(players).rows[0].role, 'C L');
  assert.equal(players[0].position, 'L');
});
test('empty or unavailable entry roster never falls back to all team members', () => {
  const master = [{ id: 1, gender: 'Male' }];
  assert.deepEqual(compositionPlayers(competition, undefined, master), []);
  assert.deepEqual(compositionPlayers(competition, { players: [] }, master), []);
  assert.deepEqual(compositionStaff(competition, { staff: [] }, master), []);
  assert.equal(compositionRosterReady(competition, { players: [] }), false);
  assert.equal(compositionRosterReady(competition, { players: [], staff: [] }), true);
});
test('officials are selected for the exact entry instead of the full team or another gender', () => {
  const coach = { id: 1, selected: '1', role: 'Head Coach', first_name: 'ผู้ฝึกสอน' };
  const roster = { staff: [coach, coach, { id: 2, selected: 0, role: 'Doctor' }] };
  assert.deepEqual(compositionStaff(competition, roster, [{ id: 3 }]), [coach]);
});
