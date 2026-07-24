const express = require('express');
const router = express.Router();
const scorerController = require('../controllers/scorerController');
const authMiddleware = require('../middleware/authMiddleware');

// Public read endpoints used by scoreboards, score sheets, and viewer screens.
router.get('/match/:matchId', scorerController.getMatchDetails);
router.get('/match/:matchId/events', scorerController.getMatchEvents);
router.get('/match/:matchId/lineup', scorerController.getMatchLineup);
router.get('/match/:matchId/roster', scorerController.getMatchRosterData);
router.get('/match/:matchId/scoresheet', scorerController.getMatchScoresheetData);
router.get('/match/:matchId/state', scorerController.getLiveState);

// Mutating scorer endpoints are available to admins and scorer-console users.
const scorerWriteAccess = [authMiddleware.verifyToken, authMiddleware.isScorerOrAdmin];
router.post('/match/:matchId/event', scorerWriteAccess, scorerController.saveMatchEvent);
router.post('/match/:matchId/toss', scorerWriteAccess, scorerController.saveCoinToss);
router.post('/match/:matchId/lineup', scorerWriteAccess, scorerController.saveLineup);
router.post('/match/:matchId/start-set', scorerWriteAccess, scorerController.startSet);
router.post('/match/:matchId/end-set', scorerWriteAccess, scorerController.endSet);
router.put('/match/:matchId/state', scorerWriteAccess, scorerController.updateLiveState);
router.put('/match/:matchId/officials', scorerWriteAccess, scorerController.updateMatchOfficials);
router.put('/match/:matchId/roster', scorerWriteAccess, scorerController.updateMatchRoster);
router.post('/match/:matchId/teams/:teamId/players', scorerWriteAccess, scorerController.createMatchTeamPlayer);
router.put('/match/:matchId/teams/:teamId/players/:playerId', scorerWriteAccess, scorerController.updateMatchTeamPlayer);

const officialController = require('../controllers/officialController');

// Master data helpers are for logged-in scorer/admin workflows.
router.get('/referees', authMiddleware.verifyToken, officialController.getAllReferees);
router.get('/scorers', authMiddleware.verifyToken, officialController.getAllScorers);
router.get('/line-judges', authMiddleware.verifyToken, officialController.getAllLineJudges);

module.exports = router;
