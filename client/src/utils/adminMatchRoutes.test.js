import test from 'node:test';
import assert from 'node:assert/strict';
import {adminMatchPath,authorizedAdminMatchLocation} from './adminMatchRoutes.js';
const publicId='d0fe5e9a-165c-4f20-badc-122233334444';
test('new admin links require UUIDs and never fall back to numeric identifiers',()=>{
    assert.equal(adminMatchPath(publicId),`/admin-matches/${publicId}`);
    for(const id of [1,'1',null,undefined,'../1','bad'])assert.equal(adminMatchPath(id),null);
});
test('integer detail links are not redirected; UUID normalization preserves query and hash',()=>{
    const location={pathname:'/admin-matches/1',search:'?tab=history&page=2',hash:'#review'};
    assert.equal(authorizedAdminMatchLocation({id:1,public_id:publicId},location),null);
    assert.deepEqual(authorizedAdminMatchLocation({id:1,public_id:publicId},{...location,pathname:`/admin-matches/${publicId.toUpperCase()}`}),{...location,pathname:`/admin-matches/${publicId}`});
    assert.equal(authorizedAdminMatchLocation(null,location),null);
    assert.equal(authorizedAdminMatchLocation({id:1},location),null);
    assert.equal(authorizedAdminMatchLocation({id:2,public_id:publicId},location),null);
    assert.equal(authorizedAdminMatchLocation({public_id:publicId},{...location,pathname:`/admin-matches/${publicId}`}),null);
});
