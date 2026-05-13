const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const AITutorSession = require('../models/AITutorSession');
const { AI_QUOTA_ENABLED } = require('../config/limitations');

/**
 * Build the standard 429 quota_exceeded response body.
 */
function buildQuotaExceededResponse(featureKey, resetAt) {
  return {
    success: false,
    error: 'quota_exceeded',
    feature: featureKey,
    resetAt: resetAt?.toISOString() || null,
    message: "You've used today's free quota for this feature. Upgrade to keep going.",
    upgradeAvailable: true,
  };
}

/**
 * Generic factory — used by 4 of the 5 chip routes (roleplay-start,
 * story-generate, image-vocab-describe, pronunciation-summary).
 *
 * The chat-message route uses checkChatQuotaSessionAware below
 * because it needs to bypass the chat quota for messages within
 * an active roleplay session.
 *
 * Fails CLOSED on internal errors (503), not open. Brief outage
 * beats free unlimited usage.
 */
exports.checkTutorQuota = (featureKey) => asyncHandler(async (req, res, next) => {
  if (!AI_QUOTA_ENABLED) return next();
  if (req.user?.role === 'admin') return next();
  if (!req.user?.id) return next();

  let result;
  try {
    result = await User.consumeQuota(req.user.id, featureKey);
  } catch (err) {
    console.error(`[checkTutorQuota:${featureKey}] consumeQuota failed:`, err);
    return res.status(503).json({
      success: false,
      error: 'quota_check_failed',
      message: 'Try again in a moment.',
      retryAfter: 5,
    });
  }

  if (!result.allowed) {
    return res.status(429).json(buildQuotaExceededResponse(featureKey, result.resetAt));
  }

  // Both per-feature result AND full snapshot stashed for controllers.
  req.tutorQuotaResult = { ...result, feature: featureKey };
  next();
});

/**
 * Specialized middleware for POST /tutor/sessions/:id/message.
 *
 * If the underlying session.mode === 'roleplay', the chat quota
 * is bypassed entirely — the roleplay quota was already consumed at
 * session-start, all messages within the session are free. This
 * implements the "don't cut a user off mid-roleplay if VIP grace
 * expires" rule.
 *
 * If session.mode is anything else (chat / default), applies the
 * standard chat quota check.
 */
exports.checkChatQuotaSessionAware = asyncHandler(async (req, res, next) => {
  if (!AI_QUOTA_ENABLED) return next();
  if (req.user?.role === 'admin') return next();
  if (!req.user?.id) return next();

  const sessionId = req.params.id;
  if (!sessionId) return next(new ErrorResponse('Missing session id', 400));

  let session;
  try {
    session = await AITutorSession.findById(sessionId).select('user mode').lean();
  } catch (err) {
    console.error('[checkChatQuotaSessionAware] session lookup failed:', err);
    return res.status(503).json({
      success: false,
      error: 'quota_check_failed',
      message: 'Try again in a moment.',
      retryAfter: 5,
    });
  }

  if (!session) return next(new ErrorResponse('Session not found', 404));
  if (session.user.toString() !== req.user.id.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  if (session.mode === 'roleplay') {
    // Roleplay session — quota was consumed at session-start. Free pass.
    return next();
  }

  let result;
  try {
    result = await User.consumeQuota(req.user.id, 'chat');
  } catch (err) {
    console.error('[checkChatQuotaSessionAware] consumeQuota failed:', err);
    return res.status(503).json({
      success: false,
      error: 'quota_check_failed',
      message: 'Try again in a moment.',
      retryAfter: 5,
    });
  }

  if (!result.allowed) {
    return res.status(429).json(buildQuotaExceededResponse('chat', result.resetAt));
  }

  req.tutorQuotaResult = { ...result, feature: 'chat' };
  next();
});
