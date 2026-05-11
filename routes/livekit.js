const express = require('express');
const router = express.Router();

const { getTestToken } = require('../controllers/livekit');
const { protect } = require('../middleware/auth');

router.use(protect);

/**
 * @route   POST /api/v1/livekit/test-token
 * @desc    Smoke-test token endpoint — joins room 'smoke-test' by default
 */
router.post('/test-token', getTestToken);

module.exports = router;
