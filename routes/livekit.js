const express = require('express');
const router = express.Router();

const { getTestToken, webhook } = require('../controllers/livekit');
const { protect } = require('../middleware/auth');
const { verifyLivekitWebhook } = require('../middleware/livekitWebhook');

// The webhook route uses raw body + its own signature verification,
// not protect (LiveKit doesn't carry a user JWT). MUST be registered
// before router.use(protect) below.
router.post(
  '/webhook',
  express.raw({ type: 'application/webhook+json' }),
  verifyLivekitWebhook,
  webhook
);

router.use(protect);

/**
 * @route   POST /api/v1/livekit/test-token
 * @desc    Smoke-test token endpoint — joins room 'smoke-test' by default
 */
router.post('/test-token', getTestToken);

module.exports = router;
