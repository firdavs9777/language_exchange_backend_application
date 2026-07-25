const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');

const router = express.Router();

// Swipes aren't fully implemented server-side yet (no Swipe model / mutual-match
// detection). These acknowledge the action so the swipe deck advances instead of
// 404-ing. is_match is always false until real matching lands. Wire persistence
// + match detection when the matching feature is built.

router.post('/like', auth, asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { liked: true, is_match: false, match: null } });
}));

router.post('/pass', auth, asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { passed: true } });
}));

router.post('/super-like', auth, asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: { super_liked: true, is_match: false, match: null, remaining_super_likes: 3 },
  });
}));

router.post('/undo', auth, asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { undone: false } });
}));

module.exports = router;
