import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describeVisGrade, describeVisEvent, eventDetails, getVisEventCode } from './visPresentation.js';

const require = createRequire(import.meta.url);
const { rallyWinner } = require('../../../backend/utils/visWorkflow.js');

test('grade descriptions identify statistical outcomes without claiming to change official scores', () => {
    for (const skill of ['S', 'R', 'A', 'B', 'D', 'E']) for (const grade of ['#', '+', '!', '-', '=']) {
        const result = describeVisGrade(skill, grade);
        assert.equal(result.scoring, rallyWinner(skill, grade, 'home') !== null, `${skill}${grade}`);
        assert.ok(result.label);
        assert.match(result.impact, /ไม่เปลี่ยนคะแนนทางการ/);
    }
    assert.match(describeVisGrade('R', '#').label, /รับเสิร์ฟสมบูรณ์/);
    assert.match(describeVisGrade('R', '#').impact, /ไม่เปลี่ยนคะแนนทางการ/);
});
test('event and Undo labels include skill, grade and jersey number from restored IDs', () => {
    const event = { skill: 'A', grade: '#', player_id: '42' };
    assert.equal(describeVisEvent(event, [{ id: 42, number: 12 }]), 'ตบ (#) · #12');
    assert.equal(describeVisEvent(null), 'เตรียมเซตถัดไป');
    assert.equal(describeVisEvent({ skill: 'SANCTION', details: '{"card":"red"}' }), 'ใบแดง');
});
test('history accepts both live object details and persisted JSON without crashing on malformed JSON', () => {
    assert.deepEqual(eventDetails({ details: { playerOut: 1 } }), { playerOut: 1 });
    assert.deepEqual(eventDetails({ details: '{"playerOut":1}' }), { playerOut: 1 });
    assert.deepEqual(eventDetails({ details: 'invalid JSON' }), {});
});

test('history retains the recorded jersey code after roster numbers change', () => {
    const event = { skill: 'S', grade: '#', player_id: 42, details: '{"jersey_number":21,"event_code":"S21#"}' };
    assert.equal(getVisEventCode(event, [{ id: 42, number: 99 }]), 'S21#');
    assert.equal(describeVisEvent(event, [{ id: 42, number: 99 }]), 'เสิร์ฟ (#) · #21');
    assert.equal(getVisEventCode({ skill: 'S', grade: '#', player_id: 42 }, [{ id: 42, number: 21 }]), 'S21#');
    assert.equal(getVisEventCode({ skill: 'TIMEOUT', grade: null }), null);
});
