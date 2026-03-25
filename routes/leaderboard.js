const express = require('express');
const {
  getXPLeaderboard,
  getStreakLeaderboard,
  getLanguageLeaderboard,
  getMyRanks,
  getFriendsLeaderboard
} = require('../controllers/leaderboard');

const router = express.Router();
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Leaderboard routes
router.get('/xp', getXPLeaderboard);
router.get('/streaks', getStreakLeaderboard);
router.get('/language/:language', getLanguageLeaderboard);
router.get('/me', getMyRanks);
router.get('/friends', getFriendsLeaderboard);

module.exports = router;
