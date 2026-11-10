import test from 'node:test';
import assert from 'node:assert/strict';
import { translateVisUi, visUiEnglish } from './visUiTranslations.js';
import { describeVisEvent } from './visPresentation.js';
import { parseVisRally } from './visRally.js';

test('VIMS labels switch both ways and preserve whitespace, names and unknown values', () => {
    for (const [thai, english] of Object.entries(visUiEnglish)) {
        assert.equal(translateVisUi(thai, 'ENG'), english);
        assert.equal(translateVisUi(thai, 'THA'), thai);
        assert.ok(!/[\u0e00-\u0e7f]/.test(english), thai);
    }
    assert.equal(translateVisUi(' เซต ', 'ENG'), ' Set ');
    assert.equal(translateVisUi('ชื่อผู้เล่นที่ไม่ได้แปล', 'ENG'), 'ชื่อผู้เล่นที่ไม่ได้แปล');
});

test('history and code validation use the selected language without changing event codes', () => {
    const english = value => translateVisUi(value, 'ENG');
    assert.equal(describeVisEvent({skill:'TIMEOUT'}, [], english), 'Timeout');
    assert.equal(describeVisEvent({skill:'OP'}, [], english), 'Opponent error · Point won');
    const invalid = parseVisRally('invalid', {}, 'home', english);
    assert.ok(invalid.errors.length > 0);
    assert.ok(invalid.errors.every(error => !/[\u0e00-\u0e7f]/.test(error)));
    assert.ok(parseVisRally('invalid', {}, 'home').errors.some(error => /[\u0e00-\u0e7f]/.test(error)));
});
