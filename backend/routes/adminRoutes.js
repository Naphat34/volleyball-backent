const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.verifyApprovedToken);
router.get('/vis/overview', authMiddleware.isAdmin, require('../controllers/adminVisController').overview);
router.use(authMiddleware.canManageTeams);

// Player Management Routes
router.post('/teams/:teamId/players', adminController.addPlayerToTeam);
router.put('/players/:id', adminController.updatePlayer);
router.delete('/players/:id', adminController.deletePlayer);

module.exports = router;
