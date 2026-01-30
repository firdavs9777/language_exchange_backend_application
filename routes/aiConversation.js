const express = require('express');
const router = express.Router();

const {
  startConversation,
  sendMessage,
  endConversation,
  getConversation,
  getUserConversations,
  getTopics,
  getScenarios,
  getStats,
  checkRateLimit
} = require('../controllers/aiConversation');

const { protect } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(protect);

// Static routes (before :id routes)
router.get('/topics', getTopics);
router.get('/scenarios', getScenarios);
router.get('/stats', getStats);
router.get('/rate-limit', checkRateLimit);

// Conversation CRUD (AI rate limited for OpenAI calls)
router.post('/start', aiRateLimiter('conversation'), startConversation);
router.get('/', getUserConversations);
router.get('/:id', getConversation);
router.post('/:id/message', aiRateLimiter('conversation'), sendMessage);
router.post('/:id/end', endConversation);

module.exports = router;
