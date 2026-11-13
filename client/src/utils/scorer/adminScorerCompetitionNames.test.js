import test from 'node:test';
import assert from 'node:assert/strict';
import { adminScorerMatchTitle } from './adminScorerCompetitionNames.js';
import { mergeRefereeMatches, writeDashboardCache, readDashboardCache } from '../../offline/scorerDashboardCache.js';
import { IDBFactory } from 'fake-indexeddb';
const competition = { id: 7, title: 'ชื่อเดิม', title_th: 'รายการภาษาไทย', title_en: 'English Championship' };

test('AdminScorer switches live and legacy cached match titles using the active language', () => {
    const match = { id: 42, competition_id: 7, competition_name: 'ชื่อเดิม' };
    assert.equal(adminScorerMatchTitle(match, [competition], 'ENG'), 'English Championship');
    assert.equal(adminScorerMatchTitle(match, [competition], 'THA'), 'รายการภาษาไทย');
    assert.equal(adminScorerMatchTitle({ ...match, is_manual_scorer: true, competition_name: 'My custom match' }, [competition], 'ENG'), 'My custom match');
    assert.equal(adminScorerMatchTitle({ competition_name: 'Legacy only' }, [], 'ENG'), 'Legacy only');
});
test('referee refresh and persisted dashboard cache retain both languages across reload', async () => {
    globalThis.indexedDB = new IDBFactory();
    const merged = mergeRefereeMatches([competition], [{ status: 'fulfilled', value: { data: [{ id: 42 }] } }], [], () => 'รายการภาษาไทย');
    await writeDashboardCache(7, 'referee', 'server', { matches: merged.matches, competitions: [competition] });
    const cached = await readDashboardCache(7, 'referee', 'server');
    assert.equal(adminScorerMatchTitle(cached.matches[0], [], 'ENG'), 'English Championship');
    assert.equal(adminScorerMatchTitle(cached.matches[0], cached.competitions, 'THA'), 'รายการภาษาไทย');
    assert.equal(cached.competitions[0].title_en, 'English Championship');
});
