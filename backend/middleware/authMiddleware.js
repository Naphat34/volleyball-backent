const jwt = require('jsonwebtoken');
require('dotenv').config();
const { getJwtSecret } = require('../config/security');
const { normalizeRole, roleHasPermission } = require('../config/permissions');
const db = require('../config/db');

const SECRET_KEY = getJwtSecret();
const APPROVED_STATUSES = new Set(['approved', 'active']);

// 1. เช็คว่า Login หรือยัง (Verify Token)
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;

  if (!cookieToken && (!authHeader || !authHeader.startsWith('Bearer '))) {
    return res.status(401).json({ error: 'Access Denied: No Token Provided' });
  }
  const token = cookieToken || (authHeader && authHeader.split(' ')[1]); // แยก Token ออกจาก "Bearer "

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid Token' });
  }
};

// 2. เช็คว่าเป็น Admin ไหม
exports.isAdmin = (req, res, next) => {
  if (!roleHasPermission(req.user.role, 'admin.manage')) {
    return res.status(403).json({ error: 'Admin Only' });
  }
  next();
};

exports.hasAnyRole = (allowedRoles = []) => (req, res, next) => {
  const role = normalizeRole(req.user?.role);
  const normalizedAllowedRoles = allowedRoles.map(normalizeRole);
  if (!normalizedAllowedRoles.includes(role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

exports.hasPermission = (permission) => (req, res, next) => {
  if (!req.user || !roleHasPermission(req.user.role, permission)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

exports.requireApprovedUser = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Access Denied: No Token Provided' });

    const result = await db.query(
      'SELECT status, role, team_id FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!APPROVED_STATUSES.has(String(user.status || '').toLowerCase())) {
      return res.status(403).json({ error: 'Account is not approved' });
    }

    req.user.role = user.role;
    req.user.team_id = user.team_id;
    next();
  } catch (err) {
    console.error('Approved user check failed:', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

exports.verifyApprovedToken = [
  exports.verifyToken,
  exports.requireApprovedUser,
];

exports.canManageOwnTeam = exports.hasPermission('team.self.manage');
exports.canRequestMatchChanges = exports.hasPermission('match.request');

exports.canAccessOwnMatchTeam = ({ allowScorer = true, teamParam = 'teamId', matchParam = 'matchId' } = {}) => async (req, res, next) => {
  try {
    if (allowScorer && roleHasPermission(req.user?.role, 'match.score')) return next();

    if (!roleHasPermission(req.user?.role, 'match.request') && !roleHasPermission(req.user?.role, 'team.self.manage')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const matchId = req.params[matchParam] || req.body.match_id;
    const requestedTeamId = req.params[teamParam] || req.body.team_id;
    if (!matchId || !requestedTeamId) {
      return res.status(400).json({ error: 'Match ID and team ID are required' });
    }

    const userTeamId = req.user?.team_id;
    if (!userTeamId || String(userTeamId) !== String(requestedTeamId)) {
      return res.status(403).json({ error: 'You can only access your own team in this match' });
    }

    const matchRes = await db.query(
      'SELECT home_team_id, away_team_id FROM matches WHERE id = ?',
      [matchId]
    );
    const match = matchRes.rows[0];
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (String(match.home_team_id) !== String(userTeamId) && String(match.away_team_id) !== String(userTeamId)) {
      return res.status(403).json({ error: 'Your team is not part of this match' });
    }

    next();
  } catch (err) {
    console.error('Match team authorization failed:', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

exports.isScorerOrAdmin = exports.hasAnyRole(['admin', 'score', 'scorer']);
exports.canManageCompetitions = exports.hasPermission('competition.manage');
exports.canManageTeams = exports.hasPermission('team.manage');
exports.canManageMatches = exports.hasPermission('match.manage');
exports.canScoreMatches = exports.hasPermission('match.score');
exports.canExportReports = exports.hasPermission('report.export');
exports.canMonitorSockets = exports.hasPermission('socket.monitor');
