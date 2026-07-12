/**
 * User Limitations Configuration
 *
 * Defines daily/hourly limits for different user types (visitor, regular, VIP)
 * All limits are enforced server-side
 */

// Emergency kill switch for Step 13A tutor-chip daily quotas.
// When 'false' (or unset), the new tutor-quota middleware short-circuits
// to next() with no DB write and no check.
const AI_QUOTA_ENABLED = String(process.env.AI_QUOTA_ENABLED || 'true').toLowerCase() === 'true';

// Kill switch for Workstream D public language rooms ("hubs"). When 'false',
// routes/rooms.js short-circuits every /api/v1/rooms route to a 404,
// socket/roomHandler.js's room:join/room:message handlers no-op, and
// controllers/appConfig.js reports roomsEnabled:false to clients so the app
// can hide the Rooms tab. Defaults to true (on) when unset.
const ROOMS_ENABLED = String(process.env.ROOMS_ENABLED || 'true').toLowerCase() === 'true';

module.exports = {
  AI_QUOTA_ENABLED,
  ROOMS_ENABLED,

  // ===================== VISITOR LIMITS =====================
  // Users who haven't verified email or just browsing
  visitor: {
    // Messaging - Unlimited for now
    messagesPerDay: -1,
    voiceMessagesPerDay: -1,

    // Content Creation
    momentsPerDay: 5,
    storiesPerDay: 3,
    commentsPerDay: 20,

    // Social
    profileViewsPerDay: 20,
    wavesPerDay: 3,
    followsPerDay: 10,

    // Community
    nearbySearchEnabled: true,
    nearbySearchPerDay: 10,
    nearbyRadius: 50, // km

    // Voice Rooms
    voiceRoomsPerDay: 3,
    voiceRoomDurationMinutes: 30,
    canCreateVoiceRoom: true,
    maxParticipantsInRoom: 8,

    // AI Features (per hour)
    aiConversationPerHour: 5,
    aiGrammarCheckPerHour: 10,
    aiTranslationPerHour: 20,
    aiQuizPerHour: 3,
    aiLessonBuilderPerHour: 5,
    aiPronunciationPerHour: 5,
    ttsPerHour: 10,
    sttPerHour: 5,

    // Translation (daily chat translations)
    translationsPerDay: 5,

    // Learning
    vocabularyLimit: 50,
    lessonsPerDay: 3,

    // Storage
    maxPhotoUploadMB: 10,
    maxVideoUploadMB: 50,
    maxVoiceUploadMB: 10,

    // AI tutor chip daily quotas — unified 5/day per chip across all tiers
    // since VIP gating has been disabled product-wide.
    tutorDailyQuotas: {
      chat:          5,
      roleplay:      5,
      story:         5,
      photo:         5,
      pronunciation: 5,
    },
  },

  // ===================== REGULAR USER LIMITS =====================
  // Standard registered and verified users
  regular: {
    // Messaging - Unlimited for now
    messagesPerDay: -1,
    voiceMessagesPerDay: -1,

    // Content Creation
    momentsPerDay: 10,
    storiesPerDay: 5,
    commentsPerDay: 50,

    // Social
    profileViewsPerDay: 100,
    wavesPerDay: 15,
    followsPerDay: 50,

    // Community
    nearbySearchEnabled: true,
    nearbySearchPerDay: 10,
    nearbyRadius: 50, // km

    // Voice Rooms
    voiceRoomsPerDay: 3,
    voiceRoomDurationMinutes: 30,
    canCreateVoiceRoom: true,
    maxParticipantsInRoom: 8,

    // AI Features (per hour)
    aiConversationPerHour: 20,
    aiGrammarCheckPerHour: 30,
    aiTranslationPerHour: 50,
    aiQuizPerHour: 10,
    aiLessonBuilderPerHour: 5,
    aiPronunciationPerHour: 30,
    ttsPerHour: 50,
    sttPerHour: 20,

    // Translation (daily chat translations)
    translationsPerDay: 5,

    // Learning
    vocabularyLimit: 500,
    lessonsPerDay: 10,

    // Storage
    maxPhotoUploadMB: 10,
    maxVideoUploadMB: 50,
    maxVoiceUploadMB: 10,

    tutorDailyQuotas: {
      chat:          5,
      roleplay:      5,
      story:         5,
      photo:         5,
      pronunciation: 5,
    },
  },

  // ===================== VIP USER LIMITS =====================
  // Premium subscribers with enhanced features
  vip: {
    // Messaging - Unlimited
    messagesPerDay: -1, // -1 means unlimited
    voiceMessagesPerDay: -1,

    // Content Creation - Unlimited
    momentsPerDay: -1,
    storiesPerDay: -1,
    commentsPerDay: -1,

    // Social - Unlimited
    profileViewsPerDay: -1,
    wavesPerDay: -1,
    followsPerDay: -1,

    // Community - Full Access
    nearbySearchEnabled: true,
    nearbySearchPerDay: -1,
    nearbyRadius: 500, // km - expanded range
    canSeeOnlineStatus: true,
    canSeeLastSeen: true,
    priorityInSearch: true,

    // Voice Rooms - Premium
    voiceRoomsPerDay: -1,
    voiceRoomDurationMinutes: -1, // Unlimited duration
    canCreateVoiceRoom: true,
    maxParticipantsInRoom: 50,
    canRecordVoiceRoom: true,

    // AI Features (per hour) - High limits
    aiConversationPerHour: 200,
    aiGrammarCheckPerHour: 500,
    aiTranslationPerHour: 1000,
    aiQuizPerHour: 100,
    aiLessonBuilderPerHour: 50,
    aiPronunciationPerHour: 500,
    ttsPerHour: 1000,
    sttPerHour: 500,

    // Translation - Unlimited
    translationsPerDay: -1,

    // Learning - Unlimited
    vocabularyLimit: -1,
    lessonsPerDay: -1,

    // Storage - Premium
    maxPhotoUploadMB: 50,
    maxVideoUploadMB: 500,
    maxVoiceUploadMB: 100,

    // VIP Exclusive Features
    adFree: true,
    prioritySupport: true,
    earlyAccess: true,
    exclusiveBadge: true,
    customThemes: true,
    readReceipts: true,
    whoViewedProfile: true,
    undoMessage: true,
    scheduleMessages: true,

    tutorDailyQuotas: {
      chat:          5,
      roleplay:      5,
      story:         5,
      photo:         5,
      pronunciation: 5,
    },
  },

  // ===================== HELPER FUNCTIONS =====================

  /**
   * Get limits for a specific user mode
   * @param {String} userMode - 'visitor', 'regular', or 'vip'
   * @returns {Object} Limits object
   */
  getLimits: function(userMode) {
    return this[userMode] || this.regular;
  },

  /**
   * Check if a limit is unlimited (-1)
   * @param {Number} limit - The limit value
   * @returns {Boolean}
   */
  isUnlimited: function(limit) {
    return limit === -1;
  },

  /**
   * Get tier name for AI rate limiter
   * Maps userMode to rate limiter tier
   * @param {String} userMode
   * @returns {String} 'free', 'regular', or 'vip'
   */
  getAITier: function(userMode) {
    const tierMap = {
      'visitor': 'free',
      'regular': 'regular',
      'vip': 'vip'
    };
    return tierMap[userMode] || 'free';
  }
};
