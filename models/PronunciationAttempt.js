const mongoose = require('mongoose');

/**
 * Word Score Schema
 */
const WordScoreSchema = new mongoose.Schema({
  word: String,
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  feedback: String
});

/**
 * Pronunciation Attempt Schema
 * Tracks user pronunciation practice
 */
const PronunciationAttemptSchema = new mongoose.Schema({
  // User who made the attempt
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Target text to pronounce
  targetText: {
    type: String,
    required: true
  },

  // Language
  language: {
    type: String,
    required: true,
    index: true
  },

  // User's recorded audio URL
  userAudioUrl: {
    type: String,
    required: true
  },

  // Transcription from Whisper
  transcription: String,

  // Reference TTS audio URL
  referenceAudioUrl: String,

  // Score breakdown
  score: {
    overall: {
      type: Number,
      min: 0,
      max: 100
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 100
    },
    fluency: {
      type: Number,
      min: 0,
      max: 100
    },
    completeness: {
      type: Number,
      min: 0,
      max: 100
    },
    wordScores: [WordScoreSchema]
  },

  // Feedback
  feedback: {
    summary: String,
    improvements: [String],
    strengths: [String]
  },

  // Context
  context: {
    source: {
      type: String,
      enum: ['vocabulary', 'lesson', 'practice', 'challenge'],
      default: 'practice'
    },
    vocabularyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vocabulary'
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson'
    }
  },

  // Recording duration in seconds
  duration: Number,

  // XP awarded
  xpAwarded: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
PronunciationAttemptSchema.index({ user: 1, language: 1, createdAt: -1 });
PronunciationAttemptSchema.index({ user: 1, 'score.overall': -1 });
PronunciationAttemptSchema.index({ 'context.vocabularyId': 1 });

/**
 * Static: Get user's pronunciation history
 */
PronunciationAttemptSchema.statics.getUserHistory = async function(userId, options = {}) {
  const { language, limit = 20, offset = 0 } = options;

  const query = { user: userId };
  if (language) {
    query.language = language;
  }

  const attempts = await this.find(query)
    .select('-userAudioUrl')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    attempts,
    total,
    hasMore: offset + attempts.length < total
  };
};

/**
 * Static: Get user's pronunciation stats
 */
PronunciationAttemptSchema.statics.getUserStats = async function(userId, language = null) {
  const matchQuery = { user: new mongoose.Types.ObjectId(userId) };
  if (language) {
    matchQuery.language = language;
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        averageScore: { $avg: '$score.overall' },
        averageAccuracy: { $avg: '$score.accuracy' },
        averageFluency: { $avg: '$score.fluency' },
        bestScore: { $max: '$score.overall' },
        totalXP: { $sum: '$xpAwarded' },
        totalDuration: { $sum: '$duration' }
      }
    }
  ]);

  // Get improvement over time
  const recentAvg = await this.aggregate([
    { $match: matchQuery },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    {
      $group: {
        _id: null,
        recentAverage: { $avg: '$score.overall' }
      }
    }
  ]);

  const baseStats = stats[0] || {
    totalAttempts: 0,
    averageScore: 0,
    averageAccuracy: 0,
    averageFluency: 0,
    bestScore: 0,
    totalXP: 0,
    totalDuration: 0
  };

  return {
    ...baseStats,
    recentAverage: recentAvg[0]?.recentAverage || 0,
    averageScore: Math.round(baseStats.averageScore || 0),
    averageAccuracy: Math.round(baseStats.averageAccuracy || 0),
    averageFluency: Math.round(baseStats.averageFluency || 0)
  };
};

/**
 * Static: Get best attempt for a text
 */
PronunciationAttemptSchema.statics.getBestAttempt = async function(userId, targetText) {
  return await this.findOne({
    user: userId,
    targetText
  }).sort({ 'score.overall': -1 });
};

module.exports = mongoose.model('PronunciationAttempt', PronunciationAttemptSchema);
