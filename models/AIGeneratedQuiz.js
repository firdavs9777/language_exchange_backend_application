const mongoose = require('mongoose');

/**
 * AI Quiz Question Schema
 */
const AIQuizQuestionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple_choice', 'fill_blank', 'translation', 'matching', 'ordering'],
    required: true
  },
  question: {
    type: String,
    required: true
  },
  targetText: String,
  options: [{
    text: String,
    isCorrect: Boolean
  }],
  correctAnswer: mongoose.Schema.Types.Mixed,
  acceptedAnswers: [String],
  explanation: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  points: {
    type: Number,
    default: 10
  },
  tags: [String],
  sourceType: {
    type: String,
    enum: ['vocabulary', 'lesson', 'weak_area', 'ai_generated'],
    default: 'ai_generated'
  },
  sourceId: mongoose.Schema.Types.ObjectId
});

/**
 * Target Area Schema
 */
const TargetAreaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['vocabulary', 'grammar', 'topic', 'lesson'],
    required: true
  },
  identifier: String,
  weaknessScore: {
    type: Number,
    min: 0,
    max: 1
  }
});

/**
 * AI Generated Quiz Schema
 */
const AIGeneratedQuizSchema = new mongoose.Schema({
  // User this quiz was generated for
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

  // User's level at generation
  proficiencyLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    default: 'A1'
  },

  // Quiz metadata
  title: {
    type: String,
    required: true
  },
  description: String,

  // Areas this quiz targets
  targetAreas: [TargetAreaSchema],

  // Source content
  sourceVocabulary: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vocabulary'
  }],
  sourceLessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],

  // Quiz content
  questions: [AIQuizQuestionSchema],

  // Settings
  settings: {
    questionCount: {
      type: Number,
      default: 10
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'adaptive'],
      default: 'adaptive'
    },
    timeLimit: Number,
    shuffleQuestions: {
      type: Boolean,
      default: true
    },
    shuffleOptions: {
      type: Boolean,
      default: true
    }
  },

  // Estimated time in minutes
  estimatedMinutes: {
    type: Number,
    default: 5
  },

  // XP reward
  xpReward: {
    type: Number,
    default: 25
  },

  // Status
  status: {
    type: String,
    enum: ['ready', 'in_progress', 'completed', 'expired'],
    default: 'ready',
    index: true
  },

  // Attempt tracking
  attemptCount: {
    type: Number,
    default: 0
  },
  lastAttemptAt: Date,
  bestScore: Number,

  // Expiration
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },

  // Generation metadata
  tokensUsed: {
    input: Number,
    output: Number
  },
  generationTimeMs: Number
}, {
  timestamps: true
});

// Indexes
AIGeneratedQuizSchema.index({ user: 1, status: 1, createdAt: -1 });
AIGeneratedQuizSchema.index({ user: 1, expiresAt: 1 });
AIGeneratedQuizSchema.index({ 'targetAreas.identifier': 1 });

// TTL index
AIGeneratedQuizSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Virtual for total points
 */
AIGeneratedQuizSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, q) => sum + (q.points || 10), 0);
});

/**
 * Check if quiz is still valid
 */
AIGeneratedQuizSchema.methods.isValid = function() {
  return this.status !== 'expired' && this.expiresAt > new Date();
};

/**
 * Start the quiz
 */
AIGeneratedQuizSchema.methods.start = function() {
  this.status = 'in_progress';
  this.attemptCount += 1;
  this.lastAttemptAt = new Date();
  return this.save();
};

/**
 * Complete the quiz
 */
AIGeneratedQuizSchema.methods.complete = function(score) {
  this.status = 'completed';
  if (!this.bestScore || score > this.bestScore) {
    this.bestScore = score;
  }
  return this.save();
};

/**
 * Static: Get user's pending quizzes
 */
AIGeneratedQuizSchema.statics.getPendingQuizzes = async function(userId, limit = 5) {
  return await this.find({
    user: userId,
    status: { $in: ['ready', 'in_progress'] },
    expiresAt: { $gt: new Date() }
  })
    .select('-questions.correctAnswer -questions.acceptedAnswers')
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Static: Get user's quiz stats
 */
AIGeneratedQuizSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalQuizzes: { $sum: 1 },
        completedQuizzes: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalAttempts: { $sum: '$attemptCount' },
        averageBestScore: { $avg: '$bestScore' }
      }
    }
  ]);

  return stats[0] || {
    totalQuizzes: 0,
    completedQuizzes: 0,
    totalAttempts: 0,
    averageBestScore: 0
  };
};

module.exports = mongoose.model('AIGeneratedQuiz', AIGeneratedQuizSchema);
