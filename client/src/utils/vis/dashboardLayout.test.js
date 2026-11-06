import test from 'node:test';
import assert from 'node:assert/strict';
import { groupVisMatches, visMatchSortValue } from './dashboardLayout.js';

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
    assert.equal(groups[2].title, 'VIS');
    assert.deepEqual(groupVisMatches([]), []);
});

test('number sorting is numeric and match dates include scheduled time', () => {
    const rows = [{ match_number: 10 }, { match_number: 2 }];
    rows.sort((a, b) => String(visMatchSortValue(a, 'number')).localeCompare(String(visMatchSortValue(b, 'number')), 'en', { numeric: true }));
    assert.equal(rows[0].match_number, 2);
    assert.equal(visMatchSortValue({ match_date: '2026-10-25', start_time: '09:00:00' }, 'date'), '2026-10-25 09:00:00');
    assert.equal(visMatchSortValue({}, 'time'), '');
});
