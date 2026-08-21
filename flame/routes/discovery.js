const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const discoveryService = require('../services/discoveryService');

const router = express.Router();

// GET /discover — potential matches for the swipe deck.
router.get('/', auth, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  // Absent, not defaulted to 0: the head path is selected by the ABSENCE of an
  // offset, so `|| 0` here would make it unreachable.
  const offset = req.query.offset === undefined
    ? undefined
    : (parseInt(req.query.offset, 10) || 0);

  const { users, total, hasMore } = await discoveryService.discover(
    req.user.id, { limit, offset },
  );

  const pagination = {
    limit,
    has_more: hasMore !== undefined ? hasMore : (offset + users.length < total),
  };
  // Echoed only on the legacy path — a response should not carry a field it did
  // not compute.
  if (total !== undefined) {
    pagination.total = total;
    pagination.offset = offset;
  }
  res.json({ success: true, data: { users, pagination } });
}));

module.exports = router;
