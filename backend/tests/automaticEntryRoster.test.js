const test = require('node:test');
const assert = require('node:assert/strict');
const { eligibility, rosterError, snapshot, restoreSnapshot, syncTeamEntries, refreshTeamEntries } = require('../utils/automaticEntryRoster');
const player = (id, patch = {}) => ({ id,team_id:1,first_name:`Player${id}`,last_name:'Test',gender:'Male',number:id,position:'OH',is_active:1,birth_date:'2010-01-01',...patch });
const entry = (id, patch = {}) => ({ id,team_id:1,competition_id:id,competition_title:'Event',competition_gender:'Male',competition_status:'open',age_group_name:'U18',start_date:'2027-01-01',today:'2026-11-11',max_players:14,...patch });
function store(entries, players, assigned = []) {
    const writes = [], saved = new Map();
    const query = async (sql, params) => {
        if (sql.includes('SELECT te.*')) return { rows: entries };
        if (sql.startsWith('SELECT * FROM players')) return { rows: players };
        if (sql.includes('SELECT ep.player_id')) return { rows: assigned };
        if (sql.startsWith('UPDATE team_entries SET roster_sync_error')) {
            const e = entries.find(e => e.id === params[2]);
            e.roster_sync_error = params[0]; e.roster_source_hash = params[1];
        }
        if (sql.includes('INSERT INTO team_entry_players')) {
            const rows = saved.get(params[0]) || []; rows.push(params); saved.set(params[0], rows);
        }
        if (/^(UPDATE|DELETE|INSERT)/.test(sql)) writes.push({sql,params});
        return { rows: [] };
    };
    return { query, writes, saved };
}
test('age/gender eligibility uses the start date, rejects missing/invalid birth dates and unknown categories', () => {
    assert.equal(eligibility(player(1), entry(1)),null);
    assert.equal(eligibility(player(1,{gender:'Female'}), entry(1)),'gender');
    assert.equal(eligibility(player(1,{is_active:0}), entry(1)),'inactive');
    assert.equal(eligibility(player(1,{birth_date:'2008-01-01'}), entry(1)), 'age');
    assert.equal(eligibility(player(1,{birth_date:'2009-01-01'}), entry(1)), null);
    assert.equal(eligibility(player(1,{birth_date:'2010-02-30'}), entry(1)),'birth_date');
    assert.equal(eligibility(player(1,{birth_date:null}), entry(1,{age_group_name:'Open'})),null);
    assert.equal(eligibility(player(1), entry(1,{age_group_name:'Unknown'})),'unknown_age_group');
});
test('sync copies active eligible athletes and snapshots, then skips unchanged master data', async () => {
    const h = store([entry(1)], [player(1),player(2,{gender:'Female'}),player(3,{is_active:0})]);
    await syncTeamEntries(h,1);
    assert.equal(h.saved.get(1).length,1);
    assert.equal(JSON.parse(h.saved.get(1)[0][8]).first_name,'Player1');
    const count = h.writes.length;
    await syncTeamEntries(h,1);
    assert.equal(h.writes.length,count,'reads must not overwrite match selections when the master is unchanged');
});
test('Live and completed rosters retain their snapshots', async () => {
    for (const patch of [{has_live_match:1},{roster_locked_at:'2026-11-01',has_completed_match:1}]) {
        const e = entry(1,patch), h = store([e],[player(1,{number:99})]);
        await syncTeamEntries(h,1);
        e.competition_status='open'; e.start_date='2027-01-01'; e.has_history=0;
        await syncTeamEntries(h,1);
        assert.equal(h.saved.size,0);
        assert.ok(!h.writes.some(w => w.sql.startsWith('DELETE')));
    }
});
test('multiple categories choose the youngest eligible category and retain existing locked assignments', async () => {
    const entries = [entry(1,{age_group_name:'U18'}), entry(2,{age_group_name:'U16'}),entry(3,{competition_title:'Other event'})];
    const h = store(entries,[player(1,{birth_date:'2011-01-01'})]);
    await syncTeamEntries(h,1);
    assert.equal(h.saved.has(1),false);
    assert.equal(h.saved.get(2)[0][1],1);
    assert.equal(h.saved.get(3)[0][1],1);
    const locked = store([entry(1,{roster_locked_at:'2026-01-01',has_completed_match:1}),entry(2,{age_group_name:'U16'})],[player(1)],[{player_id:1,team_entry_id:1}]);
    await syncTeamEntries(locked,1);
    assert.equal(locked.saved.size,0);
});
test('over-limit, duplicate numbers, invalid roles and missing dates produce visible errors without publishing a partial roster', async () => {
    assert.ok(rosterError([player(1),player(2)],entry(1,{max_players:1})));
    assert.ok(rosterError([player(1),player(2,{number:1})],entry(1)));
    assert.ok(rosterError([player(1,{is_captain:1}),player(2,{is_captain:1})],entry(1)));
    for (const players of [[player(1),player(2,{number:1})],[player(1,{birth_date:null})]]) {
        const e = entry(1),h=store([e],players);
        await syncTeamEntries(h,1);
        assert.ok(e.roster_sync_error); assert.equal(h.saved.size,0);
    }
});
test('display restores saved identity and retains entry numbers and captain flags, excluding private identifiers', () => {
    const saved = snapshot(player(1,{national_id:'private'}));
    const restored = restoreSnapshot({id:1,first_name:'Changed',entry_number:12,entry_is_captain:1,athlete_snapshot:saved});
    assert.equal(restored.first_name,'Player1');assert.equal(restored.entry_number,12);
    assert.equal(restored.entry_is_captain,1);assert.ok(!saved.includes('private'));
});
test('refresh commits atomically and rolls back on SQL failures', async () => {
    for (const fail of [false,true]) {
        const calls=[];
        const c={query:async()=>{if(fail)throw Error('SQL failed');return {rows:[]};},beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release')};
        const action=()=>refreshTeamEntries({connect:async()=>c},1);
        if(fail)await assert.rejects(action,/SQL failed/);else await action();
        assert.deepEqual(calls,['begin',fail?'rollback':'commit','release']);
    }
});

test('start date and match usage alone do not lock the competition roster', async () => {
    const e = entry(1, {start_date:'2026-11-11', has_history:1});
    const h = store([e], [player(1)]);
    await syncTeamEntries(h, 1);
    assert.equal(Boolean(e.roster_locked_at), false);
    assert.equal(h.saved.get(1).length, 1);
});

test('legacy locks clear before Live even when registration is closed', async () => {
    const e=entry(1,{competition_status:'closed',roster_locked_at:'2026-11-01',start_date:'2026-11-01'});
    const h=store([e],[player(1)]);
    await syncTeamEntries(h,1);
    assert.equal(e.roster_locked_at,null);
    assert.equal(h.saved.get(1).length,1);
});
