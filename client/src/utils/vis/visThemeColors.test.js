import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, visTeamPalette } from './visThemeColors.js';

test('team text remains readable on both scorer surfaces and tinted player cards', () => {
    for (const theme of ['light', 'dark']) {
        for (const color of ['#905cff', '#397fff', '#6366f1', '#f43f5e', '#000000', '#ffffff', '#ffff00', '#00ff00', '#ff0000', '#0000ff']) {
            const palette = visTeamPalette(color, theme);
            assert.ok(contrastRatio(palette.ink, theme === 'dark' ? '#172231' : '#ffffff') >= 4.5, `${theme} ${color} text`);
            assert.ok(contrastRatio(palette.cardInk, palette.card) >= 4.5, `${theme} ${color} card`);
        }
    }
});

test('contrast calculation includes known black/white endpoints and invalid-color fallback', () => {
    assert.equal(contrastRatio('#000000', '#ffffff'), 21);
    assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
    assert.deepEqual(visTeamPalette(undefined, 'light'), visTeamPalette('#397fff', 'light'));
});
