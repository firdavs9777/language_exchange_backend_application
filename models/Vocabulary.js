const mongoose = require('mongoose');
const { SRS_INTERVALS, getNextReviewDate } = require('../config/xpRewards');

/**
 * Vocabulary Model
 * Stores user's saved vocabulary with SRS (Spaced Repetition System) for review
 */
const VocabularySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The word/phrase
  word: {
    type: String,
    required: [true, 'Word is required'],
    trim: true,
    maxlength: [200, 'Word cannot exceed 200 characters']
  },

  // Translation in user's native language
  translation: {
    type: String,
    required: [true, 'Translation is required'],
    trim: true,
    maxlength: [500, 'Translation cannot exceed 500 characters']
  },

  // Language of the word
  language: {
    type: String,
    required: true,
    index: true
  },

  // User's native language (for translation)
  nativeLanguage: {
    type: String,
    required: true
  },

  // Part of speech
  partOfSpeech: {
    type: String,
    enum: ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'phrase', 'other'],
    default: 'other'
  },

  // Example sentences
  examples: [{
    sentence: {
      type: String,
      maxlength: 500
    },
    translation: {
      type: String,
      maxlength: 500
    }
  }],

  // Context where the word was found
  context: {
    source: {
      type: String,
      enum: ['conversation', 'lesson', 'manual', 'quiz', 'import'],
      default: 'manual'
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    },
    originalSentence: String
  },

  // Pronunciation (IPA or phonetic)
  pronunciation: {
    type: String,
    maxlength: 100
  },

  // Audio URL for pronunciation
  audioUrl: {
    type: String
  },

  // Image URL (for visual learners)
  imageUrl: {
    type: String
  },

  // User's personal notes
  notes: {
    type: String,
    maxlength: 1000
  },

  // Tags for organization
  tags: [{
    type: String,
    maxlength: 50
  }],

  // ========== SRS (Spaced Repetition System) ==========

  // SRS Level (0-9, where 9 = mastered)
  srsLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 9,
    index: true
  },

  // Ease factor (SM-2 algorithm) - how easy the card is
  easeFactor: {
    type: Number,
    default: 2.5,
    min: 1.3
  },

  // Interval in days until next review
  interval: {
    type: Number,
    default: 0
  },

  // Next review date
  nextReview: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Review statistics
  reviewStats: {
    totalReviews: {
      type: Number,
      default: 0
    },
    correctReviews: {
      type: Number,
      default: 0
    },
    incorrectReviews: {
      type: Number,
      default: 0
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    lastReviewedAt: {
      type: Date,
      default: null
    },
    firstReviewedAt: {
      type: Date,
      default: null
    }
  },

  // Review history (last 10 reviews for analytics)
  reviewHistory: [{
    reviewedAt: {
      type: Date,
      default: Date.now
    },
    quality: {
      type: Number, // 0-5 (SM-2 quality rating)
      min: 0,
      max: 5
    },
    responseTime: {
      type: Number // Milliseconds to respond
    },
    wasCorrect: Boolean
  }],

  // Status
  isMastered: {
    type: Boolean,
    default: false,
    index: true
  },
  masteredAt: {
    type: Date
  },

  // Soft delete
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  archivedAt: Date,

  // Favorite/starred
  isFavorite: {
    type: Boolean,
    default: false,
    index: true
  }

}, { timestamps: true });

// Compound indexes
VocabularySchema.index({ user: 1, language: 1, createdAt: -1 });
VocabularySchema.index({ user: 1, nextReview: 1, isArchived: 1 });
VocabularySchema.index({ user: 1, srsLevel: 1 });
VocabularySchema.index({ user: 1, isMastered: 1 });
VocabularySchema.index({ user: 1, tags: 1 });
VocabularySchema.index({ user: 1, word: 1 }, { unique: true }); // Prevent duplicate words per user

/**
 * Process a review using SM-2 algorithm
 * @param {number} quality - Review quality (0-5)
 *   0 - Complete blackout
 *   1 - Incorrect, but remembered upon seeing answer
 *   2 - Incorrect, but answer was easy to recall
 *   3 - Correct with difficulty
 *   4 - Correct with some hesitation
 *   5 - Perfect recall
 * @param {number} responseTime - Time in ms to respond
 */
VocabularySchema.methods.processReview = async function(quality, responseTime = null) {
  const wasCorrect = quality >= 3;

  // Update review stats
  this.reviewStats.totalReviews += 1;
  this.reviewStats.lastReviewedAt = new Date();

  if (!this.reviewStats.firstReviewedAt) {
    this.reviewStats.firstReviewedAt = new Date();
  }

  if (wasCorrect) {
    this.reviewStats.correctReviews += 1;
    this.reviewStats.currentStreak += 1;

    if (this.reviewStats.currentStreak > this.reviewStats.longestStreak) {
      this.reviewStats.longestStreak = this.reviewStats.currentStreak;
    }
  } else {
    this.reviewStats.incorrectReviews += 1;
    this.reviewStats.currentStreak = 0;
  }

  // Add to review history (keep last 10)
  this.reviewHistory.push({
    reviewedAt: new Date(),
    quality,
    responseTime,
    wasCorrect
  });

  if (this.reviewHistory.length > 10) {
    this.reviewHistory = this.reviewHistory.slice(-10);
  }

  // SM-2 Algorithm Implementation
  if (quality < 3) {
    // Failed review - reset to beginning
    this.srsLevel = 0;
    this.interval = 0;
    this.nextReview = new Date(); // Review again today
  } else {
    // Successful review
    if (this.srsLevel === 0) {
      this.interval = 1;
    } else if (this.srsLevel === 1) {
      this.interval = 6;
    } else {
      this.interval = Math.round(this.interval * this.easeFactor);
    }

    // Increase SRS level (capped at 9)
    this.srsLevel = Math.min(this.srsLevel + 1, 9);

    // Calculate next review date
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + this.interval);
    this.nextReview = nextDate;
  }

  // Update ease factor based on quality
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  this.easeFactor = Math.max(
    1.3,
    this.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Check if mastered (SRS level 9)
  if (this.srsLevel >= 9 && !this.isMastered) {
    this.isMastered = true;
    this.masteredAt = new Date();
  }

  await this.save();

  return {
    wasCorrect,
    newSrsLevel: this.srsLevel,
    nextReview: this.nextReview,
    interval: this.interval,
    isMastered: this.isMastered,
    justMastered: this.srsLevel >= 9 && this.isMastered && !this.masteredAt
  };
};

/**
 * Get words due for review
 */
VocabularySchema.statics.getDueForReview = async function(userId, limit = 20) {
  const now = new Date();

  return this.find({
    user: userId,
    nextReview: { $lte: now },
    isArchived: false
  })
    .sort({ nextReview: 1, srsLevel: 1 }) // Prioritize overdue and lower SRS level
    .limit(limit)
    .lean();
};

/**
 * Get review statistics for user
 */
VocabularySchema.statics.getReviewStats = async function(userId) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [stats] = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), isArchived: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        mastered: { $sum: { $cond: ['$isMastered', 1, 0] } },
        learning: { $sum: { $cond: [{ $and: [{ $gt: ['$srsLevel', 0] }, { $lt: ['$srsLevel', 9] }] }, 1, 0] } },
        new: { $sum: { $cond: [{ $eq: ['$srsLevel', 0] }, 1, 0] } },
        dueNow: {
          $sum: { $cond: [{ $lte: ['$nextReview', now] }, 1, 0] }
        },
        dueToday: {
          $sum: { $cond: [{ $and: [{ $gte: ['$nextReview', today] }, { $lt: ['$nextReview', tomorrow] }] }, 1, 0] }
        },
        totalReviews: { $sum: '$reviewStats.totalReviews' },
        correctReviews: { $sum: '$reviewStats.correctReviews' }
      }
    },
    {
      $project: {
        _id: 0,
        total: 1,
        mastered: 1,
        learning: 1,
        new: 1,
        dueNow: 1,
        dueToday: 1,
        totalReviews: 1,
        correctReviews: 1,
        accuracy: {
          $cond: [
            { $gt: ['$totalReviews', 0] },
            { $multiply: [{ $divide: ['$correctReviews', '$totalReviews'] }, 100] },
            0
          ]
        }
      }
    }
  ]);

  return stats || {
    total: 0,
    mastered: 0,
    learning: 0,
    new: 0,
    dueNow: 0,
    dueToday: 0,
    totalReviews: 0,
    correctReviews: 0,
    accuracy: 0
  };
};

/**
 * Get vocabulary by SRS level distribution
 */
VocabularySchema.statics.getSrsDistribution = async function(userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), isArchived: false } },
    {
      $group: {
        _id: '$srsLevel',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

/**
 * Search vocabulary
 */
VocabularySchema.statics.searchVocabulary = async function(userId, query, options = {}) {
  const {
    language,
    tags,
    srsLevel,
    isMastered,
    isFavorite,
    limit = 50,
    skip = 0,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  const filter = {
    user: new mongoose.Types.ObjectId(userId),
    isArchived: false
  };

  // Text search
  if (query) {
    filter.$or = [
      { word: { $regex: query, $options: 'i' } },
      { translation: { $regex: query, $options: 'i' } },
      { notes: { $regex: query, $options: 'i' } }
    ];
  }

  // Additional filters
  if (language) filter.language = language;
  if (tags && tags.length > 0) filter.tags = { $in: tags };
  if (srsLevel !== undefined) filter.srsLevel = srsLevel;
  if (isMastered !== undefined) filter.isMastered = isMastered;
  if (isFavorite !== undefined) filter.isFavorite = isFavorite;

  const [words, total] = await Promise.all([
    this.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);

  return {
    words,
    total,
    page: Math.floor(skip / limit) + 1,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Get daily review forecast (next 7 days)
 */
VocabularySchema.statics.getReviewForecast = async function(userId, days = 7) {
  const forecast = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await this.countDocuments({
      user: userId,
      nextReview: { $gte: dayStart, $lt: dayEnd },
      isArchived: false
    });

    forecast.push({
      date: dayStart.toISOString().split('T')[0],
      dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      count
    });
  }

  return forecast;
};

module.exports = mongoose.model('Vocabulary', VocabularySchema);
