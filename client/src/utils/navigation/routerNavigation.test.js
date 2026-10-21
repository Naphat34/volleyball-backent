import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigateBrowser } from './routerNavigation.js';

function browserAt(path) {
    const browser = { location: new URL(path, 'http://localhost:5173'), calls: [] };
    browser.history = {
        state: null,
        pushState(state, _title, to) { this.state = state; browser.location = new URL(to, browser.location); browser.calls.push('push'); },
        replaceState(state, _title, to) { this.state = state; browser.location = new URL(to, browser.location); browser.calls.push('replace'); },
        go(delta) { browser.calls.push(delta); },
    };
    return browser;
}

test('repeated redirects to the current page do not write history or trigger rerenders', () => {
    const browser = browserAt('/login');
    for (let i = 0; i < 100; i++) assert.equal(navigateBrowser(browser, '/login', { replace: true }), false);
    assert.deepEqual(browser.calls, []);
    assert.equal(navigateBrowser(browser, '/adminvis'), true);
    assert.equal(navigateBrowser(browser, '/adminvis'), false);
    assert.deepEqual(browser.calls, ['push']);
});

test('query, hash and route-state changes still navigate normally', () => {
    const browser = browserAt('/adminvis');
    assert.equal(navigateBrowser(browser, '/adminvis?status=live', { replace: true }), true);
    assert.equal(navigateBrowser(browser, '/adminvis?status=live#matches'), true);
    const state = { matchId: 42 };
    assert.equal(navigateBrowser(browser, '/adminvis?status=live#matches', { state }), true);
    assert.equal(navigateBrowser(browser, '/adminvis?status=live#matches', { state }), false);
    assert.equal(browser.history.state.usr, state);
    assert.deepEqual(browser.calls, ['replace', 'push', 'push']);
});

test('back navigation waits for popstate without adding a history entry', () => {
    const browser = browserAt('/adminvis/match/42');
    assert.equal(navigateBrowser(browser, -1), false);
    assert.deepEqual(browser.calls, [-1]);
});
