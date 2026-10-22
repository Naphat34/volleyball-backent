const db = require('../config/db');
const auth = require('./authMiddleware');
const { canManage, parseConfig } = require('../utils/manualScorer');
const { roleHasPermission } = require('../config/permissions');

// Cover the existing console, viewer, report, team and legacy action routes.
module.exports = async (req, res, next) => {
    try {
        const path = req.path;
        const matchId = path.match(/^\/(?:scorer\/match|match|(?:admin\/)?matches)\/(\d+)(?:\/|$)/)?.[1]
            || (path.startsWith('/match-data/') ? req.body?.match_id : null);
        const teamId = !matchId && path.match(/^\/(?:public\/|admin\/)?teams\/(\d+)(?:\/|$)/)?.[1];
        const playerId = !matchId && !teamId && path.match(/^\/(?:public\/|admin\/)?players\/(\d+)(?:\/|$)/)?.[1];
        if (!matchId && !teamId && !playerId) return next();
        let rows;
        if (matchId) rows = (await db.query('SELECT * FROM matches WHERE id=? AND manual_owner_id IS NOT NULL', [matchId])).rows;
        else if (teamId) rows = (await db.query('SELECT m.* FROM matches m WHERE m.manual_owner_id IS NOT NULL AND (m.home_team_id=? OR m.away_team_id=?)', [teamId, teamId])).rows;
        else rows = (await db.query('SELECT m.* FROM matches m JOIN players p ON (p.team_id=m.home_team_id OR p.team_id=m.away_team_id) WHERE p.id=? AND m.manual_owner_id IS NOT NULL', [playerId])).rows;
        const match = rows[0];
        if (!match) return next();
        const read = ['GET', 'HEAD'].includes(req.method);
        const authorize = () => {
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
        return auth.verifyToken(req, res, () => auth.requireApprovedUser(req, res, authorize));
    } catch (error) {
        console.error('Manual match access:', error);
        res.status(500).json({ error: 'ไม่สามารถตรวจสิทธิ์แมตช์ได้' });
    }
};
