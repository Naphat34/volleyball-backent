const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { getJwtSecret } = require('../config/security');
const { sqlDialect } = require('../utils/sqlDialect');

const signingSecret = getJwtSecret();
const digest = value => crypto.createHmac('sha256', signingSecret).update(value).digest();
const grantSecret = digest('court-station-grant');
const stationPin = pairingId => String(digest(`court-station-pin:${pairingId}`).readUInt32BE(0) % 100000000).padStart(8, '0');

async function readMatch(id) {
    const { rows } = await db.query(`SELECT home_team_id, away_team_id, status, live_state,
        EXISTS (SELECT 1 FROM scorer_offline_sessions s WHERE s.match_id = matches.id AND s.released = 0 AND s.expires_at > ?) AS station_offline
        FROM matches WHERE id = ?`, [Date.now(), id]);
    const match = rows[0];
    if (!match) return null;
    const live = typeof match.live_state === 'string' ? JSON.parse(match.live_state) : match.live_state;
    return { ...match, live };
}

const pausedPhases = ['COIN_TOSS', 'SET_ENDING', 'SET_FINISHED', 'MATCH_FINISHED'];
const validSide = side => side === 'A' || side === 'B';
const closed = match => ['completed', 'finished', 'cancelled'].includes(String(match.status).toLowerCase()) || match.live?.workflowStep === 'MATCH_FINISHED';
const available = match => match.live?.courtStationRevision && typeof match.live.isHomeLeft === 'boolean'
    && !exports.isStationPaused(match.live)
    && !Number(match.station_offline)
    && !closed(match);
const teamAt = (match, side) => (match.live.isHomeLeft === (side === 'A') ? match.home_team_id : match.away_team_id);
const isParticipant = (user, match) => user.role === 'team_staff'
    && [match.home_team_id, match.away_team_id].some(id => id != null && String(id) === String(user.team_id));

exports.isStationPaused = state => !state || pausedPhases.includes(state.workflowStep) || Boolean(state.offlineAwaitingConfirmation);

exports.stationWriteGuard = () => {
    const revision = sqlDialect(
        "JSON_UNQUOTE(JSON_EXTRACT(live_state, '$.courtStationRevision'))",
        "(live_state::jsonb ->> 'courtStationRevision')"
    );
    return `EXISTS (SELECT 1 FROM matches WHERE id = ? AND ${revision} = ?
        AND LOWER(status) NOT IN ('completed', 'finished', 'cancelled')
        AND EXISTS (SELECT 1 FROM court_station_pairings p WHERE p.match_id = matches.id AND p.side = ? AND p.pairing_id = ? AND p.paired_user_id = ?)
        AND NOT EXISTS (SELECT 1 FROM scorer_offline_sessions s WHERE s.match_id = matches.id AND s.released = 0 AND s.expires_at > ?))`;
};

exports.status = async (req, res, next) => {
    try {
        const match = await readMatch(req.params.matchId);
        if (!match || !isParticipant(req.user, match)) return res.sendStatus(403);
        const { side } = req.query;
        if (!validSide(side)) return res.sendStatus(400);
        const revision = match.live?.courtStationRevision;
        const teamId = revision && typeof match.live.isHomeLeft === 'boolean' ? teamAt(match, side) : null;
        const { grant } = await verifyGrant(req.params.matchId, req.user, req.get('X-Court-Station'), match);
        res.set('Cache-Control', 'no-store').json({
            teamId, revision, paused: !available(match), paired: grant?.side === side, closed: closed(match)
        });
    } catch (error) { next(error); }
};

exports.issuePin = async (req, res, next) => {
    try {
        const match = await readMatch(req.params.matchId);
        if (!match) return res.sendStatus(404);
        const { side, action } = req.body;
        if (!validSide(side) || !['issue', 'revoke'].includes(action)) return res.sendStatus(400);
        const matchId = req.params.matchId;
        res.set('Cache-Control', 'no-store');
        if (action === 'revoke') {
            await db.query('DELETE FROM court_station_pairings WHERE match_id = ? AND side = ?', [matchId, side]);
            return res.json({ revoked: true });
        }
        if (closed(match) || !match.home_team_id || !match.away_team_id) return res.sendStatus(409);
        const pairingId = crypto.randomUUID();
        await db.query(sqlDialect(
            `INSERT INTO court_station_pairings (match_id, side, pairing_id) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE pairing_id = VALUES(pairing_id), paired_user_id = NULL`,
            `INSERT INTO court_station_pairings (match_id, side, pairing_id) VALUES (?, ?, ?)
             ON CONFLICT (match_id, side) DO UPDATE SET pairing_id = EXCLUDED.pairing_id, paired_user_id = NULL`
        ), [matchId, side, pairingId]);
        res.json({ pin: stationPin(pairingId) });
    } catch (error) { next(error); }
};

exports.unlock = async (req, res, next) => {
    try {
        const match = await readMatch(req.params.matchId);
        if (!match || !isParticipant(req.user, match)) return res.sendStatus(403);
        const { side, pin } = req.body;
        if (!validSide(side) || typeof pin !== 'string' || !/^\d{8}$/.test(pin)) return res.sendStatus(400);
        if (closed(match)) return res.sendStatus(409);
        const matchId = req.params.matchId;
        const pairing = (await db.query('SELECT pairing_id, paired_user_id FROM court_station_pairings WHERE match_id = ? AND side = ?', [matchId, side])).rows[0];
        if (!pairing || pairing.paired_user_id != null || !crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(stationPin(pairing.pairing_id)))) return res.sendStatus(403);
        const claimed = await db.query(`UPDATE court_station_pairings SET paired_user_id = ?
            WHERE match_id = ? AND side = ? AND pairing_id = ? AND paired_user_id IS NULL`, [req.user.id, matchId, side, pairing.pairing_id]);
        if (!(claimed.affectedRows ?? claimed.rowCount)) return res.sendStatus(409);
        const token = jwt.sign({ matchId, side, pairingId: pairing.pairing_id, userId: req.user.id }, grantSecret, { audience: 'court-station-pairing' });
        res.set('Cache-Control', 'no-store').json({ token });
    } catch (error) { next(error); }
};

async function verifyGrant(matchId, user, token, matchSnapshot) {
    if (!token) return { status: 403 };
    let grant;
    try { grant = jwt.verify(token, grantSecret, { audience: 'court-station-pairing', algorithms: ['HS256'] }); }
    catch { return { status: 403 }; }
    if (!validSide(grant.side) || String(grant.matchId) !== String(matchId)
        || String(grant.userId) !== String(user.id)) return { status: 403 };
    const match = matchSnapshot || await readMatch(matchId);
    if (!match || !isParticipant(user, match) || closed(match)) return { status: 403 };
    const { rows } = await db.query(`SELECT 1 FROM court_station_pairings
        WHERE match_id = ? AND side = ? AND pairing_id = ? AND paired_user_id = ?`,
    [matchId, grant.side, grant.pairingId, user.id]);
    return rows.length ? { grant, match } : { status: 403 };
}

exports.canJoinStaffRoom = async (matchId, user, token, expectedTeamId) => {
    const { grant, match } = await verifyGrant(matchId, user, token);
    return Boolean(grant && available(match) && String(teamAt(match, grant.side)) === String(expectedTeamId));
};

exports.stationAccess = async (req, res, next) => {
    try {
        const { status, grant, match } = await verifyGrant(req.params.matchId, req.user, req.get('X-Court-Station'));
        if (!grant) return res.sendStatus(status);
        const revision = match.live?.courtStationRevision;
        if (!available(match) || req.get('X-Court-Revision') !== revision) return res.sendStatus(409);
        req.stationTeamId = teamAt(match, grant.side);
        if (!req.stationTeamId) return res.sendStatus(409);
        req.stationRevision = revision;
        req.stationPairing = grant;
        next();
    } catch (error) { next(error); }
};
