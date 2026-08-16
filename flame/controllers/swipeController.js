const User = require('../models/User');
const Swipe = require('../models/Swipe');
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

// Returns today's remaining super-likes without spending one, resetting the
// allowance first if the stored day is stale.
async function remainingSuperLikes(userId) {
  const day = today();
  await User.updateOne(
    { _id: userId, superLikesDay: { $ne: day } },
    { $set: { superLikesDay: day, superLikesRemaining: DAILY_SUPER_LIKES } },
  );
  const u = await User.findById(userId).select('superLikesRemaining').lean();
  return u ? u.superLikesRemaining : 0;
}

async function superLike(req, res) {
  const fromId = req.user.id;
  const toId = req.body.user_id;

  // A super-like already recorded for this pair costs nothing to repeat. The
  // Swipe upsert is idempotent, so charging again would spend a second
  // super-like for one logical action (a retry, or a UI double-tap).
  const alreadySwiped = await Swipe.exists({ from: fromId, to: toId });

  // Claim BEFORE recording, so an exhausted quota 422s without writing an
  // unpaid super-like. The claim is refunded below if the swipe then fails.
  const remaining = alreadySwiped
    ? await remainingSuperLikes(fromId)
    : await claimSuperLike(fromId);

  let result;
  try {
    result = await swipeService.record(fromId, toId, 'super');
  } catch (e) {
    // The swipe never happened — a blocked target throws 403 here — so give
    // the quota unit back rather than charging for nothing.
    if (!alreadySwiped) {
      await User.updateOne({ _id: fromId }, { $inc: { superLikesRemaining: 1 } });
    }
    throw e;
  }

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
