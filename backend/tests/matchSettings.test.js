const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { normalizeTeam, applyMatchSetup, setupPlayers, setupStaff } = require('../utils/matchSetup');
const player = { id: 1, number: 7, first_name: 'Player', last_name: '', role: 'C', position: 'S' };
const team = { name: 'Home', code: 'H', players: [player], staff: [] };

test('roster validation rejects foreign players, duplicate numbers and invalid roles', () => {
    assert.throws(() => normalizeTeam(team, new Set([2])), /นักกีฬา/);
    assert.throws(() => normalizeTeam({ ...team, players: [player, { ...player, id: 2 }] }, new Set([1,2])), /ซ้ำ/);
    assert.throws(() => normalizeTeam({ ...team, players: [{ ...player, role: 'INVALID' }] }, new Set([1])), /ตำแหน่ง/);
    const normalized = normalizeTeam(team, new Set([1]));
    assert.equal(normalized.players[0].position, 'S');
    assert.equal(normalized.players[0].is_captain, 1);
});

test('match overrides preserve identities, isolate names and allow an explicitly empty roster', () => {
    const setup = { title: 'Local title', gender: 'Mixed', maxSets: 3, pointsPerSet: 25, decidingSetPoints: 15, home: { ...team, players: [] }, away: { ...team, name: 'Away' } };
    const match = applyMatchSetup({ home_team_id: 10, away_team_id: 20, match_setup: JSON.stringify(setup) });
    assert.equal(match.home_team_id, 10);
    assert.equal(match.home_team, 'Home');
    assert.equal(match.max_sets, 3);
    assert.deepEqual(setupPlayers(match, 'home', [player]), []);
    assert.deepEqual(setupStaff(match, 'home', [{ first_name: 'Old' }]), []);
    assert.deepEqual(setupPlayers({}, 'home', [player]), [player]);
});

function fixture(overrides = {}) {
    const match = { id: 42, home_team_id: 10, away_team_id: 20, home_team_name: 'Home', away_team_name: 'Away', home_team_code: 'H', away_team_code: 'A', competition_title: 'Cup', max_sets: 5, status: 'scheduled', match_setup_revision: 0, ...overrides };
    const data = { match, home: { players: [player], availablePlayers: [player], staff: [] }, away: { players: [{ ...player, id: 2 }], availablePlayers: [{ ...player, id: 2 }], staff: [] } };
    const state = { updates: [], commits: 0, rollbacks: 0, lease: null, failAudit: false };
    const connection = {
        async query(sql, args) {
            if (sql.startsWith('UPDATE')) { state.updates.push({ sql, args }); return { rows: [] }; }
            if (sql.includes('scorer_offline_sessions')) return { rows: state.lease ? [state.lease] : [] };
            if (sql.includes('FROM matches')) return { rows: [match] };
            return { rows: [] };
        },
        async beginTransaction() {}, async commit() { state.commits++; }, async rollback() { state.rollbacks++; }, release() {}
    };
    const filename = require.resolve('../controllers/matchSettingsController');
    const localRequire = createRequire(filename);
    const scope = { exports: {}, console: { error() {} }, require: name => {
        if (name === '../config/db') return { ...connection, connect: async () => connection };
        if (name === './scorerOfflineController') return { scopedController: () => ({}), call: async () => structuredClone(data) };
        if (name === './officialVisOfflineController') return { assertOnline: async () => {} };
        if (name === '../utils/auditLogger') return { writeAuditLog: async () => { if (state.failAudit) throw Error('audit failed'); } };
        return localRequire(name);
    }};
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), scope, { filename });
    const req = { params: { matchId: 42 }, user: { id: 8, role: 'scorer' }, app: { get: () => null }, body: {} };
    const response = () => ({ code: 200, set() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; } });
    return { controller: scope.exports, req, response, state, data };
}
async function prepare(f) {
    const previousCommits = f.state.commits;
    const res = f.response(); await f.controller.read(f.req, res);
    assert.equal(res.code, 200);
    assert.equal(f.state.commits, previousCommits + 1, 'the read snapshot owns and commits its transaction');
    f.state.commits = 0;
    f.state.rollbacks = 0;
    f.req.body = { revision: res.data.revision, fingerprint: res.data.fingerprint, draft: res.data.draft };
    return res.data;
}
test('save commits all four sections together without changing team registrations', async () => {
    const f = fixture(); await prepare(f);
    f.req.body.draft.home.staff.push({ first_name: 'Coach', last_name: '', role: 'coach' });
    f.req.body.draft.location = 'Court B';
    const res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 200);
    assert.equal(f.state.commits, 1);
    assert.equal(f.state.updates.length, 1);
    assert.match(f.state.updates[0].sql, /^UPDATE matches/);
    const setup = JSON.parse(f.state.updates[0].args.at(-2));
    assert.equal(setup.home.staff[0].first_name, 'Coach');
});

test('athlete edits retain bilingual names and roles without updating master registrations', async () => {
    const f = fixture(); await prepare(f);
    Object.assign(f.req.body.draft.home.players[0], { number: 12, first_name: 'ชื่อใหม่', first_name_th: 'ชื่อใหม่', first_name_en: 'New name', last_name_en: 'Surname', role: 'L2+C', position: 'L' });
    const res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 200);
    assert.equal(f.state.updates.length, 1);
    assert.match(f.state.updates[0].sql, /^UPDATE matches/);
    const setup = JSON.parse(f.state.updates[0].args.at(-2));
    const edited = setup.home.players[0];
    assert.equal(edited.id, player.id);
    assert.equal(edited.number, 12);
    assert.equal(edited.first_name_th, 'ชื่อใหม่');
    assert.equal(edited.first_name_en, 'New name');
    assert.equal(edited.last_name_en, 'Surname');
    assert.equal(edited.role, 'L2+C');
    assert.equal(edited.is_captain, 1);
    assert.equal(edited.is_libero2, 1);
    assert.equal(f.data.home.players[0].number, 7);
});

test('shirt colors persist per match and are restored when settings reopen', async () => {
    const f = fixture(); await prepare(f);
    f.req.body.draft.home.color = '#AABBCC';
    f.req.body.draft.away.color = '#123456';
    f.req.body.draft.home.liberoColor = '#FFCC00';
    f.req.body.draft.away.liberoColor = '#00CCFF';
    const res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 200);
    const setup = JSON.parse(f.state.updates[0].args.at(-2));
    assert.equal(setup.home.color, '#aabbcc');
    assert.equal(setup.away.color, '#123456');
    assert.equal(setup.home.liberoColor, '#ffcc00');
    assert.equal(setup.away.liberoColor, '#00ccff');
    f.data.match.match_setup = JSON.stringify(setup);
    const reopened = await prepare(f);
    assert.equal(reopened.draft.home.color, '#aabbcc');
    assert.equal(reopened.draft.away.color, '#123456');
    assert.equal(reopened.draft.home.liberoColor, '#ffcc00');
    assert.equal(reopened.draft.away.liberoColor, '#00ccff');
    assert.equal(applyMatchSetup({ match_setup: JSON.stringify(setup) }).home_team_color, '#aabbcc');
    assert.equal(applyMatchSetup({ match_setup: JSON.stringify(setup) }).home_libero_color, '#ffcc00');
});

test('invalid shirt colors are rejected before saving', async () => {
    const f = fixture(); await prepare(f);
    f.req.body.draft.home.color = 'red; background:url(example)';
    const res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 400);
    assert.equal(f.state.updates.length, 0);
});

test('invalid libero shirt colors are rejected before saving', async () => {
    const f = fixture(); await prepare(f);
    f.req.body.draft.away.liberoColor = 'invalid';
    const res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 400);
    assert.equal(f.state.updates.length, 0);
});
test('stale edits, offline leases, confirmed matches and another manual owner are rejected', async () => {
    for (const scenario of ['stale', 'lease', 'confirmed', 'owner']) {
        const f = fixture(); await prepare(f);
        if (scenario === 'stale') f.data.match.location = 'Changed elsewhere';
        if (scenario === 'lease') f.state.lease = { released: 0, expires_at: Date.now() + 100000 };
        if (scenario === 'confirmed') f.data.match.manual_lifecycle = 'confirmed';
        if (scenario === 'owner') f.data.match.manual_owner_id = 99;
        const res = f.response(); await f.controller.save(f.req, res);
        assert.ok([403,409].includes(res.code), scenario);
        assert.equal(f.state.commits, 0);
        assert.equal(f.state.updates.length, 0);
        assert.equal(f.state.rollbacks, 1);
    }
});
test('live matches permit metadata edits but reject roster and rule changes', async () => {
    const f = fixture({ status: 'live' }); await prepare(f);
    f.req.body.draft.home.name = 'Different';
    let res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 409);
    f.req.body.draft.home.name = 'Home';
    f.req.body.draft.maxSets = 3;
    res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 409);
    f.req.body.draft.maxSets = 5;
    f.req.body.draft.city = 'Bangkok';
    res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 200);
});
test('audit failure rolls back instead of reporting a partial success', async () => {
    const f = fixture(); await prepare(f); f.state.failAudit = true;
    const res = f.response(); await f.controller.save(f.req, res);
    assert.equal(res.code, 500);
    assert.equal(f.state.commits, 0);
    assert.equal(f.state.rollbacks, 1);
});

test('settings retain per-match point rules when reopened', async () => {
    const f = fixture({ points_per_set: 21, deciding_set_points: 11, manual_config: JSON.stringify({ pointsPerSet: 25, decidingSetPoints: 15 }) });
    const settings = await prepare(f);
    assert.equal(settings.draft.pointsPerSet, 21);
    assert.equal(settings.draft.decidingSetPoints, 11);
});

test('legacy match snapshots retain joined teams translations; explicit match translations take precedence', () => {
    for (const value of [undefined,null,'','   ']) {
        const match={home_team_name_en:'Santhithamvittayamulaniti',away_team_name_en:'Watbanna',match_setup:{home:{name:'Home',name_en:value},away:{name:'Away',name_en:value}}};
        applyMatchSetup(match);
        assert.equal(match.home_team_name_en,'Santhithamvittayamulaniti');assert.equal(match.away_team_name_en,'Watbanna');
    }
    const match={home_team_name_en:'Master',match_setup:{home:{name:'H',name_en:'Match English'},away:{name:'A'}}};
    assert.equal(applyMatchSetup(match).home_team_name_en,'Match English');
});
