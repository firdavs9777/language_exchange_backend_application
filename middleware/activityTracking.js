const User = require('../models/User');

// In-memory debounce: userId (string) -> timestamp of last DB write
const _lastWritten = new Map();
const DEBOUNCE_MS = 5 * 60 * 1000; // write at most once per 5 min per user

/**
 * Fire-and-forget lastActive update.
 * Safe to call from anywhere — never throws, never blocks.
 */
const trackActivity = (userId) => {
  if (!userId) return;
  const uid = userId.toString();
  const now = Date.now();
  if (_lastWritten.has(uid) && now - _lastWritten.get(uid) < DEBOUNCE_MS) return;
  _lastWritten.set(uid, now);

  User.findByIdAndUpdate(
    uid,
    { $set: { lastActive: new Date(), lastActivityAt: new Date() } },
    { timestamps: false, lean: true },
  ).catch(() => {});
};

/**
 * Express middleware — updates lastActive for every authenticated request.
 * Must run after `protect` so req.user is populated.
 */
const activityTrackingMiddleware = (req, _res, next) => {
  if (req.user?._id) trackActivity(req.user._id);
  next();
};

module.exports = { trackActivity, activityTrackingMiddleware };
