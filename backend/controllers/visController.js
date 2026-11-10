const db = require('../config/db');
const { projectOfficialState, resolveContext, applyCommand, applyRally, configureVisSettings, normalizeVisTiming, isLiberoPlayer, validateLiberoReplacement, substitutionPairs, fail } = require('../utils/visWorkflow');
const { formatVisEventCode, getVisJerseyNumber } = require('../utils/visEventCode');
const teamId = (match, team) => match[`${team}_team_id`];
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const isVisAction = action => action?.action_type === 'VIS_STAT';
async function recordingRoster(connection, req) {
    const scorer = require('./scorerOfflineController');
    return scorer.call(scorer.scopedController(connection), 'getMatchRosterData', req, {});
}
async function getMatch(connection, id, lock = false) {
    const result = await connection.query(`SELECT m.*, COALESCE(c.max_sets, m.max_sets, 5) AS max_sets,
        COALESCE(m.age_group_id, c.age_group_id) AS effective_age_group_id,
        COALESCE(m.gender, c.gender) AS effective_gender
        FROM matches m LEFT JOIN competitions c ON c.id = m.competition_id
        WHERE m.id = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!result.rows[0]) fail('Match not found', 404);
    return result.rows[0];
}
async function read(connection, match) {
    const actions = await connection.query(`SELECT * FROM match_actions
        WHERE match_id = ? AND action_type = 'VIS_STAT' ORDER BY id ASC`, [match.id]);
    const projected = projectOfficialState(match, actions.rows);
    const events = actions.rows.filter(isVisAction).map(action => {
        const details = parse(action.details ?? action.description);
        return { ...action, set_id: action.set_number, details, event_code: details.event_code,
            referenceNeedsReview: false };
    });
    const controls = parse(match.vis_state).controls || [];
    const byId = new Map([...events, ...controls].map(event => [String(event.id), event]));
    return { ...projected, events: [...projected.state.history].reverse().map(item => byId.get(String(item.eventId))).filter(Boolean) };
}
exports.getState = async (req, res) => {
    let connection;
    try {
        connection = await db.connect();
        await connection.beginTransaction();
        const match = await getMatch(connection, req.params.matchId);
        const { state, session, rallies, events } = await read(connection, match);
        await connection.commit();
        res.json({ state, rallies, events, legacy: false, operations: session.operations || [],
            backupMatch: { home_team_id: match.home_team_id, away_team_id: match.away_team_id, vis_state: parse(match.vis_state) } });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Read VIS state:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to load official scoring state' });
    } finally { if (connection) connection.release(); }
};
exports.command = async (req, res) => {
    let connection;
    try {
        const { operationId, revision, command } = req.body;
        if (!/^[a-zA-Z0-9-]{16,80}$/.test(operationId || '') || !Number.isSafeInteger(revision) || !command || typeof command !== 'object') fail('Invalid VIMS operation');
        connection = await db.connect();
        await connection.beginTransaction();
        const match = await getMatch(connection, req.params.matchId, true);
        const visLease = parse(match.vis_state).offlineVis?.payload?.offlineLease;
        if (!req.offlineReplay && visLease?.expiresAt > Date.now()) fail('แมตช์ถูกจองสำหรับ VIMS Offline กรุณาซิงค์และคืนสิทธิ์ก่อน', 409);
        if (['cancelled', 'canceled'].includes(match.status)) fail('Match is cancelled', 409);
        const { state: previous, session, rallies } = await read(connection, match);
        const operations = session.operations || [];
        if (operations.includes(operationId)) {
            await connection.rollback();
            return res.json({ state: previous, duplicate: true });
        }
        if (previous.revision !== revision) fail('VIMS statistics changed on another screen. Reload before continuing.', 409);
        if (['completed', 'finished', 'match_finished'].includes(match.status)) fail('Match is finished', 409);
        if (command.type === 'CONFIGURE_SETTINGS') {
            if (previous.phase === 'MATCH_FINISHED') fail('Match is finished', 409);
            const setup = configureVisSettings(parse(match.vis_state), previous, command);
            setup.lineupRevision = (Number(setup.lineupRevision) || 0) + 1;
            setup.lineupOperations = [...(setup.lineupOperations || []), operationId];
            await connection.query('UPDATE matches SET vis_state = ? WHERE id = ?', [JSON.stringify(setup), match.id]);
            const result = await read(connection, { ...match, vis_state: setup });
            await connection.commit();
            req.app.get('io')?.to('match_' + match.id).emit('vis_statistics_updated', { matchId: match.id });
            return res.json({ state: result.state });
        }
        const last = previous.history.at(-1);
        if (command.type === 'RALLY') {
            if (!previous.setupComplete || previous.phase === 'MATCH_FINISHED') fail('Complete the set lineup before recording.', 409);
            const context = resolveContext(previous, rallies, command.context);
            const result = applyRally(previous, command.events);
            const savedEvents = [];
            for (const [index, event] of command.events.entries()) {
                let number = null;
                if (event.player != null) {
                    const valid = await connection.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [event.player, teamId(match, event.team)]);
                    if (!valid.rows.length) fail('Player does not belong to this team');
                    number = await getVisJerseyNumber(connection, match, teamId(match, event.team), event.player);
                    if (number == null || String(number).trim() === '' || !Number.isSafeInteger(Number(number)) || Number(number) < 0) fail('Invalid jersey number');
                }
                const code = `${event.team === 'home' ? '*' : 'a'}${number == null ? '' : String(number).padStart(2, '0')}${event.skill}${event.grade}`;
                const details = { vis: true, visTiming: normalizeVisTiming(req.body.timing, context.setNumber), scoringSource: 'vis-statistics', operationId, rallyId: operationId,
                    rallyPoint: index === command.events.length - 1, statisticalRallyWinner: result.winner,
                    jersey_number: number == null ? null : Number(number), event_code: code, rawGrade: event.grade, generated: Boolean(event.generated),
                    visContext: { ...context, scoreBefore: context.score, scoreAfter: result.state.score } };
                const inserted = await connection.query(`INSERT INTO match_actions
                    (match_id, set_number, action_type, team_id, player_id, skill, grade, score_home, score_away, description, details, operation_id, created_at)
                    VALUES (?, ?, 'VIS_STAT', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [match.id, context.setNumber, teamId(match, event.team), event.player, event.skill, event.grade || '!',
                    result.state.score.home, result.state.score.away, code, JSON.stringify(details), operationId]);
                if (!inserted.insertId) throw new Error('Rally insert failed');
                savedEvents.push({ id: inserted.insertId, set_id: context.setNumber, set_number: context.setNumber,
                    team_id: teamId(match, event.team), player_id: event.player, skill: event.skill, grade: event.grade || '!',
                    score_home: result.state.score.home, score_away: result.state.score.away, details, event_code: code });
            }
            const refreshed = await read(connection, match);
            await connection.commit();
            const io = req.app.get('io');
            if (io) io.to(`match_${match.id}`).emit('vis_statistics_updated', { matchId: match.id });
            return res.json({ state: refreshed.state, events: savedEvents.reverse() });
        }
        if (command.type === 'UNDO' && last?.type === 'STAT') {
            const row = await connection.query("SELECT * FROM match_actions WHERE id = ? AND match_id = ? AND action_type = 'VIS_STAT'", [last.eventId, match.id]);
            const details = parse(row.rows[0]?.details);
            if (details.rallyId) {
                const group = await connection.query("SELECT * FROM match_actions WHERE match_id = ? AND action_type = 'VIS_STAT' AND operation_id = ?", [match.id, details.rallyId]);
                await connection.query("DELETE FROM match_actions WHERE match_id = ? AND action_type = 'VIS_STAT' AND operation_id = ?", [match.id, details.rallyId]);
                const setup = parse(match.vis_state);
                const next = { ...setup, controlOperations: [...(setup.controlOperations || []), operationId],
                    controlRevision: (Number(setup.controlRevision) || 0) + group.rows.length + 1 };
                await connection.query('UPDATE matches SET vis_state = ? WHERE id = ?', [JSON.stringify(next), match.id]);
                const refreshed = await read(connection, { ...match, vis_state: next });
                await connection.commit();
                const io = req.app.get('io');
                if (io) io.to(`match_${match.id}`).emit('vis_statistics_updated', { matchId: match.id });
                return res.json({ state: refreshed.state, deletedEventIds: group.rows.map(event => event.id) });
            }
        }
        if (['TIMEOUT', 'SUBSTITUTION', 'SUBSTITUTIONS', 'LIBERO_REPLACEMENT'].includes(command.type) || (command.type === 'UNDO' && last?.type === 'CONTROL')) {
            const setup = parse(match.vis_state);
            let controls = setup.controls || [], event = null, deletedEventId = null, deletedEventIds;
            const events = [];
            if (command.type === 'UNDO') {
                deletedEventId = last.eventId;
                const batchId = controls.find(item => item.id === deletedEventId)?.details?.batchId;
                deletedEventIds = controls.filter(item => batchId ? item.details?.batchId === batchId : item.id === deletedEventId).map(item => item.id);
                controls = controls.filter(item => !deletedEventIds.includes(item.id));
            } else {
                const batch = command.type === 'SUBSTITUTIONS';
                const commands = batch ? substitutionPairs(command).map(pair => ({ ...pair, type: 'SUBSTITUTION', team: command.team })) : [command];
                for (const [index, command] of commands.entries()) {
                const previous = (await read(connection, { ...match, vis_state: { ...setup, controls } })).state;
                if (!previous.setupComplete || previous.phase === 'MATCH_FINISHED') fail('Complete the set lineup before recording.', 409);
                const team = command.team;
                if (!['home', 'away'].includes(team)) fail('Invalid team');
                if (command.type === 'TIMEOUT' && previous.timeouts[team] >= 2) fail('Maximum 2 timeouts per set.');
                const details = batch ? { batchId: operationId } : {};
                if (['SUBSTITUTION', 'LIBERO_REPLACEMENT'].includes(command.type)) {
                    const roster = await recordingRoster(connection, req);
                    const liberoIds = roster[team].players.filter(isLiberoPlayer).map(player => Number(player.id));
                    if (![command.playerIn, command.playerOut].every(id => roster[team].players.some(player => Number(player.id) === id))) fail('Select players from the match roster');
                    if (command.type === 'LIBERO_REPLACEMENT') Object.assign(details, validateLiberoReplacement(previous, command, liberoIds));
                    else if (liberoIds.includes(command.playerIn) || liberoIds.includes(command.playerOut)
                        || previous.liberoReplacements[team]?.regular === command.playerIn) fail('Use Libero replacement instead');
                }
                if (command.type === 'SUBSTITUTION') {
                    if (previous.substitutions[team] >= previous.substitutionLimit) fail(`Maximum ${previous.substitutionLimit} substitutions per set.`);
                    const { playerOut, playerIn } = command;
                    if (!Number.isSafeInteger(playerIn) || !previous.lineups[team].includes(playerOut) || previous.lineups[team].includes(playerIn)) fail('Select an on-court player and a bench player.');
                    const starters = (setup.setups?.[previous.currentSet] || setup).lineups[team];
                    // Pair substitutions by the original starter, not the current
                    // court slot, which changes whenever this team rotates.
                    const earlierSwap = controls.find(item => item.set_id === previous.currentSet && item.team === team
                        && item.skill === 'SUBSTITUTION' && item.details.playerIn === playerOut);
                    const slot = earlierSwap ? earlierSwap.details.slot : starters.indexOf(playerOut);
                    const swaps = controls.filter(item => item.set_id === previous.currentSet && item.team === team
                        && item.skill === 'SUBSTITUTION' && item.details.slot === slot);
                    if (swaps.length >= 2 || (!swaps.length && starters.includes(playerIn))
                        || (swaps.length === 1 && playerIn !== starters[slot])) fail('A substitute may return only with the original starting player, once per set.');
                    const valid = await connection.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [playerIn, teamId(match, team)]);
                    if (!valid.rows.length) fail('Player does not belong to this team');
                    const number = await getVisJerseyNumber(connection, match, teamId(match, team), playerIn);
                    if (!formatVisEventCode('S', number, '#')) fail('Player jersey number is missing or invalid.');
                    Object.assign(details, { playerOut, playerIn, slot });
                }
                event = { id: 'control-' + operationId + (batch ? '-' + index : ''), skill: command.type, team, team_id: teamId(match, team),
                    set_id: previous.currentSet, set_number: previous.currentSet, score_home: previous.score.home, score_away: previous.score.away,
                    afterEventId: Math.max(0, ...previous.history.filter(item => item.type === 'STAT').map(item => item.eventId)),
                    details, created_at: new Date().toISOString() };
                controls = [...controls, event];
                events.push(event);
                }
            }
            const next = { ...setup, controls, controlRevision: (Number(setup.controlRevision) || 0) + 1,
                controlOperations: [...(setup.controlOperations || []), operationId] };
            await connection.query('UPDATE matches SET vis_state = ? WHERE id = ?', [JSON.stringify(next), match.id]);
            const result = await read(connection, { ...match, vis_state: next });
            await connection.commit();
            const io = req.app.get('io');
            if (io) io.to('match_' + match.id).emit('vis_statistics_updated', { matchId: match.id });
            return res.json({ state: result.state, event: command.type === 'SUBSTITUTIONS' ? undefined : event, events: command.type === 'SUBSTITUTIONS' ? events.reverse() : undefined, deletedEventId, deletedEventIds });
        }
        if (command.type === 'SET_LINEUP') {
            if ((parse(match.vis_state).controls || []).some(event => Number(event.set_id) === previous.currentSet)) fail('Undo set controls before changing the starting lineup', 409);
            if (previous.phase === 'MATCH_FINISHED') fail('Match is finished', 409);
            if (previous.requiresToss && (!['home', 'away'].includes(command.servingTeam) || typeof command.firstSetHomeLeft !== 'boolean')) {
                fail('Select the first serving team and court side.');
            }
            const lineups = command.lineups;
            const roster = await recordingRoster(connection, req);
            for (const team of ['home', 'away']) {
                const players = lineups?.[team];
                if (!Array.isArray(players) || players.length !== 6 || players.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(players).size !== 6) {
                    fail('Select six different players in positions P1-P6 for each team.');
                }
                for (const player of players) {
                    const member = roster[team].players.find(item => Number(item.id) === player);
                    if (!member || isLiberoPlayer(member)) fail('Select six regular roster players, excluding Liberos');
                    const valid = await connection.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [player, teamId(match, team)]);
                    if (!valid.rows.length) fail('Player does not belong to this team');
                    const number = await getVisJerseyNumber(connection, match, teamId(match, team), player);
                    if (!formatVisEventCode('S', number, '#')) fail('Player jersey number is missing or invalid. Update the roster.');
                }
            }
            const setup = parse(match.vis_state);
            const setSetup = { lineups, servingTeam: previous.requiresToss ? command.servingTeam : previous.servingTeam,
                firstSetHomeLeft: previous.requiresToss ? command.firstSetHomeLeft : previous.isHomeLeft };
            const next = { ...setup, ...(previous.currentSet === 1 ? setSetup : {}),
                setups: { ...(setup.setups || {}), ...(setup.lineups && !setup.setups?.[1] ? { 1: setup } : {}), [previous.currentSet]: setSetup },
                lineupRevision: (Number(setup.lineupRevision) || 0) + 1,
                lineupOperations: [...(setup.lineupOperations || []), operationId] };
            await connection.query('UPDATE matches SET vis_state = ? WHERE id = ?', [JSON.stringify(next), match.id]);
            const result = await read(connection, { ...match, vis_state: next });
            await connection.commit();
            const io = req.app.get('io');
            if (io) io.to('match_' + match.id).emit('vis_statistics_updated', { matchId: match.id });
            return res.json({ state: result.state });
        }
        const officialContext = command.type === 'STAT' ? resolveContext(previous, rallies, command.context) : null;
        if (command.type === 'STAT' && (!previous.setupComplete || previous.phase === 'MATCH_FINISHED')) fail('Complete the set lineup before recording.', 409);
        const { state, event, undo } = applyCommand(previous, { ...command, officialContext });
        if (event) {
            const valid = await connection.query('SELECT id FROM players WHERE id = ? AND team_id = ?', [event.player, teamId(match, event.team)]);
            if (!valid.rows.length) fail('Player does not belong to this team');
        }
        if (undo) {
            const result = await connection.query(`SELECT * FROM match_actions
                WHERE id = ? AND match_id = ? AND action_type = 'VIS_STAT'`, [undo.eventId, match.id]);
            if (!result.rows[0]) fail('The VIMS statistic is no longer available.', 409);
            await connection.query(`DELETE FROM match_actions
                WHERE id = ? AND match_id = ? AND action_type = 'VIS_STAT'`, [undo.eventId, match.id]);
        }
        let savedEvent = null;
        if (event) {
            const number = await getVisJerseyNumber(connection, match, teamId(match, event.team), event.player);
            const code = formatVisEventCode(event.skill, number, event.grade);
            if (!code) fail('Player jersey number is missing or invalid. Update the roster before recording.');
            const details = { visTiming: normalizeVisTiming(req.body.timing, officialContext.setNumber), ...event.details, vis: true, scoringSource: 'vis-statistics', operationId,
                event_type: event.skill, jersey_number: Number(number), event_code: code };
            const result = await connection.query(`INSERT INTO match_actions
                (match_id, set_number, action_type, team_id, player_id, skill, grade, score_home, score_away, description, details, operation_id, created_at)
                VALUES (?, ?, 'VIS_STAT', ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [match.id, officialContext.setNumber,
                teamId(match, event.team), event.player, event.skill, event.grade, officialContext.score.home,
                officialContext.score.away, code, JSON.stringify(details), operationId]);
            if (!result.insertId) throw new Error('VIMS event insert did not return an ID');
            savedEvent = { id: result.insertId, ...event, details, event_code: code, set_id: officialContext.setNumber,
                team_id: teamId(match, event.team), player_id: event.player, score_home: officialContext.score.home, score_away: officialContext.score.away };
            state.history.push({ eventId: savedEvent.id, type: 'STAT', team: event.team });
            state.history = state.history.slice(-100);
            state.revision = previous.revision + 1;
        } else if (undo) {
            state.revision = Math.max(0, previous.revision - 1);
        }
        const refreshed = await read(connection, match);
        await connection.commit();
        const io = req.app.get('io');
        if (io) io.to(`match_${match.id}`).emit('vis_statistics_updated', { matchId: match.id });
        res.json({ state: refreshed.state, event: savedEvent, deletedEventId: undo?.eventId || null });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Save VIS statistic:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to save VIMS statistic. Check the saved result before retrying.' });
    } finally { if (connection) connection.release(); }
};
