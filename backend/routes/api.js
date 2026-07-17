const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

// --- Imports Middleware ---
const authMiddleware = require('../middleware/authMiddleware');

// --- Imports Controllers ---
const publicController = require('../controllers/publicController');
const authController = require('../controllers/authController');
const teamController = require('../controllers/teamController');
const matchController = require('../controllers/matchController');
const competitionsController = require('../controllers/competitionsController');
const ageGroupController = require('../controllers/ageGroupController');
const playerController = require('../controllers/playerController');
const stadiumsController = require('../controllers/stadiumsController');
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

router.get('/debug/players', async (req, res) => {
  try {
    const db = require('../config/db');
    const cols = await db.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'players' AND table_schema = 'public'"
    );
    const rows = await db.query(
      "SELECT * FROM players LIMIT 5"
    );
    res.json({
      columns: cols.rows,
      rows: rows.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Authentication ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
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
router.use(authMiddleware.verifyToken); 

// --- Scorer Routes (เพิ่มส่วนนี้) ---
router.use('/scorer', scorerRoutes);


// ==================================================================
// 2. 🔐 PROTECTED ROUTES (โซนนี้ต้อง Login แล้วเท่านั้น)
// ==================================================================

// --- User / My Team ---
router.post('/upload-image', async (req, res) => {
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
router.post('/my-team/create', teamController.createMyTeam);
router.post('/my-team/:id/switch', teamController.switchMyTeam);
router.put('/my-team', teamController.updateMyTeam);
router.delete('/my-team', teamController.deleteMyTeam);
router.get('/my-team/matches', teamController.getMyMatches);
router.get('/my-team/matches/:gender', teamController.getMyMatchesByGender);
router.get('/my-team/players', teamController.getMyPlayers);
router.post('/my-team/players', teamController.addPlayerToMyTeam);
router.put('/my-team/players/:id', teamController.updatePlayer);
router.delete('/my-team/players/:id', teamController.deletePlayer);
router.get('/my-team/players/stats', teamController.getMyPlayersStats);
router.get('/my-team/staff', teamController.getMyTeamStaff);
router.post('/my-team/staff', teamController.addStaffToMyTeam);
router.put('/my-team/staff/:id', teamController.updateStaff);
router.delete('/my-team/staff/:id', teamController.deleteStaff);
router.get('/my-team/competitions', competitionsController.getMyCompetitions);
router.get('/my-team/entries', competitionsController.getMyTeamEntries);
router.get('/my-team/entries/:entryId/players', competitionsController.getMyTeamEntryPlayers);
router.put('/my-team/entries/:entryId/players', competitionsController.updateMyTeamEntryPlayers);
router.post('/competitions/join', competitionsController.joinCompetition);
router.post('/competitions/leave', competitionsController.leaveCompetition);

// --- Matches & Stats ---
router.get('/competitions/:competitionId/matches', matchController.getMatchesByCompetition);
router.get('/players/:id/stats', playerController.getPlayerStats);
router.post('/match-data/lineup', matchController.saveLineup);
router.post('/match-data/action', matchController.saveMatchAction);

// --- Staff Requests & Lineup helpers ---
router.get('/match/:matchId/requests/pending', matchController.getPendingRequests);
router.post('/match/:matchId/request', matchController.createRequest);
router.put('/match/:matchId/requests/:requestId', matchController.updateRequest);
router.get('/match/:matchId/lineup/:teamId', matchController.getTeamLineup);
router.delete('/match/:matchId/lineup/:teamId', matchController.deleteTeamLineup);

// ==================================================================
// 3. 🛡️ ADMIN ROUTES (ต้องเป็น Admin เท่านั้น)
// ==================================================================

// --- Admin: Competitions ---
router.get('/admin/competitions', authMiddleware.isAdmin, competitionsController.getAllCompetitions);
router.post('/admin/competitions', authMiddleware.isAdmin, competitionsController.createCompetition);
router.put('/admin/competitions/:id', authMiddleware.isAdmin, competitionsController.updateCompetition);
router.delete('/admin/competitions/:id', authMiddleware.isAdmin, competitionsController.deleteCompetition);
router.patch('/admin/competitions/:id/status', authMiddleware.isAdmin, competitionsController.toggleCompetitionStatus);
router.get('/admin/competitions/:competitionId/teams', authMiddleware.isAdmin, competitionsController.getCompetitionTeams);
router.get('/admin/competitions/:competitionId/matches', authMiddleware.isAdmin, matchController.getMatchesByCompetition);

// --- Admin: Users ---
router.get('/admin/pending-users', authMiddleware.isAdmin, authController.getPendingUsers);
router.post('/admin/approve', authMiddleware.isAdmin, authController.approveUser);
router.get('/admin/users', authMiddleware.isAdmin, authController.getAllUsers);
router.delete('/admin/users/:id', authMiddleware.isAdmin, authController.deleteUser);
router.put('/admin/users/:id', authMiddleware.isAdmin, authController.updateUser);

// --- Admin: Teams ---
router.get('/admin/teams', authMiddleware.isAdmin, teamController.getAllTeams);
router.get('/admin/team-entries', authMiddleware.isAdmin, teamController.getAllTeamEntries);
router.patch('/admin/team-entries/:entryId/status', authMiddleware.isAdmin, teamController.updateTeamEntryStatus);
router.post('/admin/teams', authMiddleware.isAdmin, teamController.createTeam);
router.put('/admin/teams/:id', authMiddleware.isAdmin, teamController.updateTeam);
router.delete('/admin/teams/:id', authMiddleware.isAdmin, teamController.deleteTeam);
router.get('/admin/teams/:id', authMiddleware.isAdmin, teamController.getTeamDetails);
router.get('/admin/players', authMiddleware.isAdmin, teamController.getAllPlayers);
router.get('/admin/teams/:id/players', authMiddleware.isAdmin, teamController.getPlayersByTeam);
router.get('/admin/teams/:id/staff', authMiddleware.isAdmin, teamController.getStaffByTeam);

// --- Admin: Matches ---
router.get('/admin/matches/all', authMiddleware.isAdmin, matchController.getAllMatches);
router.post('/matches', authMiddleware.isAdmin, matchController.createMatch);
router.put('/matches/:id', authMiddleware.isAdmin, matchController.updateMatch);
router.delete('/matches/:id', authMiddleware.isAdmin, matchController.deleteMatch);
router.put('/matches/:id/result', authMiddleware.isAdmin, matchController.updateMatchResult);
router.post('/competitions/:competitionId/generate-matches', authMiddleware.isAdmin, matchController.generateFixtures);

// --- Admin: Stadiums ---
router.get('/admin/stadiums', authMiddleware.isAdmin, stadiumsController.getAllStadiums);
router.post('/admin/stadiums', authMiddleware.isAdmin, stadiumsController.createStadium);
router.put('/admin/stadiums/:id', authMiddleware.isAdmin, stadiumsController.updateStadium);
router.delete('/admin/stadiums/:id', authMiddleware.isAdmin, stadiumsController.deleteStadium);

// --- Admin: Officials (Use Router) ---
router.use('/admin', authMiddleware.isAdmin, officialRoutes);



module.exports = router;
