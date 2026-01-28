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

// All routes require authentication
router.use(protect);

// Static routes (before :id routes)
router.get('/history', getHistory);
router.get('/stats', getStats);
router.get('/common-errors', getCommonErrors);
router.get('/rate-limit', checkRateLimit);
router.post('/explain-rule', explainRule);

// Main feedback routes
router.post('/', requestFeedback);
router.get('/:id', getFeedback);
router.put('/:id/viewed', markViewed);
router.put('/:id/applied', markApplied);

module.exports = router;
