const express = require('express');
const router = express.Router();
const scorerController = require('../controllers/scorerController');
const authMiddleware = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const visController = require('../controllers/visController');
const matchController = require('../controllers/matchController');
const offline = require('../controllers/scorerOfflineController');
const visOffline = require('../controllers/officialVisOfflineController');
const manual = require('../controllers/manualScorerController');
const manualAccess = [authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches];
router.get('/manual-matches', manualAccess, manual.list);
router.post('/manual-matches', manualAccess, manual.save);
router.get('/manual-matches/:id', manualAccess, manual.read);
router.put('/manual-matches/:id', manualAccess, manual.save);
router.get('/manual-matches/:id/backup', manualAccess, manual.backup);
router.post('/manual-matches/:id/:action', manualAccess, manual.action);
router.post('/match/:matchId/vis-offline-checkout', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, visOffline.checkout);
router.post('/match/:matchId/vis-offline-cancel-checkout', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, visOffline.cancel);
router.post('/match/:matchId/vis-offline-sync', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, visOffline.sync);
router.post('/match/:matchId/vis-offline-release', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, visOffline.release);
router.get('/offline-permit', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, offline.permit);
router.get('/match/:matchId/offline-status', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, offline.status);
router.post('/match/:matchId/offline-checkout', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, offline.checkout);
router.post('/match/:matchId/offline-cancel-checkout', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, offline.cancelCheckout);
router.post('/match/:matchId/offline-sync', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, offline.sync);
router.post('/match/:matchId/offline-confirm', authMiddleware.verifyApprovedToken, authMiddleware.canScoreMatches, offline.confirm);
router.use('/match/:matchId', offline.guard);

// Public read endpoints used by scoreboards, score sheets, and viewer screens.
router.get('/match/:matchId', scorerController.getMatchDetails);
router.get('/match/:matchId/events', scorerController.getMatchEvents);
router.get('/match/:matchId/lineup', scorerController.getMatchLineup);
router.get('/match/:matchId/roster', scorerController.getMatchRosterData);
router.get('/match/:matchId/scoresheet', scorerController.getMatchScoresheetData);
router.get('/match/:matchId/state', scorerController.getLiveState);

// Mutating scorer endpoints are available to admins and scorer-console users.
const scorerWriteAccess = [authMiddleware.verifyToken, authMiddleware.canScoreMatches];
router.get('/matches', scorerWriteAccess, matchController.getAllMatches);
router.get('/match/:matchId/vis', scorerWriteAccess, visController.getState);
router.post('/match/:matchId/vis', scorerWriteAccess, visController.command);
router.post('/match/:matchId/event', scorerWriteAccess, validateRequest('scorerEvent'), offline.online('saveMatchEvent'));
router.post('/match/:matchId/toss', scorerWriteAccess, offline.online('saveCoinToss'));
router.post('/match/:matchId/lineup', scorerWriteAccess, offline.online('saveLineup'));
router.post('/match/:matchId/start-set', scorerWriteAccess, offline.online('startSet'));
router.post('/match/:matchId/end-set', scorerWriteAccess, offline.online('endSet'));
router.put('/match/:matchId/state', scorerWriteAccess, offline.online('updateLiveState'));
router.put('/match/:matchId/officials', scorerWriteAccess, offline.online('updateMatchOfficials'));
router.put('/match/:matchId/roster', scorerWriteAccess, offline.online('updateMatchRoster'));
router.post('/match/:matchId/teams/:teamId/players', scorerWriteAccess, offline.online('createMatchTeamPlayer'));
router.put('/match/:matchId/teams/:teamId/players/:playerId', scorerWriteAccess, offline.online('updateMatchTeamPlayer'));

const officialController = require('../controllers/officialController');

// Master data helpers are for logged-in scorer/admin workflows.
router.get('/referees', authMiddleware.verifyToken, officialController.getAllReferees);
router.get('/scorers', authMiddleware.verifyToken, officialController.getAllScorers);
router.get('/line-judges', authMiddleware.verifyToken, officialController.getAllLineJudges);

module.exports = router;
