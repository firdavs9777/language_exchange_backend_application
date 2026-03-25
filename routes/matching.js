const express = require('express');
const {
  getRecommendations,
  getQuickMatches,
  findByLanguage,
  getSimilarUsers
} = require('../controllers/matching');

const router = express.Router();
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Matching routes
router.get('/recommendations', getRecommendations);
router.get('/quick', getQuickMatches);
router.get('/language/:language', findByLanguage);
router.get('/similar/:userId', getSimilarUsers);

module.exports = router;
