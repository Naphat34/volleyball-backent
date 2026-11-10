import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rosterVerificationModel, rosterBirthDate, rosterRole } from './rosterVerification.js';
import { personName } from '../i18n/names.js';

test('verification uses only selected match players and keeps match numbers and role flags', () => {
    const data = { match: { id: 42 }, home: { players: [{ id: 7, number: 28, role: '', is_captain: 0, is_libero1: 0 }],
        availablePlayers: [{ id: 7, number: 3, role: 'L1+C', first_name_en: 'Registered', last_name_en: 'Athlete', nationality: 'THA', birth_date: '2004-03-08' },
            { id: 8, number: 4, first_name_en: 'Not selected' }], staff: [{ first_name: 'Match coach', role: 'Head Coach' }] },
        away: { players: [{ id: 12, number: 12 }, { id: 11, number: 2 }], staff: [] } };
    const original = structuredClone(data), report = rosterVerificationModel(data);
    assert.equal(report.home.players.length, 1);
    assert.equal(report.home.players[0].number, 28);
    assert.equal(rosterRole(report.home.players[0]), '');
    assert.equal(personName(report.home.players[0], 'ENG'), 'Registered Athlete');
    assert.equal(report.home.players[0].nationality, 'THA');
    assert.equal(rosterBirthDate(report.home.players[0]), '08/03/2004');
    assert.deepEqual(report.away.players.map(player => player.id), [11, 12]);
    assert.deepEqual(report.home.staff, data.home.staff);
    assert.deepEqual(data, original);
});

test('birth dates use Gregorian calendar dates without timezone shifts or invalid-date rollover', () => {
    assert.equal(rosterBirthDate({ birth_date: '2004-03-08T00:00:00.000Z' }), '08/03/2004');
    assert.equal(rosterBirthDate({ dob: '2004-02-29' }), '29/02/2004');
    for (const value of ['2003-02-29', '2004-13-01', 'invalid', null]) assert.equal(rosterBirthDate({ birth_date: value }), '');
});

test('captain/libero tags interpret explicit boolean flags and combined match roles', () => {
    assert.equal(rosterRole({ is_captain: '0', is_libero1: '0', is_libero2: '0' }), '');
    assert.equal(rosterRole({ role: 'L2+C' }), 'C, L2');
    assert.equal(rosterRole({ is_captain: 1, position: 'L' }), 'C, L');
});

test('malformed responses fail instead of showing an apparently empty verification sheet', () => {
    for (const data of [null, {}, { match: {}, home: { players: [] }, away: { players: [] } }]) {
        assert.throws(() => rosterVerificationModel(data), /roster could not be loaded/);
    }
});
