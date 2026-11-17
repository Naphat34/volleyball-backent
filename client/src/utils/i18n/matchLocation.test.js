import test from 'node:test';
import assert from 'node:assert/strict';
import { matchLocation } from './competitionNames.js';

test('match venue follows selected language and preserves free text or missing translations', () => {
    const match = { location: 'สนามไทย', location_th: 'สนามไทย', location_en: 'English Gymnasium' };
    assert.equal(matchLocation(match,'ENG'),'English Gymnasium');
    assert.equal(matchLocation(match,'EN'),'English Gymnasium');
    assert.equal(matchLocation(match,'THA'),'สนามไทย');
    assert.equal(matchLocation({location:'Court B'},'ENG'),'Court B');
    assert.equal(matchLocation({location:'สนามไทย',location_en:'   '},'ENG'),'สนามไทย');
    assert.equal(matchLocation(null,'ENG'),'');
});
