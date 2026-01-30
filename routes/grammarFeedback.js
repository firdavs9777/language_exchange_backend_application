const express = require('express');
const router = express.Router();

const {
  requestFeedback,
  getFeedback,
  getHistory,
  markViewed,
  markApplied,
  explainRule,
  getStats,
  getCommonErrors,
  checkRateLimit
} = require('../controllers/grammarFeedback');

const { protect } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(protect);

// Static routes (before :id routes)
router.get('/history', getHistory);
router.get('/stats', getStats);
router.get('/common-errors', getCommonErrors);
router.get('/rate-limit', checkRateLimit);
router.post('/explain-rule', aiRateLimiter('grammar'), explainRule);

// Main feedback routes (AI rate limited for OpenAI calls)
router.post('/', aiRateLimiter('grammar'), requestFeedback);
router.get('/:id', getFeedback);
router.put('/:id/viewed', markViewed);
router.put('/:id/applied', markApplied);

module.exports = router;
