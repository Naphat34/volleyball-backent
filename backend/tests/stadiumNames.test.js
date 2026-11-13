const test = require('node:test');
const assert = require('node:assert/strict');
const { stadiumNames } = require('../utils/stadiumNames');

test('stadium names preserve both translations and support legacy clients', () => {
  assert.deepEqual(stadiumNames({ name_th: ' สนาม ', name_en: ' Arena ' }), {
    name: 'สนาม', name_th: 'สนาม', name_en: 'Arena',
  });
  assert.equal(stadiumNames({ name: 'Arena' }).name_en, 'Arena');
  assert.equal(stadiumNames({ name_en: 'New' }, { name_th: 'สนาม', name_en: 'Old' }).name_th, 'สนาม');
  assert.equal(stadiumNames({ name_th: '', name_en: 'Arena' }).name, 'Arena');
});

test('stadium names reject empty and invalid names', () => {
  for (const input of [{ name_th: ' ', name_en: '' }, { name_en: 42 }, { name_th: 'x'.repeat(256) }]) {
    assert.throws(() => stadiumNames(input), { status: 400 });
  }
});
