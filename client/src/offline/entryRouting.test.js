import test from 'node:test';
import assert from 'node:assert/strict';
import { loginIntent, canEnterSection, roleHome } from './entryRouting.js';

test('one login accepts only internal destinations and enforces role permissions', () => {
    assert.deepEqual(loginIntent('?returnTo=/adminvis/match/06012119-33ce-4572-ae3b-8fcb00aa022b'), { section: 'vis', destination: '/adminvis/match/06012119-33ce-4572-ae3b-8fcb00aa022b' });
    assert.deepEqual(loginIntent('?returnTo=/scorer/06012119-33ce-4572-ae3b-8fcb00aa022b&reauth=1'), { section: 'scorer', destination: '/scorer/06012119-33ce-4572-ae3b-8fcb00aa022b' });
    assert.equal(loginIntent('?returnTo=/scorer-offline').section, 'scorer');
    assert.equal(loginIntent('?section=vis').section, null);
    assert.equal(canEnterSection({ role: 'scorer' }, 'vis', false), false);
    assert.equal(canEnterSection({ role: 'referee' }, 'scorer', false), true);
    assert.equal(canEnterSection({ role: 'referee' }, 'scorer', true), false);
});

test('each role opens its dashboard directly online and its match list offline', () => {
    for (const [role, online, offline] of [['admin', '/admin', '/admin'], ['statistician', '/adminvis', '/adminvis'], ['score', '/adminscorer', '/scorer-offline'], ['scorer', '/adminscorer', '/scorer-offline']]) {
        assert.equal(roleHome({ role }), online);
        assert.equal(roleHome({ role }, true), offline);
    }
    assert.equal(roleHome({ role: 'referee' }), '/adminscorer');
    assert.equal(roleHome({ role: 'team', team_id: 7 }), '/team-dashboard');
    assert.equal(roleHome({ role: 'team' }), '/create-team');
});

test('return targets reject external URLs, viewers and extra query strings', () => {
    for (const target of ['https://evil.test', '//evil.test', '/scorer/06012119-33ce-4572-ae3b-8fcb00aa022b/viewer', '/admin', '/scorer/06012119-33ce-4572-ae3b-8fcb00aa022b?x=1']) {
        assert.equal(loginIntent(`?returnTo=${encodeURIComponent(target)}`).destination, null);
    }
});

test('administrators cannot enter recording sections online or offline', () => {
 for (const role of ['admin','super_admin','super_admin_scorer','super_admin_vims'])for (const offline of [false, true]) for (const section of ['vis', 'scorer']) assert.equal(canEnterSection({role}, section, offline), false);
});

test('statistics users cannot switch into scoring and domain administrators have their own home',()=>{
    for(const role of ['statistician','vims_operator'])assert.equal(canEnterSection({role},'scorer',false),false);
    for(const [role,home]of [['super_admin_scorer','/scorer-admin'],['super_admin_vims','/vims-admin'],['organizer','/access-center']])assert.equal(roleHome({role}),home);
});
