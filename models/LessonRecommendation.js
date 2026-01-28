const mongoose = require('mongoose');

/**
 * Weak Area Schema
 */
const WeakAreaSchema = new mongoose.Schema({
  topic: String,
  category: String,
  score: {
    type: Number,
    min: 0,
    max: 1
  },
  mistakeRate: Number,
  lastPracticed: Date
});

/**
 * Recommendation Item Schema
 */
const RecommendationItemSchema = new mongoose.Schema({
  lesson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true
  },
  score: {
    type: Number,
    min: 0,
    max: 100
  },
  reasons: [String],
  priority: Number,
  recommendationType: {
    type: String,
    enum: ['weak_area', 'next_in_sequence', 'refresh', 'goal_aligned', 'popular'],
    default: 'next_in_sequence'
  }
});

/**
 * Lesson Recommendation Schema
 * Caches AI-generated lesson recommendations for users
 */
const LessonRecommendationSchema = new mongoose.Schema({
  // User this recommendation is for
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Target language
  language: {
    type: String,
    required: true
  },

  // User's proficiency level at generation time
  proficiencyLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    default: 'A1'
  },

  // Recommended lessons
  recommendations: [RecommendationItemSchema],

  // Identified weak areas
  weakAreas: [WeakAreaSchema],

  // User context at generation time
  context: {
    completedLessonCount: Number,
    averageScore: Number,
    learningPace: {
      type: String,
      enum: ['slow', 'moderate', 'fast'],
      default: 'moderate'
    },
    recentTopics: [String],
    dailyGoal: Number,
    currentStreak: Number
  },

  // AI-generated insight
  learningInsight: String,

  // Cache management
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  invalidatedAt: Date,

  // Tracking
  tokensUsed: {
    input: Number,
    output: Number
  },

  // Whether this was AI-generated or rule-based fallback
  generationType: {
    type: String,
    enum: ['ai', 'fallback'],
    default: 'ai'
  }
}, {
  timestamps: true
});

// Compound indexes
LessonRecommendationSchema.index({ user: 1, language: 1 });
LessonRecommendationSchema.index({ user: 1, expiresAt: 1 });

// TTL index - auto-delete expired recommendations
LessonRecommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Check if recommendations are still valid
 */
LessonRecommendationSchema.methods.isValid = function() {
  return !this.invalidatedAt && this.expiresAt > new Date();
};

/**
 * Invalidate recommendations
 */
LessonRecommendationSchema.methods.invalidate = function() {
  this.invalidatedAt = new Date();
  return this.save();
};

/**
 * Static: Get valid recommendations for user
 */
LessonRecommendationSchema.statics.getValidRecommendations = async function(userId, language) {
  return await this.findOne({
    user: userId,
    language,
    expiresAt: { $gt: new Date() },
    invalidatedAt: { $exists: false }
  }).populate('recommendations.lesson', 'title slug level category topic icon estimatedMinutes xpReward isPremium unit');
};

/**
 * Static: Invalidate all recommendations for user
 */
LessonRecommendationSchema.statics.invalidateForUser = async function(userId) {
  return await this.updateMany(
    { user: userId, invalidatedAt: { $exists: false } },
    { $set: { invalidatedAt: new Date() } }
  );
};

module.exports = mongoose.model('LessonRecommendation', LessonRecommendationSchema);
