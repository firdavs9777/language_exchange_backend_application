const mongoose = require('mongoose');

/**
 * ChallengeProgress Model
 * Tracks user's progress on challenges
 */
const ChallengeProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  challenge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
    index: true
  },

  // Progress tracking
  currentValue: {
    type: Number,
    default: 0
  },
  targetValue: {
    type: Number,
    required: true
  },
  progress: {
    type: Number, // 0-100
    default: 0
  },

  // Completion status
  isCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  },

  // Rewards
  xpAwarded: {
    type: Number,
    default: 0
  },
  bonusAwarded: {
    type: Boolean,
    default: false
  },

  // Has user seen the completion notification?
  hasSeenNotification: {
    type: Boolean,
    default: false
  },

  // Challenge period (denormalized for queries)
  startsAt: {
    type: Date,
    required: true
  },
  endsAt: {
    type: Date,
    required: true
  },
  challengeType: {
    type: String,
    enum: ['daily', 'weekly', 'special'],
    required: true,
    index: true
  }

}, { timestamps: true });

// Compound indexes
ChallengeProgressSchema.index({ user: 1, challenge: 1 }, { unique: true });
ChallengeProgressSchema.index({ user: 1, isCompleted: 1, challengeType: 1 });
ChallengeProgressSchema.index({ user: 1, startsAt: 1, endsAt: 1 });

/**
 * Update progress and check for completion
 * @param {number} newValue - New current value
 */
ChallengeProgressSchema.methods.updateProgress = async function(newValue) {
  const wasCompleted = this.isCompleted;

  this.currentValue = newValue;
  this.progress = Math.min(100, Math.floor((newValue / this.targetValue) * 100));

  // Check for completion
  if (!this.isCompleted && this.currentValue >= this.targetValue) {
    this.isCompleted = true;
    this.completedAt = new Date();
    this.progress = 100;

    // Get challenge details for XP award
    const Challenge = mongoose.model('Challenge');
    const challenge = await Challenge.findById(this.challenge);
    if (challenge) {
      this.xpAwarded = challenge.xpReward;
      if (challenge.bonusReward?.type) {
        this.bonusAwarded = true;
      }
    }
  }

  await this.save();

  return {
    progress: this.progress,
    currentValue: this.currentValue,
    isCompleted: this.isCompleted,
    justCompleted: !wasCompleted && this.isCompleted,
    xpAwarded: this.xpAwarded,
    bonusAwarded: this.bonusAwarded
  };
};

/**
 * Increment progress
 * @param {number} increment - Amount to add
 */
ChallengeProgressSchema.methods.incrementProgress = async function(increment = 1) {
  const newValue = this.currentValue + increment;
  return this.updateProgress(newValue);
};

/**
 * Get or create challenge progress for user
 */
ChallengeProgressSchema.statics.getOrCreate = async function(userId, challengeId) {
  let progress = await this.findOne({ user: userId, challenge: challengeId });

  if (!progress) {
    const Challenge = mongoose.model('Challenge');
    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    progress = await this.create({
      user: userId,
      challenge: challengeId,
      targetValue: challenge.requirement.value,
      startsAt: challenge.startsAt,
      endsAt: challenge.endsAt,
      challengeType: challenge.type
    });
  }

  return progress;
};

/**
 * Get user's active challenges with progress
 */
ChallengeProgressSchema.statics.getUserActiveChallenges = async function(userId, type = null) {
  const now = new Date();

  const filter = {
    user: new mongoose.Types.ObjectId(userId),
    startsAt: { $lte: now },
    endsAt: { $gt: now }
  };

  if (type) filter.challengeType = type;

  return this.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'challenges',
        localField: 'challenge',
        foreignField: '_id',
        as: 'challengeDetails'
      }
    },
    { $unwind: '$challengeDetails' },
    { $match: { 'challengeDetails.isActive': true } },
    {
      $project: {
        _id: 1,
        currentValue: 1,
        targetValue: 1,
        progress: 1,
        isCompleted: 1,
        completedAt: 1,
        xpAwarded: 1,
        bonusAwarded: 1,
        startsAt: 1,
        endsAt: 1,
        challengeType: 1,
        challenge: {
          _id: '$challengeDetails._id',
          title: '$challengeDetails.title',
          description: '$challengeDetails.description',
          type: '$challengeDetails.type',
          category: '$challengeDetails.category',
          requirement: '$challengeDetails.requirement',
          xpReward: '$challengeDetails.xpReward',
          bonusReward: '$challengeDetails.bonusReward',
          icon: '$challengeDetails.icon',
          difficulty: '$challengeDetails.difficulty'
        }
      }
    },
    { $sort: { isCompleted: 1, progress: -1 } }
  ]);
};

/**
 * Get unseen challenge completions
 */
ChallengeProgressSchema.statics.getUnseenCompletions = async function(userId) {
  return this.find({
    user: userId,
    isCompleted: true,
    hasSeenNotification: false
  })
    .populate('challenge', 'title description icon xpReward bonusReward')
    .sort({ completedAt: -1 })
    .lean();
};

/**
 * Mark completions as seen
 */
ChallengeProgressSchema.statics.markAsSeen = async function(userId, progressIds = null) {
  const filter = {
    user: userId,
    isCompleted: true,
    hasSeenNotification: false
  };

  if (progressIds && progressIds.length > 0) {
    filter._id = { $in: progressIds };
  }

  return this.updateMany(filter, { $set: { hasSeenNotification: true } });
};

/**
 * Get challenge completion stats for user
 */
ChallengeProgressSchema.statics.getStats = async function(userId) {
  const [stats] = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        totalXP: { $sum: '$xpAwarded' },
        dailyCompleted: {
          $sum: {
            $cond: [{ $and: ['$isCompleted', { $eq: ['$challengeType', 'daily'] }] }, 1, 0]
          }
        },
        weeklyCompleted: {
          $sum: {
            $cond: [{ $and: ['$isCompleted', { $eq: ['$challengeType', 'weekly'] }] }, 1, 0]
          }
        }
      }
    }
  ]);

  return stats || {
    total: 0,
    completed: 0,
    totalXP: 0,
    dailyCompleted: 0,
    weeklyCompleted: 0
  };
};

/**
 * Initialize challenges for a user (call when user accesses challenges)
 */
ChallengeProgressSchema.statics.initializeUserChallenges = async function(userId) {
  const Challenge = mongoose.model('Challenge');
  const now = new Date();

  // Get all active challenges
  const activeChallenges = await Challenge.find({
    isActive: true,
    isTemplate: false,
    startsAt: { $lte: now },
    endsAt: { $gt: now }
  });

  // Create progress records for challenges user doesn't have
  const existingProgress = await this.find({
    user: userId,
    challenge: { $in: activeChallenges.map(c => c._id) }
  });

  const existingChallengeIds = new Set(existingProgress.map(p => p.challenge.toString()));

  const newProgress = activeChallenges
    .filter(c => !existingChallengeIds.has(c._id.toString()))
    .map(challenge => ({
      user: userId,
      challenge: challenge._id,
      targetValue: challenge.requirement.value,
      startsAt: challenge.startsAt,
      endsAt: challenge.endsAt,
      challengeType: challenge.type
    }));

  if (newProgress.length > 0) {
    await this.insertMany(newProgress);
  }

  return this.getUserActiveChallenges(userId);
};

module.exports = mongoose.model('ChallengeProgress', ChallengeProgressSchema);
