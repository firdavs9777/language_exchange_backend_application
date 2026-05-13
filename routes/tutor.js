const express = require('express');
const router = express.Router();

const {
  getMyMemory,
  setPersona,
  getDailyPlan,
  completeTask,
  listSessions,
  getSession,
  startSession,
  sendMessage,
  endSession,
} = require('../controllers/tutor');

const { protect } = require('../middleware/auth');
const { tutorMessageLimiter } = require('../middleware/rateLimiter');

router.use(protect);

/**
 * @route   GET /api/v1/tutor/me
 */
router.get('/me', getMyMemory);

/**
 * @route   PUT /api/v1/tutor/persona
 */
router.put('/persona', setPersona);

/**
 * @route   GET /api/v1/tutor/daily-plan
 */
router.get('/daily-plan', getDailyPlan);

/**
 * @route   PATCH /api/v1/tutor/daily-plan/task/:type/complete
 */
router.patch('/daily-plan/task/:type/complete', completeTask);

/**
 * @route   GET /api/v1/tutor/sessions
 */
router.get('/sessions', listSessions);

/**
 * @route   POST /api/v1/tutor/sessions
 */
router.post('/sessions', startSession);

/**
 * @route   GET /api/v1/tutor/sessions/:id
 */
router.get('/sessions/:id', getSession);

/**
 * @route   POST /api/v1/tutor/sessions/:id/message
 * @access  Private + dedicated 30/min/user limiter to cap OpenAI cost
 */
router.post('/sessions/:id/message', tutorMessageLimiter, sendMessage);

/**
 * @route   POST /api/v1/tutor/sessions/:id/end
 */
router.post('/sessions/:id/end', endSession);

module.exports = router;
