const test = require('node:test');
const assert = require('node:assert/strict');
const { competitionInput } = require('../utils/competitionInput');
const input = { title_th: 'ชิงแชมป์จังหวัด', title_en: 'Provincial Championship', start_date: '2026-12-01', end_date: '2026-12-10', stadium_id: 1,
    categories: [{ age_group_id: 1, gender: 'Male' }, { age_group_id: 2, gender: 'Female', max_sets: 5 }], max_sets: 3, max_players: 14 };
test('explicit matrix preserves exact selected pairs and category-specific rules', () => {
    const result = competitionInput(input);
    assert.equal(result.title, input.title_th);
    assert.equal(result.title_en, input.title_en);
    assert.equal(result.categories.length, 2);
    assert.equal(result.categories[1].max_sets, 5);
    assert.equal(result.categories[0].max_sets, 3);
});
test('publication requires names, valid dates and venue; invalid categories fail with 400', () => {
    for (const patch of [{ title_en: '' }, { start_date: '2026-02-30' }, { start_date: '2026-99-99' }, { end_date: '2026-01-01' }, { stadium_id: '' }, { categories: [] }, { categories: [null] }, { categories: [{ age_group_id: 1, gender: 'unexpected' }] }, { categories: [input.categories[0], input.categories[0]] }, { max_sets: 2 }, { max_players: 0 }]) {
        assert.throws(() => competitionInput({ ...input, ...patch }), error => error.status === 400);
    }
});
test('legacy clients can rename without overwriting the other translation or metadata', () => {
    const result = competitionInput({ title: 'ชื่อใหม่', age_group_id: 1, gender: 'Male' }, { title_th: 'ชื่อเก่า', title_en: 'Original', short_title_en: 'ORG' });
    assert.equal(result.title, 'ชื่อใหม่');
    assert.equal(result.title_th, 'ชื่อใหม่');
    assert.equal(result.title_en, 'Original');
    assert.equal(result.short_title_en, 'ORG');
});
test('legacy Cartesian payload is normalized for existing clients', () => {
    assert.equal(competitionInput({ title: 'Legacy', age_group_ids: [1, 2], gender: 'Male,Female' }).categories.length, 4);
});
