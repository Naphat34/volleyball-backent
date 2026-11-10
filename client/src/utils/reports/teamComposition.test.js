import test from 'node:test';
import assert from 'node:assert/strict';
import { compositionModel, personNames, birthDate } from './teamComposition.js';
test('registered bilingual names remain separate and missing English is not fabricated', () => {
  assert.equal(personNames({ first_name: 'สมชาย', last_name: 'ใจดี' }).en, '');
  assert.equal(personNames({ first_name: 'สมชาย', last_name: 'ใจดี', first_name_en: 'Somchai', last_name_en: 'Jaidee' }).en, 'Somchai Jaidee');
});
test('calendar ages, valid metrics and full-roster statistics survive pagination', () => {
  const model = compositionModel(Array.from({ length: 21 }, (_, i) => ({ number: i + 1, birthdate: '2004-12-31', height: i ? 180 : null, weight: 'invalid', is_captain: '0', is_libero1: '1', position: 'OPP' })), new Date('2026-11-04'));
  assert.deepEqual(model.pages.map(p => p.length), [20, 1]);
  assert.equal(model.rows[0].role, 'L');
  assert.equal(model.rows[0].position, 'OP');
  assert.equal(model.rows[0].age, 22);
  assert.deepEqual(model.stats[1], { key: 'height', min: 180, average: '180.0', max: 180 });
  assert.equal(model.stats[2].average, '-');
});
test('empty roster and invalid birthdates never produce invented data', () => {
  assert.deepEqual(compositionModel([]).pages, [[]]);
  assert.equal(birthDate('2026-02-30'), null);
  assert.equal(birthDate('0000-00-00'), null);
});
