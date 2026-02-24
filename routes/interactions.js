const express = require('express');
const {
  skipUser,
  waveUser,
  getSkippedUsers,
  getWavedUsers,
  getExcludedUsers,
  undoSkip,
  getReceivedWaves,
  markWavesAsSeen,
  batchInteractions,
  clearAllSkips
} = require('../controllers/interactions');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Skip interactions
router.post('/skip', skipUser);
router.get('/skipped', getSkippedUsers);
router.delete('/skip/:targetUserId', undoSkip);
router.delete('/skips/clear', clearAllSkips);

// Wave interactions
router.post('/wave', waveUser);
router.get('/waved', getWavedUsers);
router.get('/waves/received', getReceivedWaves);
router.put('/waves/seen', markWavesAsSeen);

// Combined
router.get('/excluded', getExcludedUsers);
router.post('/batch', batchInteractions);

module.exports = router;
