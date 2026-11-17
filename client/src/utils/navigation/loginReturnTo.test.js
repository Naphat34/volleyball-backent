import test from 'node:test';
import assert from 'node:assert/strict';
import {loginReturnTo} from './loginReturnTo.js';
const search=path=>'?returnTo='+encodeURIComponent(path);
const admin={role:'super_admin_scorer'};
test('allowlisted role destinations retain tab, page and fragment',()=>{
    for(const path of ['/admin-matches/06012119-33ce-4572-ae3b-8fcb00aa022b?tab=history&page=2#review','/admin-matches/06012119-33ce-4572-ae3b-8fcb00aa022b?tab=history','/scorer-admin?view=matches'])assert.equal(loginReturnTo(search(path),admin),path);
    assert.equal(loginReturnTo(search('/admin?tab=teams'),{role:'admin'}),'/admin?tab=teams');
    assert.equal(loginReturnTo(search('/admin-matches/06012119-33ce-4572-ae3b-8fcb00aa022b?tab=history'),{role:'organizer'}),'/admin-matches/06012119-33ce-4572-ae3b-8fcb00aa022b?tab=history');
});
test('external, ambiguous, malformed and wrong-role destinations never become login redirects',()=>{
    for(const path of ['https://evil.test','//evil.test','/\\evil.test','/%2f%2fevil.test','/admin-matches/../admin','/admin-matches/1oops','/admin-matches/1\n','/login?returnTo=/admin','/unknown','/admin','/scorer/1'])assert.equal(loginReturnTo(search(path),admin),null,path);
    assert.equal(loginReturnTo(search('/admin-matches/1'),{role:'scorer'}),null);
    assert.equal(loginReturnTo(search('/admin-matches/1'),null),null);
});
