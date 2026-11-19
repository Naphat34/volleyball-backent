import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureDate,fixtureTime} from './fixtureDates.js';
test('fixture calendar follows language and Bangkok day, preserving the original stored value',()=>{
    const value='2026-11-25';
    assert.equal(fixtureDate(value,'ENG'),'25/11/2026');
    assert.equal(fixtureDate(value,'THA'),'25/11/2569');
    assert.equal(fixtureDate('2026-11-24T18:00:00Z','ENG'),'25/11/2026');
    assert.equal(value,'2026-11-25');
    assert.equal(fixtureDate(null),'');
    assert.equal(fixtureDate('invalid'),'');
});
test('fixture times retain 24-hour clock and convert timestamp instants to Bangkok',()=>{
    assert.equal(fixtureTime('08:30:00'),'08:30');
    assert.equal(fixtureTime('2026-11-25T01:30:00Z'),'08:30');
    assert.equal(fixtureTime('invalid'),'');
});
