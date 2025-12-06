const LIMITS = require('../config/limitations');
const ErrorResponse = require('./errorResponse');

/**
 * Reset daily counters if it's a new day
 * @param {Object} user - User document
 * @returns {Promise} - Promise that resolves when counters are reset if needed
 */
exports.resetDailyCounters = async (user) => {
  if (!user) return;
  
  const now = new Date();
  let needsSave = false;

  if (user.userMode === 'regular') {
    const isNewDay = (lastReset) => {
      const resetDate = new Date(lastReset);
      return now.getDate() !== resetDate.getDate() || 
             now.getMonth() !== resetDate.getMonth() || 
             now.getFullYear() !== resetDate.getFullYear();
    };

    if (isNewDay(user.regularUserLimitations.lastMessageReset)) {
      user.regularUserLimitations.messagesSentToday = 0;
      user.regularUserLimitations.lastMessageReset = now;
      needsSave = true;
    }
    if (isNewDay(user.regularUserLimitations.lastMomentReset)) {
      user.regularUserLimitations.momentsCreatedToday = 0;
      user.regularUserLimitations.lastMomentReset = now;
      needsSave = true;
    }
    if (isNewDay(user.regularUserLimitations.lastStoryReset)) {
      user.regularUserLimitations.storiesCreatedToday = 0;
      user.regularUserLimitations.lastStoryReset = now;
      needsSave = true;
    }
    if (isNewDay(user.regularUserLimitations.lastCommentReset)) {
      user.regularUserLimitations.commentsCreatedToday = 0;
      user.regularUserLimitations.lastCommentReset = now;
      needsSave = true;
    }
    if (isNewDay(user.regularUserLimitations.lastProfileViewReset)) {
      user.regularUserLimitations.profileViewsToday = 0;
      user.regularUserLimitations.lastProfileViewReset = now;
      needsSave = true;
    }
  }

  if (user.userMode === 'visitor') {
    const isNewDay = (lastReset) => {
      const resetDate = new Date(lastReset);
      return now.getDate() !== resetDate.getDate() || 
             now.getMonth() !== resetDate.getMonth() || 
             now.getFullYear() !== resetDate.getFullYear();
    };

    if (isNewDay(user.visitorLimitations.lastMessageReset)) {
      user.visitorLimitations.messagesSent = 0;
      user.visitorLimitations.lastMessageReset = now;
      needsSave = true;
    }
    if (isNewDay(user.visitorLimitations.lastProfileViewReset)) {
      user.visitorLimitations.profileViewsToday = 0;
      user.visitorLimitations.lastProfileViewReset = now;
      needsSave = true;
    }
  }

  if (needsSave) {
    await user.save();
  }
};

/**
 * Get current limit status for a user
 * @param {Object} user - User document
 * @returns {Object} - Object containing limit information
 */
exports.getUserLimits = (user) => {
  if (!user) {
    return null;
  }

  const LIMITS = require('../config/limitations');
  const now = new Date();
  
  // Calculate next reset time (midnight of next day)
  const nextReset = new Date(now);
  nextReset.setHours(24, 0, 0, 0);

  if (user.userMode === 'vip') {
    return {
      userMode: 'vip',
      isVIP: true,
      limits: {
        messages: { current: 0, max: 'unlimited', remaining: 'unlimited' },
        moments: { current: 0, max: 'unlimited', remaining: 'unlimited' },
        stories: { current: 0, max: 'unlimited', remaining: 'unlimited' },
        comments: { current: 0, max: 'unlimited', remaining: 'unlimited' },
        profileViews: { current: 0, max: 'unlimited', remaining: 'unlimited' }
      },
      resetTime: null
    };
  }

  if (user.userMode === 'regular') {
    return {
      userMode: 'regular',
      isVIP: false,
      limits: {
        messages: {
          current: user.regularUserLimitations.messagesSentToday || 0,
          max: LIMITS.regular.messagesPerDay,
          remaining: Math.max(0, LIMITS.regular.messagesPerDay - (user.regularUserLimitations.messagesSentToday || 0))
        },
        moments: {
          current: user.regularUserLimitations.momentsCreatedToday || 0,
          max: LIMITS.regular.momentsPerDay,
          remaining: Math.max(0, LIMITS.regular.momentsPerDay - (user.regularUserLimitations.momentsCreatedToday || 0))
        },
        stories: {
          current: user.regularUserLimitations.storiesCreatedToday || 0,
          max: LIMITS.regular.storiesPerDay,
          remaining: Math.max(0, LIMITS.regular.storiesPerDay - (user.regularUserLimitations.storiesCreatedToday || 0))
        },
        comments: {
          current: user.regularUserLimitations.commentsCreatedToday || 0,
          max: LIMITS.regular.commentsPerDay,
          remaining: Math.max(0, LIMITS.regular.commentsPerDay - (user.regularUserLimitations.commentsCreatedToday || 0))
        },
        profileViews: {
          current: user.regularUserLimitations.profileViewsToday || 0,
          max: LIMITS.regular.profileViewsPerDay,
          remaining: Math.max(0, LIMITS.regular.profileViewsPerDay - (user.regularUserLimitations.profileViewsToday || 0))
        }
      },
      resetTime: nextReset.toISOString()
    };
  }

  if (user.userMode === 'visitor') {
    return {
      userMode: 'visitor',
      isVIP: false,
      limits: {
        messages: {
          current: user.visitorLimitations.messagesSent || 0,
          max: LIMITS.visitor.messagesPerDay,
          remaining: Math.max(0, LIMITS.visitor.messagesPerDay - (user.visitorLimitations.messagesSent || 0))
        },
        profileViews: {
          current: user.visitorLimitations.profileViewsToday || 0,
          max: LIMITS.visitor.profileViewsPerDay,
          remaining: Math.max(0, LIMITS.visitor.profileViewsPerDay - (user.visitorLimitations.profileViewsToday || 0))
        }
      },
      resetTime: nextReset.toISOString()
    };
  }

  return null;
};

/**
 * Format error message for limit exceeded
 * @param {String} limitType - Type of limit (messages, moments, stories, comments)
 * @param {Number} current - Current usage
 * @param {Number} max - Maximum allowed
 * @param {Date} resetTime - When the limit resets
 * @returns {ErrorResponse} - Formatted error response
 */
exports.formatLimitError = (limitType, current, max, resetTime) => {
  const limitTypeNames = {
    messages: 'messages',
    moments: 'moments',
    stories: 'stories',
    comments: 'comments',
    profileViews: 'profile views'
  };

  const typeName = limitTypeNames[limitType] || limitType;
  const resetTimeStr = resetTime ? new Date(resetTime).toLocaleString() : 'midnight';

  return new ErrorResponse(
    `Daily ${typeName} limit exceeded. You have used ${current} of ${max} ${typeName} today. Limit resets at ${resetTimeStr}.`,
    429
  );
};

/**
 * Generic limit checker and incrementer
 * @param {Object} user - User document
 * @param {String} limitType - Type of limit to check (messages, moments, stories, comments, profileViews)
 * @param {Object} limitConfig - Configuration object with max limit
 * @returns {Object} - { canProceed: boolean, error: ErrorResponse|null }
 */
exports.checkAndIncrementLimit = async (user, limitType, limitConfig) => {
  if (!user) {
    return {
      canProceed: false,
      error: new ErrorResponse('User not found', 404)
    };
  }

  // VIP users have unlimited access
  if (user.userMode === 'vip') {
    return { canProceed: true, error: null };
  }

  // Reset counters if new day
  await exports.resetDailyCounters(user);
  
  // Reload user to get updated counters (refresh from database)
  await user.constructor.findById(user._id);
  
  let canProceed = false;
  let current = 0;
  let max = 0;

  if (user.userMode === 'regular') {
    switch (limitType) {
      case 'messages':
        canProceed = await user.canSendMessage();
        current = user.regularUserLimitations.messagesSentToday || 0;
        max = limitConfig.max || LIMITS.regular.messagesPerDay;
        break;
      case 'moments':
        canProceed = await user.canCreateMoment();
        current = user.regularUserLimitations.momentsCreatedToday || 0;
        max = limitConfig.max || LIMITS.regular.momentsPerDay;
        break;
      case 'stories':
        canProceed = await user.canCreateStory();
        current = user.regularUserLimitations.storiesCreatedToday || 0;
        max = limitConfig.max || LIMITS.regular.storiesPerDay;
        break;
      case 'comments':
        canProceed = await user.canCreateComment();
        current = user.regularUserLimitations.commentsCreatedToday || 0;
        max = limitConfig.max || LIMITS.regular.commentsPerDay;
        break;
      case 'profileViews':
        canProceed = await user.canViewProfile();
        current = user.regularUserLimitations.profileViewsToday || 0;
        max = limitConfig.max || LIMITS.regular.profileViewsPerDay;
        break;
    }
  } else if (user.userMode === 'visitor') {
    switch (limitType) {
      case 'messages':
        canProceed = await user.canSendMessage();
        current = user.visitorLimitations.messagesSent || 0;
        max = limitConfig.max || LIMITS.visitor.messagesPerDay;
        break;
      case 'profileViews':
        canProceed = await user.canViewProfile();
        current = user.visitorLimitations.profileViewsToday || 0;
        max = limitConfig.max || LIMITS.visitor.profileViewsPerDay;
        break;
      default:
        // Visitors can't create moments, stories, or comments
        canProceed = false;
        max = 0;
        break;
    }
  }

  if (!canProceed) {
    const nextReset = new Date();
    nextReset.setHours(24, 0, 0, 0);
    return {
      canProceed: false,
      error: exports.formatLimitError(limitType, current, max, nextReset)
    };
  }

  return { canProceed: true, error: null };
};

