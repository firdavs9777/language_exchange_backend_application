const mongoose = require('mongoose');

/**
 * Achievement Model
 * Defines available achievements/badges that users can earn
 */
const AchievementSchema = new mongoose.Schema({
  // Unique identifier
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Display info
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },

  // Icon/image
  icon: {
    type: String,
    default: '🏆'
  },
  imageUrl: {
    type: String
  },

  // Category
  category: {
    type: String,
    enum: ['beginner', 'vocabulary', 'lessons', 'streaks', 'social', 'milestones', 'special'],
    required: true,
    index: true
  },

  // Rarity/tier
  tier: {
    type: String,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'bronze'
  },

  // XP reward for unlocking
  xpReward: {
    type: Number,
    default: 50
  },

  // Requirement to unlock
  requirement: {
    type: {
      type: String,
      enum: [
        'message_count',           // Total messages in target language
        'correction_given',        // Corrections given
        'correction_received',     // Corrections received
        'vocabulary_count',        // Words added
        'vocabulary_mastered',     // Words mastered
        'lesson_count',            // Lessons completed
        'quiz_count',              // Quizzes completed
        'streak_days',             // Streak length
        'total_xp',                // Total XP earned
        'level_reached',           // User level
        'conversations_count',     // Unique conversation partners
        'challenge_daily',         // Daily challenges completed
        'challenge_weekly',        // Weekly challenges completed
        'review_count',            // Vocabulary reviews done
        'perfect_lesson',          // Perfect lessons (100%)
        'first_action',            // First time doing something
        'special'                  // Special/event achievements
      ],
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    // For cumulative achievements
    action: {
      type: String,
      default: null // e.g., 'first_message', 'first_correction'
    }
  },

  // Progress tracking type
  progressType: {
    type: String,
    enum: ['count', 'boolean', 'cumulative'],
    default: 'count'
  },

  // Is this achievement hidden until unlocked?
  isSecret: {
    type: Boolean,
    default: false
  },

  // Is this a limited-time achievement?
  isLimited: {
    type: Boolean,
    default: false
  },
  availableFrom: Date,
  availableUntil: Date,

  // Active status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Sort order for display
  sortOrder: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

// Compound indexes
AchievementSchema.index({ category: 1, tier: 1, sortOrder: 1 });
AchievementSchema.index({ isActive: 1, category: 1 });

/**
 * Get all active achievements
 */
AchievementSchema.statics.getActiveAchievements = async function(category = null) {
  const filter = { isActive: true };
  if (category) filter.category = category;

  return this.find(filter).sort({ category: 1, tier: 1, sortOrder: 1 }).lean();
};

/**
 * Get achievement by code
 */
AchievementSchema.statics.getByCode = async function(code) {
  return this.findOne({ code, isActive: true }).lean();
};

module.exports = mongoose.model('Achievement', AchievementSchema);
