const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const discoveryService = require('../services/discoveryService');

const router = express.Router();

// GET /discover — potential matches for the swipe deck.
router.get('/', auth, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const offset = parseInt(req.query.offset, 10) || 0;
  const { users, total } = await discoveryService.discover(req.user.id, { limit, offset });
  res.json({
    success: true,
    data: {
      users,
      pagination: { total, limit, offset, has_more: offset + users.length < total },
    },
  });
}));

module.exports = router;
