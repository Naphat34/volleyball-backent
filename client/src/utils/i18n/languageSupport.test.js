import test from 'node:test';
import assert from 'node:assert/strict';
import { personName, personNameParts, teamName, editablePersonNames } from './names.js';
import { normalizeLanguage } from './language.js';
import { translateUi, translateUiMarkup } from './uiTranslations.js';

const player = { id: 7, number: 28, first_name: 'ธนวัฒ', last_name: 'บริสุทธิ์', first_name_th: 'ธนวัฒ', last_name_th: 'บริสุทธิ์', first_name_en: 'Registered', last_name_en: 'Athlete', role: 'C' };

test('names select registered language without changing roster identities or stored names', () => {
    const original = structuredClone(player);
    assert.equal(personName(player, 'THA'), 'ธนวัฒ บริสุทธิ์');
    assert.equal(personName(player, 'ENG'), 'Registered Athlete');
    assert.deepEqual(personNameParts(player, 'EN'), { first: 'Registered', last: 'Athlete', full: 'Registered Athlete' });
    assert.deepEqual(player, original);
    assert.equal(teamName({ name: 'เดิม', name_th: 'ทีมไทย', name_en: 'Registered Club' }, 'ENG'), 'Registered Club');
});

test('fallback keeps legacy records readable and never mixes name languages', () => {
    assert.equal(personName({ ...player, first_name_en: 'English', last_name_en: '' }, 'ENG'), 'English');
    assert.equal(personName({ first_name: 'ชื่อเดิม', last_name: 'นามสกุลเดิม' }, 'ENG'), 'ชื่อเดิม นามสกุลเดิม');
    assert.equal(personName({ first_name_en: 'Only', last_name_en: 'English' }, 'THA'), 'Only English');
    assert.equal(personName({ name_en: 'Full Registered Name', first_name: 'เดิม' }, 'ENG'), 'Full Registered Name');
    assert.equal(personName(null, 'ENG'), '');
    assert.equal(personName({ firstname: 'Legacy', lastname: 'Alias' }, 'ENG'), 'Legacy Alias');
});

test('name editor preserves existing translations and assigns legacy text only to its original script', () => {
    const fields = editablePersonNames(player);
    assert.equal(fields.first_name_en, 'Registered');
    assert.equal(fields.last_name_th, 'บริสุทธิ์');
    assert.deepEqual(editablePersonNames({ first_name: 'Jane', last_name: 'Doe' }), { first_name_th: '', last_name_th: '', first_name_en: 'Jane', last_name_en: 'Doe' });
});

test('language aliases normalize consistently across app and exported documents', () => {
    for (const value of ['TH', 'THA', 'THAI', 'ไทย', null]) assert.equal(normalizeLanguage(value), 'THA');
    for (const value of ['en', 'ENG', 'English']) assert.equal(normalizeLanguage(value), 'ENG');
});

test('lineup screenshot labels and application areas have Thai and English copy', () => {
    for (const text of ['Starting lineup','Set roster','Shirt color','Approvals - Roster','Captain','Coach','Clear Lineup','Cancel','Save','Accounts Management','Match Management','Team Captain','First name (Thai)','First name (English)','Bilingual names','Download and reserve match offline','Select Type of Request']) {
        assert.match(translateUi(text, 'THA'), /[ก-๙]/, text);
        assert.doesNotMatch(translateUi(text, 'ENG'), /[ก-๙]/, text);
    }
});

test('templates translate before inserting athlete names and codes', () => {
    const name = 'Save / Cancel ทีมไทย {$&}';
    assert.equal(translateUi('{0} Coach', 'THA', [name]), `ผู้ฝึกสอนทีม ${name}`);
    assert.equal(translateUi('เลือก {0}', 'ENG', [name]), `Select ${name}`);
    assert.equal(translateUi('Court position P{0}', 'THA', [4]), 'ตำแหน่งในสนาม P4');
    assert.equal(translateUi('{0}', 'THA', [name]), name);
    assert.equal(translateUi('Starting lineup', 'THAI'), 'รายชื่อผู้เล่นตัวจริง');
    assert.equal(translateUi('C', 'THA'), 'C');
    assert.equal(translateUi('L2', 'ENG'), 'L2');
});

test('HTML and unknown server copy preserve attributes and user data', () => {
    const result = translateUiMarkup('<b class="Save">Starting lineup</b><p>{0}</p>', 'THA', ['Save ทีมไทย']);
    assert.equal(result, '<b class="Save">รายชื่อผู้เล่นตัวจริง</b><p>Save ทีมไทย</p>');
    assert.equal(translateUi('Unknown server detail: Team Save', 'THA'), 'Unknown server detail: Team Save');
});
