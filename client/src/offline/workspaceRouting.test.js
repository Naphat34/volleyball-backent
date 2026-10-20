import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceIntent, loginPath, loginSearch, canEnterWorkspace } from './workspaceRouting.js';

test('separate login pages enforce their workspace and keep only matching match returns', () => {
    assert.equal(workspaceIntent(loginSearch('?returnTo=/scorer/42', 'vis')).workspace, 'vis');
    assert.equal(workspaceIntent(loginSearch('?returnTo=/scorer/42', 'vis')).destination, null);
    assert.equal(workspaceIntent(loginSearch('?returnTo=/scorer/42&reauth=1', 'scorer')).destination, '/scorer/42');
    assert.equal(new URLSearchParams(loginSearch('?reauth=1', 'vis')).get('reauth'), '1');
    assert.equal(loginPath('/adminvis/match/local-123'), '/vis/login');
    assert.equal(loginPath('/scorer/42'), '/scorer/login');
    assert.equal(loginPath('/adminscorer'), '/scorer/login');
    assert.equal(loginPath('/admin'), '/login');
    assert.equal(canEnterWorkspace({ role: 'scorer' }, 'vis', false), false);
    assert.equal(canEnterWorkspace({ role: 'referee' }, 'scorer', false), true);
    assert.equal(canEnterWorkspace({ role: 'referee' }, 'scorer', true), false);
});

test('return targets reject external URLs, viewers and extra query strings', () => {
    for (const target of ['https://evil.test', '//evil.test', '/scorer/42/viewer', '/admin', '/scorer/42?x=1']) {
        assert.equal(workspaceIntent(`?returnTo=${encodeURIComponent(target)}`).destination, null);
    }
});
