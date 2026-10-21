import test from 'node:test';
import assert from 'node:assert/strict';
import { loginIntent, canEnterSection, roleHome } from './entryRouting.js';

test('one login accepts only internal destinations and enforces role permissions', () => {
    assert.deepEqual(loginIntent('?returnTo=/adminvis/match/local-123'), { section: 'vis', destination: '/adminvis/match/local-123' });
    assert.deepEqual(loginIntent('?returnTo=/scorer/42&reauth=1'), { section: 'scorer', destination: '/scorer/42' });
    assert.equal(loginIntent('?returnTo=/scorer-offline').section, 'scorer');
    assert.equal(loginIntent('?section=vis').section, null);
    assert.equal(canEnterSection({ role: 'scorer' }, 'vis', false), false);
    assert.equal(canEnterSection({ role: 'referee' }, 'scorer', false), true);
    assert.equal(canEnterSection({ role: 'referee' }, 'scorer', true), false);
});

test('each role opens its dashboard directly online and its match list offline', () => {
    for (const [role, online, offline] of [['admin', '/admin', '/adminvis'], ['statistician', '/adminvis', '/adminvis'], ['score', '/adminscorer', '/scorer-offline'], ['scorer', '/adminscorer', '/scorer-offline']]) {
        assert.equal(roleHome({ role }), online);
        assert.equal(roleHome({ role }, true), offline);
    }
    assert.equal(roleHome({ role: 'referee' }), '/adminscorer');
    assert.equal(roleHome({ role: 'team', team_id: 7 }), '/team-dashboard');
    assert.equal(roleHome({ role: 'team' }), '/create-team');
});

test('return targets reject external URLs, viewers and extra query strings', () => {
    for (const target of ['https://evil.test', '//evil.test', '/scorer/42/viewer', '/admin', '/scorer/42?x=1']) {
        assert.equal(loginIntent(`?returnTo=${encodeURIComponent(target)}`).destination, null);
    }
});
