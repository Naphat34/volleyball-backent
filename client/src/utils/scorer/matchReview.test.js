import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewMatch, flag, isLibero } from './matchReview.js';

const players = Array.from({ length: 6 }, (_, i) => ({ number: i + 1, first_name: `Player ${i}`, is_captain: i === 0 }));
const match = { id: 7, home_team_id: 1, away_team_id: 2, max_sets: 5, status: 'completed', manual_lifecycle: 'live', location: 'Court', match_date: '2026-11-05' };
const fixture = () => ({ matchId: 7, roster: { match, home: { players }, away: { players } },
    sheet: { match, sets: [1, 2, 3].map(set_number => ({ set_number, home_score: 25, away_score: 20, end_time: '2026-11-05T10:00:00Z' })) },
    manual: { match, config: { maxSets: 5, pointsPerSet: 25, decidingSetPoints: 15 } } });

test('completed manual match can be reviewed without falsely passing sync checks', () => {
    const result = reviewMatch(fixture());
    assert.equal(result.canConfirm, true); assert.equal(result.home, 3);
    assert.equal(result.checks.find(check => check.code === 'sync').status, 'unknown');
});
test('missing scoresheet or mismatched match IDs block confirmation', () => {
    assert.equal(reviewMatch({ ...fixture(), sheet: null }).canConfirm, false);
    assert.equal(reviewMatch({ ...fixture(), roster: { match: { id: 8 } } }).canConfirm, false);
});
test('official matches and confirmed manual matches cannot be confirmed from this panel', () => {
    assert.equal(reviewMatch({ ...fixture(), manual: null }).canConfirm, false);
    const data = fixture(); data.manual.match = { ...match, manual_lifecycle: 'confirmed' };
    assert.equal(reviewMatch(data).canConfirm, false);
});
test('reject unfinished, missing, negative and tied scores', () => {
    for (const change of [{ end_time: null }, { home_score: null }, { away_score: -1 }, { away_score: 25 }]) {
        const data = fixture(); Object.assign(data.sheet.sets[0], change);
        assert.equal(reviewMatch(data).canConfirm, false);
    }
});
test('reject extra sets after match victory and discontinuous numbering', () => {
    const data = fixture(); data.sheet.sets.push({ ...data.sheet.sets[0], set_number: 4 });
    assert.equal(reviewMatch(data).canConfirm, false);
    const gap = fixture(); gap.sheet.sets[1].set_number = 4;
    assert.equal(reviewMatch(gap).canConfirm, false);
});
test('custom best-of-three deciding set uses configured points', () => {
    const data = fixture(); data.manual.config = { maxSets: 3, pointsPerSet: 21, decidingSetPoints: 11 };
    data.sheet.sets = [
        { set_number: 1, home_score: 21, away_score: 10, end_time: 'done' },
        { set_number: 2, home_score: 10, away_score: 21, end_time: 'done' },
        { set_number: 3, home_score: 11, away_score: 9, end_time: 'done' },
    ];
    assert.equal(reviewMatch(data).canConfirm, true);
});
test('missing rosters are unchecked and duplicate shirt numbers are warnings', () => {
    const data = fixture(); data.roster.home = {};
    assert.equal(reviewMatch(data).checks.find(check => check.code === 'homeRoster').status, 'unknown');
    data.roster.home = { players: [players[0], ...players.slice(1).map(p => ({ ...p, number: 1 }))] };
    assert.equal(reviewMatch(data).checks.find(check => check.code === 'homeRoster').status, 'warning');
});
test('string zero flags are not treated as captains or liberos', () => {
    assert.equal(flag('0'), false); assert.equal(isLibero({ is_libero1: '0' }), false);
    assert.equal(isLibero({ is_libero2: '1' }), true);
});
