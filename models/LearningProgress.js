const mongoose = require('mongoose');
const { calculateLevel, levelProgress, xpForLevel } = require('../config/xpRewards');

const LearningProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Target language for this progress (user's language_to_learn)
  targetLanguage: {
    type: String,
    required: true,
    index: true
  },

  // ========== XP & LEVEL ==========
  totalXP: {
    type: Number,
    default: 0,
    min: 0
  },
  weeklyXP: {
    type: Number,
    default: 0,
    min: 0
  },
  dailyXP: {
    type: Number,
    default: 0,
    min: 0
  },
  lastXPEarnedAt: {
    type: Date,
    default: null
  },

  // ========== STREAKS ==========
  currentStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  longestStreak: {
    type: Number,
    default: 0,
    min: 0
  },
  lastActivityDate: {
    type: Date,
    default: null
  },
  streakFreezes: {
    type: Number,
    default: 0,
    min: 0,
    max: 5 // Maximum streak freezes you can hold
  },
  streakFreezeUsedAt: {
    type: Date,
    default: null
  },

  // ========== DAILY/WEEKLY GOALS ==========
  dailyGoal: {
    type: String,
    enum: ['casual', 'regular', 'serious', 'intense'],
    default: 'regular'
  },
  dailyGoalProgress: {
    type: Number,
    default: 0
  },
  dailyGoalCompletedAt: {
    type: Date,
    default: null
  },
  weeklyGoalProgress: {
    type: Number,
    default: 0
  },
  daysCompletedThisWeek: {
    type: Number,
    default: 0,
    min: 0,
    max: 7
  },

  // ========== PROFICIENCY ==========
  proficiencyLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    default: 'A1'
  },
  placementTestTaken: {
    type: Boolean,
    default: false
  },
  placementTestScore: {
    type: Number,
    default: null
  },
  placementTestDate: {
    type: Date,
    default: null
  },

  // ========== STATISTICS ==========
  stats: {
    // Messages
    messagesInTargetLanguage: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },

    // Corrections
    correctionsGiven: { type: Number, default: 0 },
    correctionsReceived: { type: Number, default: 0 },
    correctionsAccepted: { type: Number, default: 0 },

    // Lessons
    lessonsCompleted: { type: Number, default: 0 },
    lessonsStarted: { type: Number, default: 0 },
    perfectLessons: { type: Number, default: 0 },

    // Quizzes
    quizzesCompleted: { type: Number, default: 0 },
    averageQuizScore: { type: Number, default: 0 },

    // Vocabulary
    vocabularyAdded: { type: Number, default: 0 },
    vocabularyMastered: { type: Number, default: 0 },
    vocabularyReviews: { type: Number, default: 0 },

    // Challenges
    dailyChallengesCompleted: { type: Number, default: 0 },
    weeklyChallengesCompleted: { type: Number, default: 0 },

    // Time
    totalLearningMinutes: { type: Number, default: 0 },
    conversationMinutes: { type: Number, default: 0 },

    // Achievements
    achievementsUnlocked: { type: Number, default: 0 }
  },

  // ========== PREFERENCES ==========
  preferences: {
    reminderEnabled: { type: Boolean, default: true },
    reminderTime: { type: String, default: '09:00' }, // HH:mm format
    soundEffects: { type: Boolean, default: true },
    showStreakReminders: { type: Boolean, default: true },
    weeklyReportEnabled: { type: Boolean, default: true }
  },

  // ========== RANKINGS ==========
  weeklyRank: {
    type: Number,
    default: null
  },
  allTimeRank: {
    type: Number,
    default: null
  },
  lastRankUpdate: {
    type: Date,
    default: null
  }

}, { timestamps: true });

// Indexes for performance
LearningProgressSchema.index({ user: 1 }, { unique: true });
LearningProgressSchema.index({ targetLanguage: 1, weeklyXP: -1 }); // For leaderboards
LearningProgressSchema.index({ targetLanguage: 1, totalXP: -1 }); // For all-time leaderboards
LearningProgressSchema.index({ currentStreak: -1 }); // For streak leaderboards
LearningProgressSchema.index({ lastActivityDate: 1 }); // For streak checking job

// Virtual for computed level
LearningProgressSchema.virtual('level').get(function() {
  return calculateLevel(this.totalXP);
});

// Virtual for level progress percentage
LearningProgressSchema.virtual('levelProgressPercent').get(function() {
  return levelProgress(this.totalXP);
});

// Virtual for XP to next level
LearningProgressSchema.virtual('xpToNextLevel').get(function() {
  const currentLevel = calculateLevel(this.totalXP);
  const nextLevelXP = xpForLevel(currentLevel + 1);
  return nextLevelXP - this.totalXP;
});

// Ensure virtuals are included in JSON
LearningProgressSchema.set('toJSON', { virtuals: true });
LearningProgressSchema.set('toObject', { virtuals: true });

/**
 * Award XP to user
 * @param {number} amount - Amount of XP to award
 * @param {string} reason - Reason for XP award (for logging)
 * @returns {Object} Result with new totals and level info
 */
LearningProgressSchema.methods.awardXP = async function(amount, reason = '') {
  const previousLevel = calculateLevel(this.totalXP);

  this.totalXP += amount;
  this.weeklyXP += amount;
  this.dailyXP += amount;
  this.dailyGoalProgress += amount;
  this.lastXPEarnedAt = new Date();

  // Update activity date for streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!this.lastActivityDate || new Date(this.lastActivityDate).setHours(0, 0, 0, 0) < today.getTime()) {
    this.lastActivityDate = new Date();
  }

  const newLevel = calculateLevel(this.totalXP);
  const leveledUp = newLevel > previousLevel;

  await this.save();

  return {
    xpAwarded: amount,
    totalXP: this.totalXP,
    dailyXP: this.dailyXP,
    weeklyXP: this.weeklyXP,
    level: newLevel,
    leveledUp,
    previousLevel: leveledUp ? previousLevel : null,
    reason
  };
};

/**
 * Update streak based on activity
 * @returns {Object} Streak info
 */
LearningProgressSchema.methods.updateStreak = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastActivity = this.lastActivityDate ? new Date(this.lastActivityDate) : null;
  if (lastActivity) {
    lastActivity.setHours(0, 0, 0, 0);
  }

  let streakUpdated = false;
  let streakBroken = false;

  if (!lastActivity) {
    // First activity ever
    this.currentStreak = 1;
    streakUpdated = true;
  } else if (lastActivity.getTime() === today.getTime()) {
    // Already active today, no change
  } else if (lastActivity.getTime() === yesterday.getTime()) {
    // Continued streak from yesterday
    this.currentStreak += 1;
    streakUpdated = true;
  } else {
    // Streak broken (missed more than one day)
    // Check if freeze was used
    if (this.streakFreezes > 0 && !this.streakFreezeUsedAt) {
      // Could use freeze (handled separately)
    } else {
      this.currentStreak = 1;
      streakBroken = true;
    }
  }

  // Update longest streak
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }

  this.lastActivityDate = new Date();
  await this.save();

  return {
    currentStreak: this.currentStreak,
    longestStreak: this.longestStreak,
    streakUpdated,
    streakBroken
  };
};

/**
 * Use a streak freeze to protect streak
 * @returns {boolean} Whether freeze was successfully used
 */
LearningProgressSchema.methods.useStreakFreeze = async function() {
  if (this.streakFreezes <= 0) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Can only use one freeze per day
  if (this.streakFreezeUsedAt) {
    const lastFreezeDate = new Date(this.streakFreezeUsedAt);
    lastFreezeDate.setHours(0, 0, 0, 0);
    if (lastFreezeDate.getTime() === today.getTime()) {
      return false;
    }
  }

  this.streakFreezes -= 1;
  this.streakFreezeUsedAt = new Date();
  await this.save();

  return true;
};

/**
 * Reset daily stats (called by scheduled job)
 */
LearningProgressSchema.methods.resetDaily = async function() {
  // Check if daily goal was completed
  const { DAILY_GOALS } = require('../config/xpRewards');
  const goalXP = DAILY_GOALS[this.dailyGoal]?.xpTarget || 30;

  if (this.dailyXP >= goalXP) {
    this.daysCompletedThisWeek += 1;
    this.dailyGoalCompletedAt = new Date();
  }

  this.dailyXP = 0;
  this.dailyGoalProgress = 0;
  await this.save();
};

/**
 * Reset weekly stats (called by scheduled job)
 */
LearningProgressSchema.methods.resetWeekly = async function() {
  this.weeklyXP = 0;
  this.weeklyGoalProgress = 0;
  this.daysCompletedThisWeek = 0;
  await this.save();
};

/**
 * Get or create progress for user
 */
LearningProgressSchema.statics.getOrCreate = async function(userId, targetLanguage) {
  let progress = await this.findOne({ user: userId });

  if (!progress) {
    progress = await this.create({
      user: userId,
      targetLanguage: targetLanguage || 'en'
    });
  }

  return progress;
};

/**
 * Get leaderboard for a language
 */
LearningProgressSchema.statics.getLeaderboard = async function(targetLanguage, type = 'weekly', limit = 50, skip = 0) {
  const sortField = type === 'weekly' ? 'weeklyXP' : 'totalXP';

  const query = targetLanguage ? { targetLanguage } : {};

  const leaderboard = await this.find(query)
    .sort({ [sortField]: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'firstName lastName username images')
    .lean();

  // Add rank
  return leaderboard.map((entry, index) => ({
    rank: skip + index + 1,
    ...entry,
    level: calculateLevel(entry.totalXP)
  }));
};

/**
 * Get user's rank in leaderboard
 */
LearningProgressSchema.statics.getUserRank = async function(userId, targetLanguage, type = 'weekly') {
  const sortField = type === 'weekly' ? 'weeklyXP' : 'totalXP';
  const query = targetLanguage ? { targetLanguage } : {};

  const userProgress = await this.findOne({ user: userId });
  if (!userProgress) return null;

  const userXP = userProgress[sortField];

  const rank = await this.countDocuments({
    ...query,
    [sortField]: { $gt: userXP }
  }) + 1;

  return {
    rank,
    [sortField]: userXP,
    total: await this.countDocuments(query)
  };
};

module.exports = mongoose.model('LearningProgress', LearningProgressSchema);
