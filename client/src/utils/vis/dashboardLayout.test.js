import { visCompetitionName, visCompetitionKey } from './dashboardLayout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupVisMatches, visMatchSortValue, visMatchGender } from './dashboardLayout.js';

test('grouped page preserves row order and reports counts across all filtered pages', () => {
    const matches = [
        { id: 1, competition_id: 10, competition_name: 'Youth Cup' },
        { id: 2, competition_id: 20, competition_name: 'Youth Cup' },
        { id: 3, competition_id: 10, competition_name: 'Youth Cup' },
        { id: 4, competition_id: 10, competition_name: 'Youth Cup' },
    ];
    const groups = groupVisMatches(matches.slice(0, 3), matches);
    assert.deepEqual(groups.map(group => [group.total, group.matches.map(match => match.id)]), [[3, [1, 3]], [1, [2]]]);
});

test('custom and official competitions remain separate and untitled matches have a fallback', () => {
    const groups = groupVisMatches([{ id: 'a', competition_name: 'Cup' }, { id: 'b', competition_name: 'Cup', is_custom_vis: true }, { id: 'c' }]);
    assert.equal(groups.length, 3);
    assert.equal(groups[2].title, 'VIMS');
    assert.deepEqual(groupVisMatches([]), []);
});

test('number sorting is numeric and match dates include scheduled time', () => {
    const rows = [{ match_number: 10 }, { match_number: 2 }];
    rows.sort((a, b) => String(visMatchSortValue(a, 'number')).localeCompare(String(visMatchSortValue(b, 'number')), 'en', { numeric: true }));
    assert.equal(rows[0].match_number, 2);
    assert.equal(visMatchSortValue({ match_date: '2026-10-25', start_time: '09:00:00' }, 'date'), '2026-10-25 09:00:00');
    assert.equal(visMatchSortValue({}, 'time'), '');
});

test('competition selector combines gender divisions while retaining the competition title', () => {
    assert.equal(visCompetitionName('Youth Cup (Male)'), 'Youth Cup');
    assert.equal(visCompetitionName('Youth Cup (Female)'), 'Youth Cup');
    assert.equal(visCompetitionKey('Youth Cup (Male)'), visCompetitionKey('Youth Cup (Female)'));
    assert.equal(visCompetitionName('Youth Cup (U15)'), 'Youth Cup (U15)');
    assert.notEqual(visCompetitionKey('Youth Cup'), visCompetitionKey('Senior Cup'));
});
test('VIMS can combine gender categories by title, preserving match order and page totals',()=>{
    const rows=[{id:1,competition_id:10,competition_name:'Cup (Male)',gender:'Male',match_number:1},{id:2,competition_id:20,competition_name:'Cup (Female)',gender:'Female',match_number:2},{id:3,competition_id:10,competition_name:'Cup (Male)',gender:'Male',match_number:3}];
    const groups=groupVisMatches(rows.slice(0,2),rows,{combineByName:true});
    assert.equal(groups.length,1);assert.equal(groups[0].title,'Cup');assert.equal(groups[0].total,3);
    assert.deepEqual(groups[0].matches.map(match=>match.match_number),[1,2]);
    const female=rows.filter(match=>visMatchGender(match)==='Female');
    assert.deepEqual(female.map(match=>match.id),[2]);
    assert.equal(groupVisMatches(female,female,{combineByName:true})[0].total,1);
    assert.equal(groupVisMatches([...rows,{id:4,competition_name:'Other Cup'},{id:5,competition_name:'Cup',is_custom_vis:true}],undefined,{combineByName:true}).length,3);
    assert.equal(visMatchGender({gender:'FEMALE'}),'Female');
    assert.equal(visMatchGender({competition_gender:'ชาย'}),'Male');
});
