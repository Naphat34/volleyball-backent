const { isVisSkill, isVisGrade, normalizeVisSkill, normalizeVisGrade } = require('../config/visCodes');
const { projectVisTiming, normalizeVisTiming } = require('./visTiming');
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const copy = value => JSON.parse(JSON.stringify(value));
const ids = players => (players || []).map(player => Number(player?.id ?? player)).filter(Number.isSafeInteger);
const otherTeam = team => team === 'home' ? 'away' : 'home';
function rallyWinner(skill, grade, team) { return skill === 'OP' || (grade === '#' && ['A', 'S', 'B'].includes(skill)) ? team : ['=', '/'].includes(grade) ? otherTeam(team) : null; }
function awardServe(state, winner) {
    if (!winner) return;
    if (state.servingTeam && state.servingTeam !== winner && state.lineups[winner].length === 6) {
        const rotation = state.lineups[winner];
        // P2 moves to P1, P3 to P2, ... P1 to P6 on a side-out.
        state.lineups[winner] = [...rotation.slice(1), rotation[0]];
    }
    state.servingTeam = winner;
}
function initialState(maxSets = 5) {
    return { revision: 0, phase: 'PLAYING', currentSet: 1, maxSets: Number(maxSets), score: { home: 0, away: 0 }, setsWon: { home: 0, away: 0 }, completedSets: [], lineups: { home: [], away: [] }, liberos: { home: null, away: null }, liberoReplacements: { home: null, away: null }, lastLiberoRally: { home: null, away: null }, servingTeam: null, firstSetHomeLeft: true, isHomeLeft: true, officialReady: true, history: [] };
}
function actionDetails(action) { return parse(action.details ?? action.description); }
function projectOfficialState(match, actions = []) {
    const state = initialState(match.max_sets);
    const stats = actions.filter(action => action.action_type === 'VIS_STAT').sort((a, b) => Number(a.id) - Number(b.id));
    const latest = stats.at(-1);
    if (latest) {
        const details = actionDetails(latest), context = details.visContext || details.officialContext || {};
        state.currentSet = Number(latest.set_number || context.setNumber || 1);
        state.score = { home: Number(context.scoreAfter?.home ?? latest.score_home ?? context.score?.home ?? 0), away: Number(context.scoreAfter?.away ?? latest.score_away ?? context.score?.away ?? 0) };
        state.lineups = { home: ids(context.lineups?.home), away: ids(context.lineups?.away) };
        state.isHomeLeft = context.isHomeLeft ?? true;
    }
    const setup = parse(match.vis_state);
    const savedSetups = { ...(setup.lineups ? { 1: setup } : {}), ...(setup.setups || {}) };
    state.setLineups = Object.fromEntries(Object.entries(savedSetups).map(([number, saved]) => [number, {
        home: ids(saved.lineups?.home), away: ids(saved.lineups?.away), servingTeam: saved.servingTeam || null,
    }]));
    const lastBySet = new Map();
    for (const action of stats) lastBySet.set(Number(action.set_number || 1), action);
    for (const [setNumber, action] of lastBySet) {
        const context = actionDetails(action).visContext || {};
        const score = context.scoreAfter || { home: Number(action.score_home || 0), away: Number(action.score_away || 0) };
        const target = setNumber === state.maxSets ? 15 : 25;
        if (Math.max(score.home, score.away) >= target && Math.abs(score.home - score.away) >= 2) {
            state.completedSets.push({ set: setNumber, home: score.home, away: score.away });
            state.setsWon[score.home > score.away ? 'home' : 'away']++;
            if (setNumber === state.currentSet) {
                if (Math.max(state.setsWon.home, state.setsWon.away) >= Math.floor(state.maxSets / 2) + 1) state.phase = 'MATCH_FINISHED';
                else { state.currentSet++; state.score = { home: 0, away: 0 }; }
            }
        }
    }
    const currentSetup = setup.setups?.[state.currentSet] || (state.currentSet === 1 ? setup : {});
    state.lineups = { home: ids(currentSetup.lineups?.home), away: ids(currentSetup.lineups?.away) };
    const first = setup.setups?.[1] || setup;
    const firstServer = first.servingTeam || setup.firstServingTeam;
    state.firstServingTeam = firstServer || null;
    state.substitutionLimit = Number(setup.substitutionLimit) || 6;
    state.requiresToss = state.currentSet === 1 || state.currentSet === state.maxSets;
    state.servingTeam = currentSetup.servingTeam || (state.currentSet === 1 ? firstServer : null) || (!state.requiresToss && firstServer
        ? state.currentSet % 2 === 1 ? firstServer : otherTeam(firstServer) : null);
    state.firstSetHomeLeft = setup.firstSetHomeLeft ?? true;
    state.isHomeLeft = currentSetup.firstSetHomeLeft ?? (state.currentSet % 2 === 1 ? state.firstSetHomeLeft : !state.firstSetHomeLeft);
    state.setupComplete = state.lineups.home.length === 6 && state.lineups.away.length === 6
        && Boolean(state.servingTeam) && typeof currentSetup.firstSetHomeLeft === 'boolean';
    const controls = setup.controls || [];
    state.timeouts = { home: 0, away: 0 };
    state.substitutions = { home: 0, away: 0 };
    const timeline = [
        ...stats.filter(action => Number(action.set_number) === state.currentSet)
            .map(action => ({ event: action, order: Number(action.id), tie: 0 })),
        ...controls.filter(event => Number(event.set_id) === state.currentSet)
            .map((event, index) => ({ event, order: Number(event.afterEventId) || 0, tie: index + 1 })),
    ].sort((a, b) => a.order - b.order || a.tie - b.tie);
    for (const { event } of timeline) {
        if (event.action_type === 'VIS_STAT') {
            const team = String(event.team_id) === String(match.home_team_id) ? 'home' : 'away';
            const details = actionDetails(event);
            if (!details.rallyId || details.rallyPoint) awardServe(state, details.rallyId ? details.statisticalRallyWinner : rallyWinner(event.skill, event.grade, team));
            continue;
        }
        if (event.skill === 'TIMEOUT') state.timeouts[event.team]++;
        if (event.skill === 'LIBERO_REPLACEMENT') {
            const { playerOut, playerIn, replacement } = event.details;
            state.lineups[event.team] = state.lineups[event.team].map(id => id === playerOut ? playerIn : id);
            state.liberoReplacements[event.team] = replacement;
            state.lastLiberoRally[event.team] = Number(event.score_home) + Number(event.score_away);
        }
        if (event.skill === 'SUBSTITUTION') {
            state.substitutions[event.team]++;
            state.lineups[event.team] = state.lineups[event.team].map(id => id === event.details.playerOut ? event.details.playerIn : id);
        }
    }
    state.revision = stats.length + (Number(setup.lineupRevision) || 0) + (Number(setup.controlRevision) || 0);
    state.history = [
        ...stats.map(action => ({ eventId: Number(action.id), type: 'STAT', order: Number(action.id), tie: 0, team: String(action.team_id) === String(match.home_team_id) ? 'home' : 'away' })),
        ...controls.map((event, index) => ({ eventId: event.id, type: 'CONTROL', order: event.afterEventId || 0, tie: index + 1, team: event.team })),
    ].sort((a, b) => a.order - b.order || a.tie - b.tie);
    state.context = { setNumber: state.currentSet, score: copy(state.score), lineups: copy(state.lineups), servingTeam: state.servingTeam, serverPlayerId: state.servingTeam ? state.lineups[state.servingTeam][0] : null, isHomeLeft: state.isHomeLeft };
    // Context is an exact optimistic-concurrency identifier, not an authentication secret.
    // Keep this synchronous and portable so the same engine can run offline.
    state.context.key = JSON.stringify(state.context);
    state.timing = projectVisTiming(stats, state.completedSets, state.maxSets);
    return { state, session: { operations: [...(setup.lineupOperations || []), ...(setup.controlOperations || []), ...stats.map(action => actionDetails(action).operationId).filter(Boolean)] }, rallies: [] };
}
function resolveContext(state, rallies, context) {
    if (!context?.key || context.key !== state.context.key) fail('VIMS context changed. Refresh before recording.', 409);
    return copy(state.context);
}
function applyCommand(previous, command) {
    const state = copy(previous);
    if (command.type === 'UNDO') { const undo = state.history.pop(); if (!undo) fail('No VIMS statistic to undo', 409); return { state, undo }; }
    if (command.type !== 'STAT') fail('VIMS records statistics only.');
    if (!['home', 'away'].includes(command.team)) fail('Invalid team');
    const skill = normalizeVisSkill(command.skill), grade = normalizeVisGrade(command.grade);
    if (!isVisSkill(skill) || !isVisGrade(grade)) fail('Invalid VIMS skill or grade');
    const player = Number(command.player), context = command.officialContext;
    if (!context) fail('Select a VIMS recording context.', 409);
    const onCourt = context.lineups?.[command.team] || [];
    if (onCourt.length && !onCourt.includes(player)) fail('Select a player on court for the VIMS lineup');
    assertLiberoReady(previous);
    if (previous.liberoReplacements?.[command.team]?.libero === player && ['S', 'B'].includes(skill)) fail('Libero cannot serve or block');
    const winner = rallyWinner(skill, grade, command.team);
    if (winner) { state.score[winner]++; awardServe(state, winner); }
    return { state, event: { skill, grade, team: command.team, player, details: { statisticalRallyWinner: winner, visContext: { ...context, scoreBefore: context.score, scoreAfter: copy(state.score) } } } };
}
function applyRally(previous, events) {
    if (!Array.isArray(events) || !events.length || events.length > 60) fail('Invalid rally events');
    const state = copy(previous), winners = new Set();
    assertLiberoReady(previous);
    for (const event of events) {
        if (!['home', 'away'].includes(event.team)) fail('Invalid rally team');
        const teamEvent = (event.skill === 'OP' && event.grade === '#') || (event.skill === 'T' && event.grade === '=');
        if (!teamEvent) {
            if (!isVisSkill(event.skill) || !(isVisGrade(event.grade) || event.grade === '' || (event.skill === 'A' && event.grade === '/'))) fail('Invalid rally skill or result');
            if (!Number.isSafeInteger(event.player) || !state.lineups[event.team].includes(event.player)) fail('Select a player on court');
        } else if (event.player != null) fail('Team result cannot name a player');
        if (previous.liberoReplacements?.[event.team]?.libero === event.player && ['S', 'B'].includes(event.skill)) fail('Libero cannot serve or block');
        if (event.skill === 'S' && (event.team !== previous.servingTeam || event.player !== previous.lineups[event.team][0])) fail('Server must be position P1 of the serving team');
        const winner = rallyWinner(event.skill, event.grade, event.team);
        if (winner) winners.add(winner);
    }
    if (winners.size !== 1) fail('A completed rally must have exactly one winning team');
    const winner = [...winners][0];
    state.score[winner]++;
    awardServe(state, winner);
    return { state, winner };
}
function visDashboardSummary(match, actions, state = projectOfficialState(match, actions).state) {
    const hasActivity = Boolean(state.setupComplete || actions.length || state.history.length);
    const status = ['confirmed', 'cancelled'].includes(match.vis_lifecycle) ? match.vis_lifecycle
        : state.phase === 'MATCH_FINISHED' ? 'review' : actions.length || state.history.length ? 'recording' : state.setupComplete ? 'ready' : 'idle';
    return { status, hasActivity, currentSet: state.currentSet, score: state.score, setsWon: state.setsWon };
}
function configureVisSettings(setup, state, command) {
    const limit = command.substitutionLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 8) fail('Substitution limit must be between 1 and 8.');
    if (Object.values(state.substitutions).some(count => count > limit)) fail('Substitution limit is below substitutions already used.');
    if (!['home', 'away', null].includes(command.firstServingTeam)) fail('Invalid first serving team.');
    if (command.firstServingTeam !== state.firstServingTeam) {
        if (state.currentSet !== 1 || state.history.length) fail('First serving team is locked after recording starts.', 409);
        if (!command.firstServingTeam && state.setupComplete) fail('Select the first serving team.');
        setup.firstServingTeam = command.firstServingTeam;
        if (setup.servingTeam) setup.servingTeam = command.firstServingTeam;
        if (setup.setups?.[1]) setup.setups[1].servingTeam = command.firstServingTeam;
    }
    setup.substitutionLimit = limit;
    return setup;
}
function assertLiberoReady(state) {
    for (const team of ['home', 'away']) {
        const active = state.liberoReplacements?.[team];
        const position = active ? state.lineups[team].indexOf(active.libero) : -1;
        if (active && (![0, 4, 5].includes(position) || position === 0 && state.servingTeam === team)) fail('กรุณานำผู้เล่นเดิมกลับแทน Libero ก่อนเริ่มแรลลี่ถัดไป');
    }
}
function isLiberoPlayer(player) {
    return ['L', 'LIBERO', 'L1', 'L2'].includes(String(player?.position || player?.role || '').toUpperCase())
        || [player?.is_libero, player?.is_libero1, player?.is_libero2].some(value => value === true || Number(value) === 1);
}
function validateLiberoReplacement(state, command, liberoIds) {
    const { team, playerOut, playerIn } = command;
    if (!['home', 'away'].includes(team) || !state.setupComplete || state.phase === 'MATCH_FINISHED') fail('Complete the set lineup before recording');
    const active = state.liberoReplacements?.[team], lineup = state.lineups[team];
    if (!Number.isSafeInteger(playerOut) || !Number.isSafeInteger(playerIn) || !lineup.includes(playerOut) || lineup.includes(playerIn)) fail('Select an on-court player and a bench player');
    const rally = Number(state.score.home) + Number(state.score.away);
    if (state.lastLiberoRally?.[team] === rally) fail('ต้องมีแรลลี่จบอย่างน้อยหนึ่งครั้งระหว่างการสลับ Libero');
    let replacement = null;
    if (active) {
        if (playerOut !== active.libero || (playerIn !== active.regular && !liberoIds.includes(playerIn))) fail('Return the replaced player or select the other Libero');
        if (liberoIds.includes(playerIn)) replacement = { ...active, libero: playerIn };
    } else {
        const position = lineup.indexOf(playerOut);
        if (!liberoIds.includes(playerIn) || liberoIds.includes(playerOut) || ![0, 4, 5].includes(position)
            || position === 0 && state.servingTeam === team) fail('Libero may replace a back-row non-serving player only');
        replacement = { libero: playerIn, regular: playerOut };
    }
    return { playerOut, playerIn, replacement };
}
function substitutionPairs(command) {
    const pairs = command.pairs;
    if (!Array.isArray(pairs) || pairs.length < 1 || pairs.length > 6 || pairs.some(pair => !pair || !Number.isSafeInteger(pair.playerOut) || !Number.isSafeInteger(pair.playerIn) || pair.playerOut === pair.playerIn)) fail('Select 1–6 valid substitution pairs');
    const ids = pairs.flatMap(pair => [pair.playerOut, pair.playerIn]);
    if (new Set(ids).size !== ids.length) fail('A player may appear only once in a substitution batch');
    return pairs;
}
module.exports = { substitutionPairs, isLiberoPlayer, validateLiberoReplacement, initialState, projectOfficialState, resolveContext, applyCommand, applyRally, rallyWinner, visDashboardSummary, configureVisSettings, normalizeVisTiming, fail };
