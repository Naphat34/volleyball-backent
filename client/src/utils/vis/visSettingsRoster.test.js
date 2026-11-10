import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsPlayer,settingsPlayerDraft,coachingStaff} from './visSettingsRoster.js';
test('false flags do not become captains; L1/L2 and tactical positions round-trip through match settings',()=>{
    assert.equal(settingsPlayer({is_captain:'0',role:'OH'}).is_captain,false);
    assert.equal(settingsPlayer({is_captain:'false',role:'OH'}).is_captain,false);
    const p=settingsPlayer({id:1,number:7,first_name:'Name',last_name:'',role:'L2+C',position:'L'});
    assert.equal(p.is_libero2,true);assert.equal(p.is_captain,true);assert.equal(settingsPlayerDraft(p).role,'L2+C');
    assert.equal(settingsPlayer({role:'C',position:'C',playing_position:'S'}).position,'S');
});
test('coach and assistants come from staff roles instead of an absent match coach field',()=>{
    const staff=[{first_name:'Head',last_name:'One',role:'Head Coach'},{first_name:'Assistant',last_name:'One',role:'Assistant Coach'},{first_name:'Assistant',last_name:'Two',role:'Assistant Coach 2'},{first_name:'Manager',role:'Team Manager'}];
    assert.deepEqual(coachingStaff(staff,'Old coach'),{head:'Head One',assistants:['Assistant One','Assistant Two']});
    assert.deepEqual(coachingStaff([],'Legacy coach'),{head:'Legacy coach',assistants:[]});
    assert.deepEqual(coachingStaff([staff[1],staff[2]],'Unregistered head'),{head:'',assistants:['Assistant One','Assistant Two']});
});
