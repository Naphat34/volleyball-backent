import test from 'node:test';
import assert from 'node:assert/strict';
import { competitionName, competitionGroupName, localizedReference } from './competitionNames.js';
test('names switch without modifying identity, categories or registered titles', () => {
    const record = { id: 7, title: 'เดิม', title_th: 'ชิงแชมป์', title_en: 'Championship', short_title_en: 'CHAMP', gender: 'Male' };
    const before = structuredClone(record);
    assert.equal(competitionName(record, 'TH'), 'ชิงแชมป์');
    assert.equal(competitionName(record, 'EN'), 'Championship');
    assert.equal(competitionName(record, 'ENG', true), 'CHAMP');
    assert.deepEqual(record, before);
});
test('joined match aliases and old single-language names remain readable', () => {
    assert.equal(competitionName(null, 'ENG'), '');
    assert.equal(localizedReference(null, 'THA'), '');
    assert.equal(competitionName({ competition_name: 'เดิม', competition_name_en: 'League' }, 'ENG'), 'League');
    assert.equal(competitionName({ title: 'Legacy' }, 'THA'), 'Legacy');
    assert.equal(competitionName({ title_th: 'ไทยเท่านั้น' }, 'ENG'), 'ไทยเท่านั้น');
    assert.equal(localizedReference({ name: 'ประชาชน' }, 'ENG'), 'Open');
});
test('group labels change language without changing the legacy selection key', () => {
    const key = 'ลีกเดิม';
    const records = [{ id: 1, title: `${key} (Male)`, title_th: 'ลีกภาษาไทย', title_en: 'English League' }];
    assert.equal(competitionGroupName(key, records, 'ENG'), 'English League');
    assert.equal(competitionGroupName(key, records, 'THA'), 'ลีกภาษาไทย');
    assert.equal(key, 'ลีกเดิม');
    assert.equal(competitionGroupName('Unknown', records, 'ENG'), 'Unknown');
});
