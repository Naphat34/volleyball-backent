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
const playerDocumentDir = path.join(__dirname, '..', 'private_player_documents');
const imageUploadFolders = {
  team_logo: 'team-logos',
  player_photo: 'player-photos',
  competition_logo: 'competition-logos'
};
const playerDocumentFolders = {
  identity_document_url: 'identity-documents',
  student_certificate_url: 'student-certificates',
  guardian_consent_url: 'guardian-consents'
};
const imageExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const documentExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

const buildUploadUrl = (req, folder, filename) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${folder}/${filename}`;
};

const saveImageUpload = async (req, image, category) => {
  const folder = imageUploadFolders[category];
  if (!folder) throw new Error('Select a valid image category');
  const match = typeof image === 'string'
    ? image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
    : null;
  if (!match) throw new Error('Invalid image data');

  const [, mimeType, base64Data] = match;
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 2 * 1024 * 1024) throw new Error('Image file must be 2MB or smaller');

  const targetDir = path.join(uploadDir, folder);
  await fs.mkdir(targetDir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${imageExtensions[mimeType]}`;
  await fs.writeFile(path.join(targetDir, filename), buffer);
  return buildUploadUrl(req, folder, filename);
};

// ==================================================================
// 1. 🔓 PUBLIC ROUTES (โซนนี้เข้าได้ทุกคน ไม่ต้อง Login)
// ==================================================================

// --- Authentication ---
router.post('/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'register' }), validateRequest('register'), authController.register);
router.post('/auth/register/team-logo', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'register-team-logo' }), validateRequest('uploadImage'), async (req, res) => {
  if (req.body.category !== 'team_logo') return res.status(400).json({ error: 'Select a valid image category' });
  try {
    const url = await saveImageUpload(req, req.body.image, 'team_logo');
    return res.json({ url });
  } catch (err) {
    const status = /2MB|valid image/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Image upload failed' });
  }
});
// Backward compatibility for registration pages still calling the original upload URL.
// Only team logos are public; other image categories continue to the authenticated route below.
router.post('/upload-image', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'register-team-logo' }), validateRequest('uploadImage'), async (req, res, next) => {
  if (req.body.category !== 'team_logo') return next();
  try {
    const url = await saveImageUpload(req, req.body.image, 'team_logo');
    return res.json({ url });
  } catch (err) {
    const status = /2MB|valid image/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Image upload failed' });
  }
});
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
router.get('/public/players/:id/stats', playerController.getPlayerStats);
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
router.get('/me', authController.getMe);
router.put('/me', validateRequest('updateMe'), authController.updateMe);
router.put('/me/password', validateRequest('changePassword'), authController.changeMyPassword);

router.post('/upload-image', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'upload-image' }), validateRequest('uploadImage'), async (req, res) => {
  try {
    const { image, category } = req.body;
    const url = await saveImageUpload(req, image, category);
    return res.json({ url });
  } catch (err) {
    console.error('Image upload failed:', err);
    const status = /2MB|valid image/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ error: err.message || 'Image upload failed' });
  }
});

router.post('/upload-player-document', authMiddleware.canManageOwnTeam, async (req, res) => {
  try {
    const { file, category } = req.body;
    const folder = playerDocumentFolders[category];
    if (!folder) return res.status(400).json({ error: 'Select a valid player document category' });
    const match = typeof file === 'string' ? file.match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!match) return res.status(400).json({ error: 'Upload a PDF, JPG, PNG, or WEBP file' });
    const [, mimeType, base64Data] = match;
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Document must be 5MB or smaller' });
    const targetDir = path.join(playerDocumentDir, folder);
    await fs.mkdir(targetDir, { recursive: true });
    const filename = `player-doc-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${documentExtensions[mimeType]}`;
    await fs.writeFile(path.join(targetDir, filename), buffer);
    res.json({ url: `/api/player-documents/${category}/${filename}` });
  } catch (err) {
    console.error('Player document upload failed:', err);
    res.status(500).json({ error: 'Document upload failed' });
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
router.get('/player-documents/:filename', authMiddleware.canManageOwnTeam, teamController.getMyPlayerDocument);
router.get('/player-documents/:category/:filename', authMiddleware.canManageOwnTeam, teamController.getMyPlayerDocument);
router.post('/my-team/players', authMiddleware.canManageOwnTeam, teamController.addPlayerToMyTeam);
router.put('/my-team/players/:id', authMiddleware.canManageOwnTeam, teamController.updatePlayer);
router.delete('/my-team/players/:id', authMiddleware.canManageOwnTeam, teamController.deletePlayer);
router.get('/my-team/players/stats', teamController.getMyPlayersStats);
router.get('/my-team/staff', authMiddleware.canManageOwnTeam, teamController.getMyTeamStaff);
router.post('/my-team/staff', authMiddleware.canManageOwnTeam, teamController.addStaffToMyTeam);
router.put('/my-team/staff/:id', authMiddleware.canManageOwnTeam, teamController.updateStaff);
router.put('/my-team/staff/:id/entries', authMiddleware.canManageOwnTeam, teamController.updateMyStaffEntries);
router.delete('/my-team/staff/:id', authMiddleware.canManageOwnTeam, teamController.deleteStaff);
router.get('/my-team/competitions', competitionsController.getMyCompetitions);
router.get('/my-team/entries', competitionsController.getMyTeamEntries);
router.get('/my-team/entries/:entryId/players', competitionsController.getMyTeamEntryPlayers);
router.put('/my-team/entries/:entryId/players', authMiddleware.canManageOwnTeam, competitionsController.updateMyTeamEntryPlayers);
router.get('/my-team/entries/:entryId/staff', authMiddleware.canManageOwnTeam, competitionsController.getMyTeamEntryStaff);
router.put('/my-team/entries/:entryId/staff', authMiddleware.canManageOwnTeam, competitionsController.updateMyTeamEntryStaff);
router.post('/competitions/join', authMiddleware.canManageOwnTeam, competitionsController.joinCompetition);
router.post('/competitions/leave', authMiddleware.canManageOwnTeam, competitionsController.leaveCompetition);

// --- Matches & Stats ---
router.get('/competitions/:competitionId/matches', matchController.getMatchesByCompetition);
router.get('/players/:id/stats', playerController.getPlayerStats);
router.post('/match-data/lineup', authMiddleware.canScoreMatches, matchController.saveLineup);
router.post('/match-data/action', authMiddleware.canScoreMatches, matchController.saveMatchAction);

// --- Staff Requests & Lineup helpers ---
router.get('/match/:matchId/requests/pending', authMiddleware.canViewPendingMatchRequests, matchController.getPendingRequests);
router.post('/match/:matchId/request', authMiddleware.canAccessOwnMatchTeam({ allowScorer: false, teamParam: 'team_id' }), matchController.createRequest);
router.put('/match/:matchId/requests/:requestId', authMiddleware.canViewPendingMatchRequests, matchController.updateRequest);
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
router.delete('/admin/competitions/:competitionId/teams/:teamId', authMiddleware.canManageCompetitions, competitionsController.removeTeamFromCompetition);
router.get('/admin/competitions/:competitionId/matches', authMiddleware.canManageMatches, matchController.getMatchesByCompetition);

// --- Admin: Users ---
router.get('/admin/pending-users', authMiddleware.isAdmin, authController.getPendingUsers);
router.post('/admin/approve', authMiddleware.isAdmin, authController.approveUser);
router.get('/admin/users', authMiddleware.isAdmin, authController.getAllUsers);
router.post('/admin/users', authMiddleware.isAdmin, authController.createUser);
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
