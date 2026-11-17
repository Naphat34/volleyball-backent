import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceFor, latestReviews, workspaceSummary } from './adminWorkspace.js';
import { roleHome } from '../offline/entryRouting.js';

test('administration homes are separate from recording consoles and ambiguous roles are rejected',()=>{
    const homes=['super_admin','super_admin_scorer','super_admin_vims'].map(role=>workspaceFor(role).home);
    assert.equal(new Set(homes).size,3);
    for(const role of ['super_admin','super_admin_scorer','super_admin_vims'])assert.equal(roleHome({role}),workspaceFor(role).home);
    for(const role of ['scorer','vims_operator','constructor','__proto__',undefined])assert.equal(workspaceFor(role),null);
    assert.equal(workspaceFor('organizer').home,roleHome({role:'organizer'}));
    assert.equal(workspaceFor('organizer').label,'Organizer');
});
test('latest review queues distinguish domains and custom matches without recounting old revisions',()=>{
    const rows=[{id:1,match_id:7,domain:'score',revision:1,status:'submitted',competition_id:1},
        {id:2,match_id:7,domain:'score',revision:2,status:'confirmed',competition_id:1},
        {id:3,match_id:7,domain:'vims',revision:1,status:'submitted',competition_id:1},
        {id:4,custom_match_id:'7',domain:'vims',revision:1,status:'returned',competition_id:1},
        {id:5,match_id:8,domain:'score',revision:1,status:'submitted',competition_id:2}];
    assert.deepEqual(latestReviews(rows).map(row=>row.id),[2,3,4,5]);
    assert.deepEqual(workspaceSummary(rows,[{competition_id:1},{competition_id:2}], [{competition_ids:[1,2]},{competition_ids:[2]}],'1'),
        {matches:1,submitted:1,confirmed:1,returned:1,users:1});
    assert.equal(rows.length,5,'history remains intact');
});
