import test from 'node:test';
import assert from 'node:assert/strict';
import Swal from 'sweetalert2';
import scorerAlert from './scorerAlert.js';

// Capture the final options without opening a browser dialog.
Swal.fire = options => options;
await import('../i18n/alertLocale.js');

test('scorer alerts bypass global substring translation and preserve compact notifications', () => {
    globalThis.localStorage = { getItem: () => 'THA' };
    try {
        const options = scorerAlert.fire('บันทึกข้อมูลนักกีฬาเรียบร้อย', 'Team Save / Cancel', 'success');
        assert.equal(options.title, 'บันทึกข้อมูลนักกีฬาเรียบร้อย');
        assert.equal(options.text, 'Team Save / Cancel');
        assert.equal(options.confirmButtonText, 'ตกลง');
        assert.equal(options.toast, true);
        assert.equal(options.uiTextLocalized, undefined);
    } finally { delete globalThis.localStorage; }
});

test('explicit scorer confirmation keeps dialog behavior and English default buttons', () => {
    globalThis.localStorage = { getItem: () => 'ENG' };
    try {
        const options = scorerAlert.fire({ title: 'Confirm Undo?', text: 'ทีม Save', showCancelButton: true });
        assert.equal(options.title, 'Confirm Undo?');
        assert.equal(options.text, 'ทีม Save');
        assert.equal(options.confirmButtonText, 'OK');
        assert.equal(options.cancelButtonText, 'Cancel');
        assert.equal(options.toast, undefined);
        assert.equal(options.uiTextLocalized, undefined);
    } finally { delete globalThis.localStorage; }
});

test('other pages retain the existing global alert localization', () => {
    globalThis.localStorage = { getItem: () => 'THA' };
    try {
        const options = Swal.fire('Success', 'Failed to save', 'success');
        assert.equal(options.title, 'สำเร็จ');
        assert.equal(options.text, 'บันทึกไม่สำเร็จ');
        assert.equal(options.toast, true);
    } finally { delete globalThis.localStorage; }
});
