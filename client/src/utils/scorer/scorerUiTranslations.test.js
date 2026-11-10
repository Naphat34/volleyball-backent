import test from 'node:test';
import assert from 'node:assert/strict';
import { translateScorerUi as translate, translateScorerMarkup, formatScorerDateTime, formatScorerEventTime } from './scorerUiTranslations.js';
import { formatScorerEvent } from './scorerEventPresentation.js';

const t = language => (value, params) => translate(value, language, params);

test('scorer workflow, roster, sanctions, challenge and signature copy supports both languages', () => {
    for (const key of ['START MATCH', 'START NEXT SET', 'Player Out', 'Coin Toss Winner', 'Court Side Selection', 'Starting lineup', 'Match Officials & Setup', 'Penalty point', 'Video Challenge Confirmation', 'Save failed', 'OFFICIAL SIGNATURES', 'Clear Signature', 'Match history', 'Timeout request']) {
        assert.match(translate(key, 'THA'), /[ก-๙]/, key);
        assert.doesNotMatch(translate(key, 'ENG'), /[ก-๙]/, key);
    }
});

test('legacy mixed-language labels render as one selected language', () => {
    for (const key of ['บันทึกแล้ว / Saved', 'เชื่อมต่อเซิร์ฟเวอร์แล้ว / Live', 'FINAL MATCH SIGNATURES (ลงนามท้ายแมตช์)', '-- เลือกเจ้าหน้าที่ / Select --', 'Select Player Out (แถวหลัง)']) {
        assert.match(translate(key, 'THA'), /[ก-๙]/, key);
        assert.doesNotMatch(translate(key, 'ENG'), /[ก-๙]/, key);
    }
    assert.equal(translate('BALL_IN_OUT', 'THA'), 'บอลลงใน / ออก');
    assert.equal(translate('BALL_IN_OUT', 'ENG'), 'Ball In/Out');
});

test('interpolation preserves names, punctuation, braces and replacement characters', () => {
    const name = 'Save / ทีมไทย {$&} <Home>';
    assert.equal(translate('{0} won the toss.', 'THA', [name]), `${name} ชนะการเสี่ยงเหรียญ`);
    assert.equal(translate('ทีม {0} เปลี่ยนตัวไปแล้ว 7 ครั้ง (เหลือโควต้าอีก 1 ครั้ง)', 'ENG', [name]), `Team ${name} has used 7 substitutions (1 remaining).`);
    assert.equal(translate('Pending save ({0})', 'THA', [0]), 'รอบันทึก (0)');
});

test('HTML translation preserves attributes and interpolated data with shared placeholder indices', () => {
    const html = '<div class="Timeout"><span>WINS THE SET</span><b>{0}</b><i>Player n. {3} must replace the libero on the court</i><p>คะแนนปัจจุบัน: {1} - {2}</p></div>';
    const result = translateScorerMarkup(html, 'THA', ['Save', 10, 8, 7]);
    assert.match(result, /class="Timeout"/);
    assert.match(result, /<b>Save<\/b>/);
    assert.match(result, /ผู้เล่นหมายเลข 7 ต้องลงแทนลิเบอโรในสนาม/);
    assert.match(result, /คะแนนปัจจุบัน: 10 - 8/);
    assert.match(translateScorerMarkup(html, 'ENG', ['ทีมไทย', 10, 8, 7]), /<b>ทีมไทย<\/b>/);
});

test('unknown copy, data values and non-text React values are preserved', () => {
    const node = { type: 'div', props: { children: 'Name' } };
    assert.equal(translate(node, 'ENG'), node);
    for (const value of ['โรงเรียนทดสอบ', 'Bangkok VC', 'CHALLENGE_END', '12:30', null, 0, undefined]) assert.equal(translate(value, 'ENG'), value);
});

test('calendar display uses Buddhist years in Thai and Gregorian years in English', () => {
    const date = new Date(2026, 10, 9, 14, 30, 15);
    assert.match(formatScorerDateTime(date, 'THA'), /2569/);
    assert.match(formatScorerDateTime(date, 'ENG'), /2026/);
    assert.doesNotMatch(formatScorerDateTime(date, 'ENG'), /[ก-๙]/);
    assert.equal(formatScorerDateTime('invalid', 'ENG'), '-');
    const legacy = '9 พ.ย. 2569 เวลา 14:30:15 น.';
    assert.equal(formatScorerEventTime(legacy, 'THA'), legacy);
    assert.match(formatScorerEventTime(legacy, 'ENG'), /9 Nov 2026/);
    assert.equal(formatScorerEventTime('14:30', 'ENG'), '14:30');
});

test('history translates metadata without changing stored events or team codes', () => {
    const match = { teamHome: 'ทีม Save', teamAway: 'ทีมไทย', teamHomeCode: 'SAVE', teamAwayCode: 'THAI' };
    const event = { set: 2, description: 'Sub: IN #7 / OUT #1 (ทีม Save)', metadata: { type: 'SUBSTITUTION', teamCode: 'home', in: 7, out: 1 } };
    const original = structuredClone(event);
    assert.equal(formatScorerEvent(event, match, t('THA')), 'การเปลี่ยนตัว: เข้า #7 / ออก #1 (SAVE)');
    assert.equal(formatScorerEvent(event, match, t('ENG')), 'Substitution: IN #7 / OUT #1 (SAVE)');
    assert.deepEqual(event, original);
    assert.equal(formatScorerEvent({ set: 2, metadata: { type: 'SET_START' } }, match, t('THA')), 'เริ่มเซต 2');
    assert.equal(formatScorerEvent({ description: 'User-entered reason', metadata: { type: 'MANUAL_EDIT' } }, match, t('THA')), 'User-entered reason');
});

test('challenge history preserves the outcome, awarded team and reason', () => {
    const match = { teamHome: 'Home Team', teamHomeCode: 'HOME' };
    const event = { description: 'Challenge SUCCESSFUL: Point reverted to Home Team (Net touch)', metadata: { type: 'CHALLENGE_END', outcome: 'SUCCESSFUL' } };
    const result = formatScorerEvent(event, match, t('THA'));
    assert.match(result, /สำเร็จ/);
    assert.match(result, /HOME/);
    assert.match(result, /สัมผัสตาข่าย/);
});
