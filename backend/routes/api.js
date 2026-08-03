const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

// --- Imports Middleware ---
const authMiddleware = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimiter');
const validateRequest = require('../middleware/validateRequest');

// --- Imports Controllers ---
const publicController = require('../controllers/publicController');
const authController = require('../controllers/authController');
const teamController = require('../controllers/teamController');
const matchController = require('../controllers/matchController');
const competitionsController = require('../controllers/competitionsController');
const ageGroupController = require('../controllers/ageGroupController');
const playerController = require('../controllers/playerController');
const stadiumsController = require('../controllers/stadiumsController');
const reportController = require('../controllers/reportController');
const officialRoutes = require('./officialRoutes');
const scorerRoutes = require('./scorerRoutes');

const uploadDir = path.join(__dirname, '..', 'uploads');
const imageExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const buildUploadUrl = (req, filename) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${filename}`;
};

// ==================================================================
// 1. 🔓 PUBLIC ROUTES (โซนนี้เข้าได้ทุกคน ไม่ต้อง Login)
// ==================================================================

// --- Authentication ---
router.post('/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'register' }), validateRequest('register'), authController.register);
router.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'login' }), validateRequest('login'), authController.login);
router.post('/auth/logout', authController.logout);



// --- Dropdowns / Master Data ---
router.get('/age-groups', ageGroupController.getAllAgeGroups);
router.get('/competitions/open', competitionsController.getOpenCompetitions);

// --- Public Data Display (Guest Pages) ---

router.get('/public/competitions', publicController.getCompetitions);
router.get('/public/teams', publicController.getAllTeams);

// -- Specific Data --
router.get('/public/competitions/:competitionId/teams', publicController.getCompetitionTeams);
router.get('/public/teams/:teamId/players', publicController.getTeamPlayers);
router.get('/public/matches', publicController.getMatches);
router.get('/public/teams/:teamId/staff', publicController.getTeamStaff);
router.get('/public/statistics/:competitionId', publicController.getStatistics);

// ==================================================================
// 🚧 MIDDLEWARE BARRIER (หลังจากบรรทัดนี้ ต้อง Login เท่านั้น)
// ==================================================================
router.use(authMiddleware.verifyApprovedToken); 

// --- Scorer Routes (เพิ่มส่วนนี้) ---
router.use('/scorer', scorerRoutes);


// ==================================================================
// 2. 🔐 PROTECTED ROUTES (โซนนี้ต้อง Login แล้วเท่านั้น)
// ==================================================================

// --- User / My Team ---
router.post('/upload-image', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'upload-image' }), validateRequest('uploadImage'), async (req, res) => {
  try {
    const { image } = req.body;
    const match = typeof image === 'string'
      ? image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
      : null;

    if (!match) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    const [, mimeType, base64Data] = match;
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image file must be 2MB or smaller' });
    }

    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${imageExtensions[mimeType]}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);

    res.json({ url: buildUploadUrl(req, filename) });
  } catch (err) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

router.get('/my-team', teamController.getMyTeam);
router.get('/my-teams', teamController.getMyTeams);
router.post('/my-team/create', authMiddleware.canManageOwnTeam, teamController.createMyTeam);
router.post('/my-team/:id/switch', authMiddleware.canManageOwnTeam, teamController.switchMyTeam);
router.put('/my-team', authMiddleware.canManageOwnTeam, teamController.updateMyTeam);
router.delete('/my-team', authMiddleware.canManageOwnTeam, teamController.deleteMyTeam);
router.get('/my-team/matches', teamController.getMyMatches);
router.get('/my-team/matches/:gender', teamController.getMyMatchesByGender);
router.get('/my-team/players', authMiddleware.canManageOwnTeam, teamController.getMyPlayers);
router.post('/my-team/players', authMiddleware.canManageOwnTeam, teamController.addPlayerToMyTeam);
router.put('/my-team/players/:id', authMiddleware.canManageOwnTeam, teamController.updatePlayer);
router.delete('/my-team/players/:id', authMiddleware.canManageOwnTeam, teamController.deletePlayer);
router.get('/my-team/players/stats', teamController.getMyPlayersStats);
router.get('/my-team/staff', authMiddleware.canManageOwnTeam, teamController.getMyTeamStaff);
router.post('/my-team/staff', authMiddleware.canManageOwnTeam, teamController.addStaffToMyTeam);
router.put('/my-team/staff/:id', authMiddleware.canManageOwnTeam, teamController.updateStaff);
router.delete('/my-team/staff/:id', authMiddleware.canManageOwnTeam, teamController.deleteStaff);
router.get('/my-team/competitions', competitionsController.getMyCompetitions);
router.get('/my-team/entries', competitionsController.getMyTeamEntries);
router.get('/my-team/entries/:entryId/players', competitionsController.getMyTeamEntryPlayers);
router.put('/my-team/entries/:entryId/players', authMiddleware.canManageOwnTeam, competitionsController.updateMyTeamEntryPlayers);
router.post('/competitions/join', authMiddleware.canManageOwnTeam, competitionsController.joinCompetition);
router.post('/competitions/leave', authMiddleware.canManageOwnTeam, competitionsController.leaveCompetition);

// --- Matches & Stats ---
router.get('/competitions/:competitionId/matches', matchController.getMatchesByCompetition);
router.get('/players/:id/stats', playerController.getPlayerStats);
router.post('/match-data/lineup', authMiddleware.canScoreMatches, matchController.saveLineup);
router.post('/match-data/action', authMiddleware.canScoreMatches, matchController.saveMatchAction);

// --- Staff Requests & Lineup helpers ---
router.get('/match/:matchId/requests/pending', authMiddleware.canScoreMatches, matchController.getPendingRequests);
router.post('/match/:matchId/request', authMiddleware.canAccessOwnMatchTeam({ allowScorer: false, teamParam: 'team_id' }), matchController.createRequest);
router.put('/match/:matchId/requests/:requestId', authMiddleware.canScoreMatches, matchController.updateRequest);
router.get('/match/:matchId/lineup/:teamId', authMiddleware.canAccessOwnMatchTeam(), matchController.getTeamLineup);
router.delete('/match/:matchId/lineup/:teamId', authMiddleware.canScoreMatches, matchController.deleteTeamLineup);

// --- Reports ---
router.get('/reports/:type.:format', authMiddleware.canExportReports, reportController.exportReport);

// --- Monitoring ---
router.get('/monitor/socket', authMiddleware.canMonitorSockets, (req, res) => {
  const monitor = req.app.get('socketMonitor');
  res.json(monitor ? monitor.snapshot() : { error: 'Socket monitor is not available' });
});

// ==================================================================
// 3. 🛡️ ADMIN ROUTES (ต้องเป็น Admin เท่านั้น)
// ==================================================================

// --- Admin: Competitions ---
router.get('/admin/competitions', authMiddleware.canManageCompetitions, competitionsController.getAllCompetitions);
router.post('/admin/competitions', authMiddleware.canManageCompetitions, competitionsController.createCompetition);
router.put('/admin/competitions/:id', authMiddleware.canManageCompetitions, competitionsController.updateCompetition);
router.delete('/admin/competitions/:id', authMiddleware.canManageCompetitions, competitionsController.deleteCompetition);
router.patch('/admin/competitions/:id/status', authMiddleware.canManageCompetitions, competitionsController.toggleCompetitionStatus);
router.get('/admin/competitions/:competitionId/teams', authMiddleware.canManageCompetitions, competitionsController.getCompetitionTeams);
router.get('/admin/competitions/:competitionId/matches', authMiddleware.canManageMatches, matchController.getMatchesByCompetition);

// --- Admin: Users ---
router.get('/admin/pending-users', authMiddleware.isAdmin, authController.getPendingUsers);
router.post('/admin/approve', authMiddleware.isAdmin, authController.approveUser);
router.get('/admin/users', authMiddleware.isAdmin, authController.getAllUsers);
router.delete('/admin/users/:id', authMiddleware.isAdmin, authController.deleteUser);
router.put('/admin/users/:id', authMiddleware.isAdmin, authController.updateUser);

// --- Admin: Teams ---
router.get('/admin/teams', authMiddleware.canManageTeams, teamController.getAllTeams);
router.get('/admin/team-entries', authMiddleware.canManageTeams, teamController.getAllTeamEntries);
router.patch('/admin/team-entries/:entryId/status', authMiddleware.canManageTeams, teamController.updateTeamEntryStatus);
router.post('/admin/teams', authMiddleware.canManageTeams, teamController.createTeam);
router.put('/admin/teams/:id', authMiddleware.canManageTeams, teamController.updateTeam);
router.delete('/admin/teams/:id', authMiddleware.canManageTeams, teamController.deleteTeam);
router.get('/admin/teams/:id', authMiddleware.canManageTeams, teamController.getTeamDetails);
router.get('/admin/players', authMiddleware.canManageTeams, teamController.getAllPlayers);
router.get('/admin/teams/:id/players', authMiddleware.canManageTeams, teamController.getPlayersByTeam);
router.get('/admin/teams/:id/staff', authMiddleware.canManageTeams, teamController.getStaffByTeam);

// --- Admin: Matches ---
router.get('/admin/matches/all', authMiddleware.canManageMatches, matchController.getAllMatches);
router.post('/matches', authMiddleware.canManageMatches, validateRequest('createMatch'), matchController.createMatch);
router.put('/matches/:id', authMiddleware.canManageMatches, matchController.updateMatch);
router.delete('/matches/:id', authMiddleware.canManageMatches, matchController.deleteMatch);
router.put('/matches/:id/result', authMiddleware.canScoreMatches, validateRequest('updateMatchResult'), matchController.updateMatchResult);
router.post('/competitions/:competitionId/generate-matches', authMiddleware.canManageMatches, matchController.generateFixtures);

// --- Admin: Stadiums ---
router.get('/admin/stadiums', authMiddleware.canManageCompetitions, stadiumsController.getAllStadiums);
router.post('/admin/stadiums', authMiddleware.canManageCompetitions, stadiumsController.createStadium);
router.put('/admin/stadiums/:id', authMiddleware.canManageCompetitions, stadiumsController.updateStadium);
router.delete('/admin/stadiums/:id', authMiddleware.canManageCompetitions, stadiumsController.deleteStadium);

// --- Admin: Officials (Use Router) ---
router.use('/admin', authMiddleware.canManageCompetitions, officialRoutes);



module.exports = router;
