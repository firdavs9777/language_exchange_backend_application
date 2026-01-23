const mongoose = require('mongoose');

/**
 * UserAchievement Model
 * Tracks user's progress towards and unlocked achievements
 */
const UserAchievementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  achievement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true,
    index: true
  },

  // Achievement code (denormalized for easy queries)
  achievementCode: {
    type: String,
    required: true,
    index: true
  },

  // Progress (0-100 for progressive, or 0/1 for boolean)
  progress: {
    type: Number,
    default: 0,
    min: 0
  },

  // Current count towards goal
  currentValue: {
    type: Number,
    default: 0
  },

  // Target value to unlock
  targetValue: {
    type: Number,
    required: true
  },

  // Is unlocked?
  isUnlocked: {
    type: Boolean,
    default: false,
    index: true
  },

  // When was it unlocked?
  unlockedAt: {
    type: Date,
    default: null
  },

  // XP awarded (if any)
  xpAwarded: {
    type: Number,
    default: 0
  },

  // Has user seen the unlock notification?
  hasSeenNotification: {
    type: Boolean,
    default: false
  },

  // Is this achievement featured on user's profile?
  isFeatured: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// Compound indexes
UserAchievementSchema.index({ user: 1, achievement: 1 }, { unique: true });
UserAchievementSchema.index({ user: 1, isUnlocked: 1, unlockedAt: -1 });
UserAchievementSchema.index({ user: 1, achievementCode: 1 });
UserAchievementSchema.index({ user: 1, isFeatured: 1 });

/**
 * Update progress and check for unlock
 * @param {number} newValue - New current value
 * @returns {Object} Result with unlock status
 */
UserAchievementSchema.methods.updateProgress = async function(newValue) {
  const previouslyUnlocked = this.isUnlocked;

  this.currentValue = newValue;
  this.progress = Math.min(100, Math.floor((newValue / this.targetValue) * 100));

  // Check for unlock
  if (!this.isUnlocked && this.currentValue >= this.targetValue) {
    this.isUnlocked = true;
    this.unlockedAt = new Date();
    this.progress = 100;

    // Get achievement details for XP award
    const Achievement = mongoose.model('Achievement');
    const achievement = await Achievement.findById(this.achievement);
    if (achievement) {
      this.xpAwarded = achievement.xpReward;
    }
  }

  await this.save();

  return {
    progress: this.progress,
    currentValue: this.currentValue,
    isUnlocked: this.isUnlocked,
    justUnlocked: !previouslyUnlocked && this.isUnlocked,
    xpAwarded: this.xpAwarded
  };
};

/**
 * Increment progress by a value
 * @param {number} increment - Amount to add
 */
UserAchievementSchema.methods.incrementProgress = async function(increment = 1) {
  const newValue = this.currentValue + increment;
  return this.updateProgress(newValue);
};

/**
 * Get or create user achievement
 */
UserAchievementSchema.statics.getOrCreate = async function(userId, achievementId, achievementCode, targetValue) {
  let userAchievement = await this.findOne({
    user: userId,
    achievement: achievementId
  });

  if (!userAchievement) {
    userAchievement = await this.create({
      user: userId,
      achievement: achievementId,
      achievementCode,
      targetValue,
      currentValue: 0,
      progress: 0
    });
  }

  return userAchievement;
};

/**
 * Get user's achievements (unlocked and in-progress)
 */
UserAchievementSchema.statics.getUserAchievements = async function(userId, options = {}) {
  const { unlockedOnly = false, category = null, limit = 50 } = options;

  const filter = { user: new mongoose.Types.ObjectId(userId) };
  if (unlockedOnly) filter.isUnlocked = true;

  let pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: 'achievements',
        localField: 'achievement',
        foreignField: '_id',
        as: 'achievementDetails'
      }
    },
    { $unwind: '$achievementDetails' },
    { $match: { 'achievementDetails.isActive': true } }
  ];

  if (category) {
    pipeline.push({ $match: { 'achievementDetails.category': category } });
  }

  pipeline.push(
    {
      $sort: {
        isUnlocked: -1,
        unlockedAt: -1,
        progress: -1
      }
    },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        progress: 1,
        currentValue: 1,
        targetValue: 1,
        isUnlocked: 1,
        unlockedAt: 1,
        isFeatured: 1,
        hasSeenNotification: 1,
        achievement: {
          _id: '$achievementDetails._id',
          code: '$achievementDetails.code',
          name: '$achievementDetails.name',
          description: '$achievementDetails.description',
          icon: '$achievementDetails.icon',
          imageUrl: '$achievementDetails.imageUrl',
          category: '$achievementDetails.category',
          tier: '$achievementDetails.tier',
          xpReward: '$achievementDetails.xpReward',
          isSecret: '$achievementDetails.isSecret'
        }
      }
    }
  );

  return this.aggregate(pipeline);
};

/**
 * Get user's featured achievements
 */
UserAchievementSchema.statics.getFeaturedAchievements = async function(userId, limit = 3) {
  return this.find({
    user: userId,
    isUnlocked: true,
    isFeatured: true
  })
    .populate('achievement', 'code name description icon imageUrl tier')
    .sort({ unlockedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get unseen achievement notifications
 */
UserAchievementSchema.statics.getUnseenAchievements = async function(userId) {
  return this.find({
    user: userId,
    isUnlocked: true,
    hasSeenNotification: false
  })
    .populate('achievement', 'code name description icon imageUrl tier xpReward')
    .sort({ unlockedAt: -1 })
    .lean();
};

/**
 * Mark achievements as seen
 */
UserAchievementSchema.statics.markAsSeen = async function(userId, achievementIds = null) {
  const filter = {
    user: userId,
    isUnlocked: true,
    hasSeenNotification: false
  };

  if (achievementIds && achievementIds.length > 0) {
    filter._id = { $in: achievementIds };
  }

  return this.updateMany(filter, { $set: { hasSeenNotification: true } });
};

/**
 * Get achievement statistics for user
 */
UserAchievementSchema.statics.getStats = async function(userId) {
  const [stats] = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'achievements',
        localField: 'achievement',
        foreignField: '_id',
        as: 'details'
      }
    },
    { $unwind: '$details' },
    { $match: { 'details.isActive': true } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unlocked: { $sum: { $cond: ['$isUnlocked', 1, 0] } },
        totalXP: { $sum: '$xpAwarded' },
        byCategory: {
          $push: {
            category: '$details.category',
            isUnlocked: '$isUnlocked'
          }
        },
        byTier: {
          $push: {
            tier: '$details.tier',
            isUnlocked: '$isUnlocked'
          }
        }
      }
    }
  ]);

  if (!stats) {
    return {
      total: 0,
      unlocked: 0,
      percentage: 0,
      totalXP: 0,
      byCategory: {},
      byTier: {}
    };
  }

  // Process category stats
  const categoryStats = {};
  stats.byCategory.forEach(item => {
    if (!categoryStats[item.category]) {
      categoryStats[item.category] = { total: 0, unlocked: 0 };
    }
    categoryStats[item.category].total += 1;
    if (item.isUnlocked) categoryStats[item.category].unlocked += 1;
  });

  // Process tier stats
  const tierStats = {};
  stats.byTier.forEach(item => {
    if (!tierStats[item.tier]) {
      tierStats[item.tier] = { total: 0, unlocked: 0 };
    }
    tierStats[item.tier].total += 1;
    if (item.isUnlocked) tierStats[item.tier].unlocked += 1;
  });

  return {
    total: stats.total,
    unlocked: stats.unlocked,
    percentage: Math.round((stats.unlocked / stats.total) * 100),
    totalXP: stats.totalXP,
    byCategory: categoryStats,
    byTier: tierStats
  };
};

module.exports = mongoose.model('UserAchievement', UserAchievementSchema);
