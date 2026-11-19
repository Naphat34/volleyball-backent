import test from 'node:test';
import assert from 'node:assert/strict';
import { accessCopy, translateAccess } from './accessCopy.js';
import { competitionGroupOptions, selectedCompetitionGroups, expandSelectedGroups } from '../competitionAccessGroups.js';

test('every access translation has an English value and matching parameter placeholders', () => {
    for (const [thai, english] of accessCopy) {
        assert.ok(thai && english);
        assert.doesNotMatch(english, /[ก-๙]/);
        assert.deepEqual(thai.match(/\{\d+\}/g), english.match(/\{\d+\}/g));
        assert.doesNotMatch(translateAccess(thai, 'ENG'), /[ก-๙]/);
    }
});
test('translated controls and notices switch both ways without translating names inside parameters', () => {
    assert.equal(translateAccess('สร้างบัญชี', 'ENG'), 'Create account');
    assert.equal(translateAccess('Account created.', 'THA'), 'สร้างบัญชีแล้ว');
    assert.equal(translateAccess('บันทึกสิทธิ์ {0}', 'ENG', ['ชื่อไทย']), 'Save access for ชื่อไทย');
    assert.equal(translateAccess('User not found', 'THA'), 'ไม่พบบัญชีผู้ใช้');
});
test('competition labels switch while selected group keys and granted IDs remain identical', () => {
    const rows = [1,2].map(id => ({id,access_group_key:'cup',title_th:'รายการไทย (ชาย)',title_en:'English Cup (Male)'}));
    const thai=competitionGroupOptions(rows,'THA'),english=competitionGroupOptions(rows,'ENG');
    assert.equal(thai[0].title,'รายการไทย');
    assert.equal(english[0].title,'English Cup');
    assert.deepEqual(selectedCompetitionGroups(thai,[1]),selectedCompetitionGroups(english,[1]));
    assert.deepEqual(expandSelectedGroups(english,['cup']),[1,2]);
});
