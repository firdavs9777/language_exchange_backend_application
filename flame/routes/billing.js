const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

// IAP/subscriptions aren't implemented yet. Return a valid "free" status so the
// client doesn't 404. Wire real subscription state when in-app purchases land.
router.get('/status', auth, asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      is_premium: false,
      tier: null,
      expires_at: null,
      subscription_id: null,
    },
  });
}));

module.exports = router;
