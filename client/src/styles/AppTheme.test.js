import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';

const css = postcss.parse(fs.readFileSync(new URL('./AppTheme.css', import.meta.url), 'utf8'));
function palette(selector) {
    const values = {};
    css.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => { values[decl.prop] = decl.value; }); });
    return values;
}
function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test('body, secondary text, form hints, and statuses are readable in both palettes', () => {
    for (const selector of [':root, html[data-app-theme="light"]', 'html[data-app-theme="dark"]']) {
        const colors = palette(selector);
        for (const text of ['--app-text', '--app-muted', '--app-soft']) {
            for (const surface of ['--app-page', '--app-surface', '--app-surface-alt']) assert.ok(contrast(colors[text], colors[surface]) >= 4.5, `${selector}: ${text} on ${surface}`);
        }
        for (const status of ['info', 'success', 'warning', 'danger', 'purple']) assert.ok(contrast(colors[`--app-${status}-text`], colors[`--app-${status}-bg`]) >= 4.5, `${selector}: ${status}`);
    }
});

test('generated theme compatibility is valid CSS and shields print and fixed team colors', () => {
    const source = fs.readFileSync(new URL('./AppThemeUtilities.css', import.meta.url), 'utf8');
    const generated = postcss.parse(source);
    let count = 0;
    generated.walkRules(rule => { count++; assert.ok(rule.selector.includes('[data-theme-paper]') && rule.selector.includes('[data-theme-fixed]')); });
    assert.ok(count > 100);
});
