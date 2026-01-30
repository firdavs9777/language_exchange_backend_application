const express = require('express');
const router = express.Router();

const {
  getNearbyUsers,
  sendWave,
  getWaves,
  markWavesAsRead,
  getTopics,
  getTopicUsers,
  updateMyTopics,
  seedTopics
} = require('../controllers/community');

const { protect, authorize } = require('../middleware/auth');
const { interactionLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(protect);

// ============================================
// NEARBY USERS
// ============================================

/**
 * @route   GET /api/v1/community/nearby
 * @desc    Get nearby users based on location
 * @query   latitude, longitude, radius (km), limit, offset, language, minAge, maxAge, gender, onlineOnly
 */
router.get('/nearby', getNearbyUsers);

// ============================================
// WAVES
// ============================================

/**
 * @route   POST /api/v1/community/wave
 * @desc    Send a wave to another user
 * @body    { targetUserId, message? }
 */
router.post('/wave', interactionLimiter, sendWave);

/**
 * @route   GET /api/v1/community/waves
 * @desc    Get waves received by current user
 * @query   page, limit, unreadOnly
 */
router.get('/waves', getWaves);

/**
 * @route   PUT /api/v1/community/waves/read
 * @desc    Mark waves as read
 * @body    { waveIds?: string[] }
 */
router.put('/waves/read', markWavesAsRead);

// ============================================
// TOPICS
// ============================================

/**
 * @route   GET /api/v1/community/topics
 * @desc    Get all community topics
 * @query   category, lang
 */
router.get('/topics', getTopics);

/**
 * @route   GET /api/v1/community/topics/:topicId/users
 * @desc    Get users interested in a specific topic
 * @query   page, limit
 */
router.get('/topics/:topicId/users', getTopicUsers);

/**
 * @route   PUT /api/v1/community/topics/my
 * @desc    Update current user's topics
 * @body    { topics: string[] }
 */
router.put('/topics/my', updateMyTopics);

/**
 * @route   POST /api/v1/community/topics/seed
 * @desc    Seed default topics (admin only)
 */
router.post('/topics/seed', authorize('admin'), seedTopics);

module.exports = router;
