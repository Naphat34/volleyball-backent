import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMatchSettings, matchCategoryLabel } from './matchSettings.js';
const draft = () => ({ title: 'Cup', home: { name: 'Home', players: [{ first_name: 'A', number: 1, role: 'C' }], staff: [] }, away: { name: 'Away', players: [], staff: [] }, referee_1_id: '', referee_2_id: '', ...Object.fromEntries([1,2,3,4].map(n => [`line_judge_${n}_id`, ''])) });

test('category descriptions resolve IDs to age-group names and follow the selected group', () => {
    const groups = [{ id: 7, name: 'U18' }, { id: 8, name: 'Open' }];
    assert.equal(matchCategoryLabel({ category: 7 }, groups), 'U18');
    assert.equal(matchCategoryLabel({ category: 7, age_group_id: '8' }, groups), 'Open');
    assert.equal(matchCategoryLabel({ category: 7, age_group_id: '' }, groups, 'Not specified'), 'Not specified');
    assert.equal(matchCategoryLabel({ age_group_id: 999 }, groups, 'Not specified'), 'Not specified');
});
test('valid match settings do not require unassigned optional officials', () => assert.deepEqual(validateMatchSettings(draft()), []));
test('validation identifies the tabs containing duplicate shirts, staff omissions and referee conflicts', () => {
    const value = draft();
    value.home.players.push({ first_name: 'B', number: '1', role: '' });
    value.away.staff.push({ first_name: '', role: 'coach' });
    value.referee_1_id = 2; value.referee_2_id = '2';
    assert.deepEqual(validateMatchSettings(value).map(e => e.tab), ['roster', 'staff', 'officials']);
});
