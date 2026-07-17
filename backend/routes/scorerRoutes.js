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

// Mutating scorer endpoints require an authenticated user.
router.post('/match/:matchId/event', authMiddleware.verifyToken, scorerController.saveMatchEvent);
router.post('/match/:matchId/toss', authMiddleware.verifyToken, scorerController.saveCoinToss);
router.post('/match/:matchId/lineup', authMiddleware.verifyToken, scorerController.saveLineup);
router.post('/match/:matchId/start-set', authMiddleware.verifyToken, scorerController.startSet);
router.post('/match/:matchId/end-set', authMiddleware.verifyToken, scorerController.endSet);
router.put('/match/:matchId/state', authMiddleware.verifyToken, scorerController.updateLiveState);
router.put('/match/:matchId/officials', authMiddleware.verifyToken, scorerController.updateMatchOfficials);
router.put('/match/:matchId/roster', authMiddleware.verifyToken, scorerController.updateMatchRoster);

const officialController = require('../controllers/officialController');

// Master data helpers are for logged-in scorer/admin workflows.
router.get('/referees', authMiddleware.verifyToken, officialController.getAllReferees);
router.get('/scorers', authMiddleware.verifyToken, officialController.getAllScorers);
router.get('/line-judges', authMiddleware.verifyToken, officialController.getAllLineJudges);

module.exports = router;
