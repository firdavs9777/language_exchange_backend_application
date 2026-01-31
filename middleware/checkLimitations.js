const asyncHandler = require('./async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { resetDailyCounters, formatLimitError } = require('../utils/limitations');
const LIMITS = require('../config/limitations');

/**
 * Check if user can send a message
 * Middleware to be used before message creation endpoints
 */
exports.checkMessageLimit = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Reset counters if new day
  await resetDailyCounters(user);
  await user.save();

  // Check if user can send message
  const canSend = await user.canSendMessage();
  
  if (!canSend) {
    let current = 0;
    let max = 0;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    if (user.userMode === 'regular') {
      current = user.regularUserLimitations.messagesSentToday || 0;
      max = LIMITS.regular.messagesPerDay;
    } else if (user.userMode === 'visitor') {
      current = user.visitorLimitations.messagesSent || 0;
      max = LIMITS.visitor.messagesPerDay;
    }

    return next(formatLimitError('messages', current, max, nextReset));
  }

  // Store user in request for later increment
  req.limitationUser = user;
  next();
});

/**
 * Check if user can create a moment
 * Middleware to be used before moment creation endpoints
 */
exports.checkMomentLimit = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Visitors cannot create moments
  if (user.userMode === 'visitor') {
    return next(new ErrorResponse('Visitors cannot create moments. Please upgrade to regular user.', 403));
  }

  // Reset counters if new day
  await resetDailyCounters(user);
  await user.save();

  // Check if user can create moment
  const canCreate = await user.canCreateMoment();
  
  if (!canCreate) {
    const current = user.regularUserLimitations.momentsCreatedToday || 0;
    const max = LIMITS.regular.momentsPerDay;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    return next(formatLimitError('moments', current, max, nextReset));
  }

  // Store user in request for later increment
  req.limitationUser = user;
  next();
});

/**
 * Check if user can create a story
 * Middleware to be used before story creation endpoints
 */
exports.checkStoryLimit = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Visitors cannot create stories
  if (user.userMode === 'visitor') {
    return next(new ErrorResponse('Visitors cannot create stories. Please upgrade to regular user.', 403));
  }

  // Reset counters if new day
  await resetDailyCounters(user);
  await user.save();

  // Check if user can create story
  const canCreate = await user.canCreateStory();
  
  if (!canCreate) {
    const current = user.regularUserLimitations.storiesCreatedToday || 0;
    const max = LIMITS.regular.storiesPerDay;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    return next(formatLimitError('stories', current, max, nextReset));
  }

  // Store user in request for later increment
  req.limitationUser = user;
  next();
});

/**
 * Check if user can create a comment
 * Middleware to be used before comment creation endpoints
 */
exports.checkCommentLimit = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Visitors cannot create comments
  if (user.userMode === 'visitor') {
    return next(new ErrorResponse('Visitors cannot create comments. Please upgrade to regular user.', 403));
  }

  // Reset counters if new day
  await resetDailyCounters(user);
  await user.save();

  // Check if user can create comment
  const canCreate = await user.canCreateComment();
  
  if (!canCreate) {
    const current = user.regularUserLimitations.commentsCreatedToday || 0;
    const max = LIMITS.regular.commentsPerDay;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    return next(formatLimitError('comments', current, max, nextReset));
  }

  // Store user in request for later increment
  req.limitationUser = user;
  next();
});

/**
 * Check if user can view a profile
 * Middleware to be used before profile view endpoints
 */
exports.checkProfileViewLimit = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Reset counters if new day
  await resetDailyCounters(user);
  await user.save();

  // Check if user can view profile
  const canView = await user.canViewProfile();
  
  if (!canView) {
    let current = 0;
    let max = 0;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);

    if (user.userMode === 'regular') {
      current = user.regularUserLimitations.profileViewsToday || 0;
      max = LIMITS.regular.profileViewsPerDay;
    } else if (user.userMode === 'visitor') {
      current = user.visitorLimitations.profileViewsToday || 0;
      max = LIMITS.visitor.profileViewsPerDay;
    }

    return next(formatLimitError('profileViews', current, max, nextReset));
  }

  // Store user in request for later increment
  req.limitationUser = user;
  next();
});

// ===================== VIP FEATURE CHECKS =====================

/**
 * Get user's effective tier considering VIP expiration
 */
const getUserTier = (user) => {
  if (!user) return 'visitor';

  if (user.userMode === 'vip') {
    // Verify VIP is still active
    if (user.vipSubscription?.isActive &&
        new Date(user.vipSubscription.endDate) > new Date()) {
      return 'vip';
    }
    return 'regular'; // VIP expired, treat as regular
  }

  return user.userMode || 'regular';
};

/**
 * Check if user can access nearby search
 */
exports.checkNearbyAccess = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  const tier = getUserTier(user);
  const limits = LIMITS[tier] || LIMITS.regular;

  if (limits.nearbySearchEnabled === false) {
    return next(new ErrorResponse(
      'Nearby search is a premium feature. Upgrade to access.',
      403
    ));
  }

  // Set max radius based on tier
  req.maxNearbyRadius = limits.nearbyRadius || 50;
  req.userLimits = { tier, nearbySearchPerDay: limits.nearbySearchPerDay };
  req.limitationUser = user;

  next();
});

/**
 * Check if user can create voice room
 */
exports.checkVoiceRoomAccess = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  const tier = getUserTier(user);
  const limits = LIMITS[tier] || LIMITS.regular;

  if (limits.canCreateVoiceRoom === false) {
    return next(new ErrorResponse(
      'Voice rooms are not available for your account type. Upgrade to create voice rooms.',
      403
    ));
  }

  req.voiceRoomLimits = {
    maxParticipants: limits.maxParticipantsInRoom || 8,
    maxDurationMinutes: limits.voiceRoomDurationMinutes || 30,
    canRecord: limits.canRecordVoiceRoom || false
  };
  req.limitationUser = user;

  next();
});

/**
 * Check if user can send waves
 */
exports.checkWaveLimit = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  const tier = getUserTier(user);
  const limits = LIMITS[tier] || LIMITS.regular;

  if (limits.wavesPerDay === 0) {
    return next(new ErrorResponse('Waves are not available for visitors. Please sign up.', 403));
  }

  if (limits.wavesPerDay === -1) {
    req.limitationUser = user;
    return next(); // Unlimited for VIP
  }

  // Check daily wave count
  const wavesSentToday = user.dailyCounters?.wavesSent || 0;
  if (wavesSentToday >= limits.wavesPerDay) {
    return next(new ErrorResponse(
      `Daily wave limit reached (${limits.wavesPerDay}). ${tier !== 'vip' ? 'Upgrade to VIP for unlimited waves.' : 'Try again tomorrow.'}`,
      429
    ));
  }

  req.limitationUser = user;
  next();
});

/**
 * Check vocabulary limit before adding new words
 */
exports.checkVocabularyLimit = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  const tier = getUserTier(user);
  const limits = LIMITS[tier] || LIMITS.regular;

  if (limits.vocabularyLimit === -1) {
    return next(); // Unlimited for VIP
  }

  const Vocabulary = require('../models/Vocabulary');
  const currentCount = await Vocabulary.countDocuments({
    user: req.user.id,
    isArchived: false
  });

  if (currentCount >= limits.vocabularyLimit) {
    return next(new ErrorResponse(
      `Vocabulary limit reached (${limits.vocabularyLimit} words). ${tier !== 'vip' ? 'Upgrade to VIP for unlimited vocabulary.' : 'Remove some words to add new ones.'}`,
      429
    ));
  }

  next();
});

/**
 * Get user's current limits and usage - endpoint handler
 */
exports.getUserLimitsInfo = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new ErrorResponse('Authentication required', 401));
  }

  const user = await User.findById(req.user.id);
  const tier = getUserTier(user);
  const limits = LIMITS[tier] || LIMITS.regular;

  // Get current usage counts
  const usage = {
    messagesPerDay: user.regularUserLimitations?.messagesSentToday || 0,
    momentsPerDay: user.regularUserLimitations?.momentsCreatedToday || 0,
    storiesPerDay: user.regularUserLimitations?.storiesCreatedToday || 0,
    commentsPerDay: user.regularUserLimitations?.commentsCreatedToday || 0,
    profileViewsPerDay: user.regularUserLimitations?.profileViewsToday || 0,
    wavesSentToday: user.dailyCounters?.wavesSent || 0
  };

  res.status(200).json({
    success: true,
    data: {
      tier,
      isVip: tier === 'vip',
      vipExpiry: tier === 'vip' ? user.vipSubscription?.endDate : null,
      limits,
      usage,
      upgradeAvailable: tier !== 'vip'
    }
  });
});

// Export helper function
exports.getUserTier = getUserTier;
