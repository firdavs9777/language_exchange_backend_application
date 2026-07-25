const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

// Conversations/chat aren't implemented server-side yet. Return a valid empty
// page so the client renders its empty state instead of 404-ing.
router.get('/', auth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = parseInt(req.query.offset, 10) || 0;
  res.json({
    success: true,
    data: {
      conversations: [],
      pagination: { total: 0, limit, offset, has_more: false },
    },
  });
}));

module.exports = router;
