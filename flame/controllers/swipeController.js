const User = require('../models/User');
const swipeService = require('../services/swipeService');
const { ValidationError } = require('../utils/errors');

const DAILY_SUPER_LIKES = 3;

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

// Atomically claims one super-like for today, resetting the allowance when the
// stored day is stale. Returns the number remaining after the claim.
async function claimSuperLike(userId) {
  const day = today();

  // New day: reset first, so the claim below sees a full allowance.
  await User.updateOne(
    { _id: userId, superLikesDay: { $ne: day } },
    { $set: { superLikesDay: day, superLikesRemaining: DAILY_SUPER_LIKES } },
  );

  const claimed = await User.findOneAndUpdate(
    { _id: userId, superLikesRemaining: { $gt: 0 } },
    { $inc: { superLikesRemaining: -1 } },
    { new: true },
  ).lean();

  if (!claimed) throw new ValidationError('no super likes remaining today');
  return claimed.superLikesRemaining;
}

async function like(req, res) {
  const result = await swipeService.record(req.user.id, req.body.user_id, 'like');
  res.json({
    success: true,
    data: { liked: true, is_match: result.isMatch, match: result.match },
  });
}

async function pass(req, res) {
  await swipeService.record(req.user.id, req.body.user_id, 'pass');
  res.json({ success: true, data: { passed: true } });
}

async function superLike(req, res) {
  const remaining = await claimSuperLike(req.user.id);
  const result = await swipeService.record(req.user.id, req.body.user_id, 'super');
  res.json({
    success: true,
    data: {
      super_liked: true,
      is_match: result.isMatch,
      match: result.match,
      remaining_super_likes: remaining,
    },
  });
}

// Undo is deliberately still a no-op (out of scope for this phase). It answers
// rather than 404s so the app's existing call keeps working.
async function undo(_req, res) {
  res.json({ success: true, data: { undone: false } });
}

module.exports = { like, pass, superLike, undo };
