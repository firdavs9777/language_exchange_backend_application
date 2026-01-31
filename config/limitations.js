/**
 * User Limitations Configuration
 *
 * Defines daily/hourly limits for different user types (visitor, regular, VIP)
 * All limits are enforced server-side
 */

module.exports = {
  // ===================== VISITOR LIMITS =====================
  // Users who haven't verified email or just browsing
  visitor: {
    // Messaging
    messagesPerDay: 10,
    voiceMessagesPerDay: 0,

    // Content Creation
    momentsPerDay: 0,
    storiesPerDay: 0,
    commentsPerDay: 5,

    // Social
    profileViewsPerDay: 20,
    wavesPerDay: 3,
    followsPerDay: 10,

    // Community
    nearbySearchEnabled: false,
    nearbySearchPerDay: 0,
    nearbyRadius: 0, // km

    // Voice Rooms
    voiceRoomsPerDay: 0,
    voiceRoomDurationMinutes: 0,
    canCreateVoiceRoom: false,

    // AI Features (per hour)
    aiConversationPerHour: 5,
    aiGrammarCheckPerHour: 10,
    aiTranslationPerHour: 20,
    aiQuizPerHour: 3,
    aiLessonBuilderPerHour: 0,
    aiPronunciationPerHour: 5,
    ttsPerHour: 10,
    sttPerHour: 5,

    // Learning
    vocabularyLimit: 50,
    lessonsPerDay: 3,

    // Storage
    maxPhotoUploadMB: 5,
    maxVideoUploadMB: 0,
    maxVoiceUploadMB: 0
  },

  // ===================== REGULAR USER LIMITS =====================
  // Standard registered and verified users
  regular: {
    // Messaging
    messagesPerDay: 100,
    voiceMessagesPerDay: 20,

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

    // Learning
    vocabularyLimit: 500,
    lessonsPerDay: 10,

    // Storage
    maxPhotoUploadMB: 10,
    maxVideoUploadMB: 50,
    maxVoiceUploadMB: 10
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
    scheduleMessages: true
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
