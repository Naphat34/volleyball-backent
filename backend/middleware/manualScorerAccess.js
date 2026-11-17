const db = require('../config/db');
const auth = require('./authMiddleware');
const { canManage, parseConfig } = require('../utils/manualScorer');
const { roleHasPermission } = require('../config/permissions');
const { canReadStatistics, assertStatisticsWriter } = require('../utils/manualVisAccess');

// Cover the existing console, viewer, report, team and legacy action routes.
module.exports = async (req, res, next) => {
    try {
        // Express decodes route parameters later; apply the same decoding before ACLs.
        let path;
        try { path = require('../utils/accessPath').accessPath(req.path); }
        catch { return res.status(400).json({error:'Invalid identifier'}); }
        const matchId = path.match(/^\/(?:scorer\/match|match|(?:admin\/)?matches)\/(\d+)(?:\/|$)/)?.[1]
            || (path.startsWith('/match-data/') ? req.body?.match_id : null);
        const teamKey = !matchId && path.match(/^\/(?:public\/|admin\/)?teams\/([^/]+)(?:\/|$)/)?.[1];
        const playerKey = !matchId && !teamKey && path.match(/^\/(?:public\/|admin\/)?players\/([^/]+)(?:\/|$)/)?.[1];
        const resolve = async (table, key) => {
            if (!key || /^\d+$/.test(key)) return key;
            if (!require('./publicId').uuidPattern.test(key)) return null;
            return (await db.query(`SELECT id FROM ${table} WHERE public_id=?`, [key])).rows[0]?.id;
        };
        const teamId = await resolve('teams', teamKey);
        const playerId = await resolve('players', playerKey);
        if (!matchId && !teamId && !playerId) return next();
        let rows;
        if (matchId) rows = (await db.query('SELECT * FROM matches WHERE id=? AND manual_owner_id IS NOT NULL', [matchId])).rows;
        else if (teamId) rows = (await db.query('SELECT m.* FROM matches m WHERE m.manual_owner_id IS NOT NULL AND (m.home_team_id=? OR m.away_team_id=?)', [teamId, teamId])).rows;
        else rows = (await db.query('SELECT m.* FROM matches m JOIN players p ON (p.team_id=m.home_team_id OR p.team_id=m.away_team_id) WHERE p.id=? AND m.manual_owner_id IS NOT NULL', [playerId])).rows;
        const match = rows[0];
        if (!match) return next();
        const read = ['GET', 'HEAD'].includes(req.method);
        const authorize = () => {
            // Statistics access never grants permission to scorer events, rosters or offline leases.
            if (matchId && canReadStatistics(req.user, match)) {
                if (read && /^\/scorer\/match\/\d+(?:\/(?:vis|roster|scoresheet|events|lineup|state|settings))?$/.test(path)) {
                    req.manualScorerMatch = match; return next();
                }
                if (/^\/scorer\/match\/\d+\/vis$/.test(path)) {
                    try { assertStatisticsWriter(req.user, match); }
                    catch (error) { return res.status(error.status).json({ error: error.message }); }
                    req.manualScorerMatch = match; return next();
                }
            }
            if (read && match.manual_published && match.manual_lifecycle !== 'draft') return next();
            if (!canManage(req.user, match) || !roleHasPermission(req.user?.role, 'match.score')) return res.status(404).json({ error: 'ไม่พบแมตช์ของบัญชีนี้' });
            if (!read) {
                if (match.manual_lifecycle === 'confirmed') return res.status(409).json({ error: 'แมตช์ยืนยันผลแล้ว ไม่สามารถแก้ไขได้' });
                if (match.manual_lifecycle === 'draft') return res.status(409).json({ error: 'กรุณาเตรียมรายชื่อและบันทึกแมตช์ให้พร้อมก่อนเปิดบันทึกคะแนน' });
                if (/offline|\/vis(?:\/|$)/.test(path)) return res.status(409).json({ error: 'แมตช์สร้างเองรองรับ Scorer แบบออนไลน์เท่านั้น' });
                if (/^\/(?:admin\/)?matches\//.test(path)) return res.status(409).json({ error: 'กรุณาจัดการแมตช์สร้างเองจากแดชบอร์ด Scorer' });
                if (/\/officials$/.test(path)) {
                    // The console may still update officials, but cannot change locked rules.
                    const config = parseConfig(match.manual_config);
                    if ((req.body.max_sets != null && Number(req.body.max_sets) !== config.maxSets)
                        || (req.body.has_challenge != null && Boolean(Number(req.body.has_challenge)) !== config.hasChallenge)) return res.status(409).json({ error: 'กรุณาแก้กติกาจากหน้าจัดการแมตช์ก่อนเริ่มการแข่งขัน' });
                }
            }
            req.manualScorerMatch = match;
            return next();
        };
        if (read && match.manual_published && match.manual_lifecycle !== 'draft') return next();
        // Reload role/status from the database; never trust stale JWT roles.
        return auth.verifyToken(req, res, () => auth.requireApprovedUser(req, res, () => {
            if(!match.competition_id)return authorize();
            return require('../utils/accessScope').assertCompetition(db,req.user,match.competition_id).then(authorize)
                .catch(error=>res.status(error.status||500).json({error:'No access to this competition'}));
        }));
    } catch (error) {
        console.error('Manual match access:', error);
        res.status(500).json({ error: 'ไม่สามารถตรวจสิทธิ์แมตช์ได้' });
    }
};
