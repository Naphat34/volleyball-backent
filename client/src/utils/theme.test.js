import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readThemePreference, resolveTheme, themeStorageKey } from './theme.js';
import fs from 'node:fs';
import vm from 'node:vm';

test('one saved preference overrides device settings and migrates existing console preferences', () => {
    const storage = values => ({ getItem: key => values[key] ?? null });
    assert.equal(readThemePreference(storage({ [themeStorageKey]: 'dark', 'volley-vis-theme': 'light' })), 'dark');
    assert.equal(readThemePreference(storage({ 'volley-vis-theme': 'light' })), 'light');
    assert.equal(readThemePreference(storage({ 'volley-admin-theme': 'dark' })), 'dark');
    assert.equal(readThemePreference(storage({ 'volley-admin-vims-theme': 'dark' })), 'dark');
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
});

test('first paint uses the same preference and device fallback as the React provider', () => {
    const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    for (const preference of [null, 'dark', 'light']) {
        for (const systemDark of [false, true]) {
            const root = { dataset: {}, style: {}, classList: { toggle(name, value) { root[name] = value; } } };
            vm.runInNewContext(bootstrap, { localStorage: { getItem: key => key === themeStorageKey ? preference : null }, window: { matchMedia: () => ({ matches: systemDark }) }, document: { documentElement: root } });
            const expected = resolveTheme(preference, systemDark);
            assert.equal(root.dataset.appTheme, expected);
            assert.equal(root.dataset.visTheme, expected);
            assert.equal(root.style.colorScheme, expected);
            assert.equal(root.dark, expected === 'dark');
        }
    }
});

test('no preference or unavailable storage follows the device without preventing rendering', () => {
    assert.equal(readThemePreference({ getItem() { throw Error('Storage disabled'); } }), null);
    assert.equal(readThemePreference({ getItem() { return 'invalid'; } }), null);
    assert.equal(resolveTheme(null, true), 'dark');
    assert.equal(resolveTheme(null, false), 'light');
});
