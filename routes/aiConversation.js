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

// All routes require authentication
router.use(protect);

// Static routes (before :id routes)
router.get('/topics', getTopics);
router.get('/scenarios', getScenarios);
router.get('/stats', getStats);
router.get('/rate-limit', checkRateLimit);

// Conversation CRUD
router.post('/start', startConversation);
router.get('/', getUserConversations);
router.get('/:id', getConversation);
router.post('/:id/message', sendMessage);
router.post('/:id/end', endConversation);

module.exports = router;
