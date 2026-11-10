import test from 'node:test';
import assert from 'node:assert/strict';
import { getScorerTeamName, getScorerTeamNameFields } from './scorerTeamNames.js';

const apiMatch = {
    home_team_name_th: 'โรงเรียนสันติธรรมวิทยานุกูลนิธิ',
    home_team_name_en: 'Registered Home School',
    away_team_name_th: 'โรงเรียนวัดบ้านนา',
    away_team_name_en: 'Registered Away School',
};

test('both teams select their registered names independently of court side', () => {
    const match = { teamHome: apiMatch.home_team_name_th, teamAway: apiMatch.away_team_name_th, ...getScorerTeamNameFields(apiMatch) };
    const original = structuredClone(match);
    for (const side of ['home', 'away']) {
        assert.equal(getScorerTeamName(match, side, 'THA'), apiMatch[`${side}_team_name_th`]);
        assert.equal(getScorerTeamName(match, side, 'ENG'), apiMatch[`${side}_team_name_en`]);
    }
    assert.deepEqual(match, original);
});

test('bilingual names survive cached match serialization and older API responses', () => {
    const cached = JSON.parse(JSON.stringify(getScorerTeamNameFields(apiMatch)));
    const restored = getScorerTeamNameFields({}, cached);
    assert.equal(getScorerTeamName(restored, 'home', 'ENG'), apiMatch.home_team_name_en);
    assert.equal(getScorerTeamName(restored, 'away', 'THA'), apiMatch.away_team_name_th);
    assert.deepEqual(getScorerTeamNameFields(cached), cached);
    assert.equal(getScorerTeamName(apiMatch, 'away', 'ENG'), apiMatch.away_team_name_en);
});

test('missing localized names fall back to original names without inventing translations', () => {
    assert.equal(getScorerTeamName({ teamHome: 'ชื่อเดิม', teamHomeNameEn: '  ' }, 'home', 'ENG'), 'ชื่อเดิม');
    assert.equal(getScorerTeamName({ teamAwayNameEn: 'Away Club' }, 'away', 'THA'), 'Away Club');
    assert.equal(getScorerTeamName({}, 'home', 'ENG'), 'HOME');
    assert.equal(getScorerTeamName({}, 'away', 'THA'), 'AWAY');
});

test('explicitly cleared API names replace stale cached translations', () => {
    const fields = getScorerTeamNameFields({ home_team_name_en: null, away_team_name_en: '' }, getScorerTeamNameFields(apiMatch));
    assert.equal(fields.teamHomeNameEn, null);
    assert.equal(fields.teamAwayNameEn, '');
    assert.equal(getScorerTeamName(fields, 'home', 'ENG'), apiMatch.home_team_name_th);
});
