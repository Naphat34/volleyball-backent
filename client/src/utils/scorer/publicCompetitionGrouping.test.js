import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPublicCompetitions, findCompetitionGroupById } from './publicCompetitionGrouping.js';

test('one event option retains all age groups and genders for filtering', () => {
  const records = [
    { id: 11, title: 'Championship (Male)', title_th: 'ชิงแชมป์', title_en: 'Championship', gender: 'Male', age_group_name: 'U15' },
    { id: 12, title: 'Championship (Female)', title_th: 'ชิงแชมป์', title_en: 'Championship', gender: 'Female', age_group_name: 'U15' },
    { id: 13, title: 'ชิงแชมป์', title_th: 'ชิงแชมป์', title_en: 'Championship', gender: 'Male', age_group_name: 'U18' },
    { id: 14, title: 'Another event', gender: 'Male', age_group_name: 'U15' },
  ];
  const thai = groupPublicCompetitions(records, 'THA');
  const english = groupPublicCompetitions(records, 'ENG');
  assert.equal(thai.length, 2);
  const group = findCompetitionGroupById(thai, 11);
  assert.deepEqual(group.items.map(item => item.id).sort(), [11, 12, 13]);
  assert.equal(findCompetitionGroupById(english, 12).title, 'Championship');
  assert.equal(findCompetitionGroupById(english, 12).key, group.key);
});

test('legacy gender suffixes, case and repeated whitespace do not create duplicate event options', () => {
  const groups = groupPublicCompetitions([{ id: 1, title: 'Youth   Cup (Male)' }, { id: 2, title: 'youth Cup (Female)' }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 2);
});
