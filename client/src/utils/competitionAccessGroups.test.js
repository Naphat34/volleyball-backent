import test from 'node:test';
import assert from 'node:assert/strict';
import {competitionGroupOptions,selectedCompetitionGroups,expandSelectedGroups} from './competitionAccessGroups.js';
import {workspaceSummary} from './adminWorkspace.js';
test('one visible name selects all permitted category IDs and filters both genders',()=>{
    const rows=[{id:1,access_group_key:'cup',access_group_title:'Cup'},{id:2,access_group_key:'cup',access_group_title:'Cup'},{id:3,title:'Other'}];
    const groups=competitionGroupOptions(rows);assert.equal(groups.length,2);assert.equal(groups[0].title,'Cup');
    assert.deepEqual(expandSelectedGroups(groups,['cup']),[1,2]);assert.deepEqual(selectedCompetitionGroups(groups,[1,2]),['cup']);
    assert.deepEqual(selectedCompetitionGroups(groups,'1'),['cup']);
    assert.deepEqual(expandSelectedGroups(competitionGroupOptions(rows.slice(0,1)),['cup']),[1]);
    const summary=workspaceSummary([],[{competition_id:1},{competition_id:2},{competition_id:3}],[{competition_ids:[2]},{competition_ids:[3]}],[1,2]);
    assert.equal(summary.matches,2);assert.equal(summary.users,1);
});
