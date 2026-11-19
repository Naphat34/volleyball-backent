import test from 'node:test';
import assert from 'node:assert/strict';
import {vimsReviewStage,vimsPlayerTotals,vimsMayRecord} from './reviewCenter.js';
test('review stage and recording actions respect review locks, ownership and statistics',()=>{
    const match={id:1,kind:'match',competition_id:1,status:'completed',vims_count:5};
    assert.equal(vimsReviewStage(match,[]),'ready');
    for(const status of ['submitted','confirmed'])assert.equal(vimsReviewStage({...match,vims_review_status:status},[]),status);
    assert.equal(vimsReviewStage(match,[{match_id:1,domain:'vims',revision:1,status:'returned'}]),'returned');
    assert.equal(vimsReviewStage({...match,status:'scheduled',vims_count:0},[]),'idle');
    assert.equal(vimsMayRecord({...match,manual_owner_id:2},{id:1},[]),false);
    assert.equal(vimsMayRecord({...match,manual_owner_id:2,manual_vis_shared:1,manual_vis_assignee_id:1},{id:1},[]),true);
    assert.equal(vimsMayRecord({...match,vims_review_status:'confirmed'},{id:1},[]),false);
    assert.equal(vimsReviewStage({...match,status:'cancelled'},[]),'cancelled');
    assert.equal(vimsMayRecord({...match,status:'cancelled'},{id:1},[]),false);
    assert.equal(vimsMayRecord({...match,home_team_id:null},{id:1},[]),false);
});
test('team totals use all aggregate rows rather than the visible event page; opponent errors add no points',()=>{
    const stats=[{set_number:1,team:'home',player_id:1,skill:'A',grade:'#',count:12},{set_number:2,team:'home',player_id:1,skill:'S',grade:'#',count:2},{set_number:1,team:'home',player_id:1,skill:'OP',grade:'#',count:8}];
    assert.deepEqual(vimsPlayerTotals(stats),[{team:'home',player_id:1,attack:12,block:0,ace:2,attempts:22}]);
    assert.equal(vimsPlayerTotals(stats,'1')[0].ace,0);
});
