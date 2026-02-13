const mongoose = require('mongoose');

/**
 * Grammar Error Schema
 */
const GrammarErrorSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['grammar', 'spelling', 'vocabulary', 'style', 'punctuation'],
    required: true
  },
  severity: {
    type: String,
    enum: ['minor', 'moderate', 'major'],
    default: 'moderate'
  },
  originalSegment: {
    type: String,
    required: true
  },
  correctedSegment: {
    type: String,
    required: true
  },
  startIndex: Number,
  endIndex: Number,
  explanation: String,
  nativeExplanation: String,
  rule: String,
  examples: [String]
});

/**
 * Suggestion Schema
 */
const SuggestionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['improvement', 'alternative', 'native_speaker'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  explanation: String
});

/**
 * Grammar Feedback Schema
 * Stores grammar analysis results for user messages
 */
const GrammarFeedbackSchema = new mongoose.Schema({
  // User who requested feedback
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Source message (if from a conversation)
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // AI Conversation (if from AI chat)
  aiConversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIConversation'
  },

  // Original text that was analyzed
  originalText: {
    type: String,
    required: true
  },

  // Language of the text
  targetLanguage: {
    type: String,
    required: true
  },

  // User's native language (for explanations)
  nativeLanguage: {
    type: String,
    default: 'en'
  },

  // User's CEFR level
  cefrLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    default: 'A1'
  },

  // Overall score (0-100)
  overallScore: {
    type: Number,
    min: 0,
    max: 100
  },

  // List of errors found
  errors: [GrammarErrorSchema],

  // Improvement suggestions
  suggestions: [SuggestionSchema],

  // Positive feedback
  positives: [String],

  // Summary of feedback
  summary: String,

  // Corrected version of the full text
  correctedText: String,

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'viewed', 'applied', 'dismissed'],
    default: 'pending'
  },

  // How feedback was requested
  requestedBy: {
    type: String,
    enum: ['auto', 'user', 'ai_conversation'],
    default: 'user'
  },

  // Token usage for cost tracking
  tokensUsed: {
    input: Number,
    output: Number
  },

  // Whether user applied the corrections
  correctionsApplied: {
    type: Boolean,
    default: false
  },

  // XP awarded
  xpAwarded: {
    type: Number,
    default: 0
  },

  // Timestamps
  viewedAt: Date,
  appliedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  suppressReservedKeysWarning: true // 'errors' is intentionally used as a field name
});

// Indexes
GrammarFeedbackSchema.index({ user: 1, createdAt: -1 });
GrammarFeedbackSchema.index({ message: 1 });
GrammarFeedbackSchema.index({ aiConversation: 1 });
GrammarFeedbackSchema.index({ user: 1, targetLanguage: 1 });
GrammarFeedbackSchema.index({ status: 1, createdAt: -1 });

/**
 * Virtual for error count
 */
GrammarFeedbackSchema.virtual('errorCount').get(function() {
  return this.errors ? this.errors.length : 0;
});

/**
 * Virtual for whether text was perfect
 */
GrammarFeedbackSchema.virtual('isPerfect').get(function() {
  return this.errors && this.errors.length === 0;
});

/**
 * Mark feedback as viewed
 */
GrammarFeedbackSchema.methods.markViewed = function() {
  this.status = 'viewed';
  this.viewedAt = new Date();
  return this.save();
};

/**
 * Mark corrections as applied
 */
GrammarFeedbackSchema.methods.markApplied = function() {
  this.status = 'applied';
  this.appliedAt = new Date();
  this.correctionsApplied = true;
  return this.save();
};

/**
 * Dismiss feedback
 */
GrammarFeedbackSchema.methods.dismiss = function() {
  this.status = 'dismissed';
  return this.save();
};

/**
 * Static: Get user's feedback history
 */
GrammarFeedbackSchema.statics.getUserHistory = async function(userId, options = {}) {
  const {
    targetLanguage,
    status,
    limit = 20,
    offset = 0
  } = options;

  const query = { user: userId };

  if (targetLanguage) {
    query.targetLanguage = targetLanguage;
  }

  if (status) {
    query.status = status;
  }

  const feedbacks = await this.find(query)
    .select('-errors.examples -suggestions')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    feedbacks,
    total,
    hasMore: offset + feedbacks.length < total
  };
};

/**
 * Static: Get user's grammar stats
 */
GrammarFeedbackSchema.statics.getUserStats = async function(userId, targetLanguage = null) {
  const matchQuery = { user: new mongoose.Types.ObjectId(userId) };

  if (targetLanguage) {
    matchQuery.targetLanguage = targetLanguage;
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalFeedbacks: { $sum: 1 },
        totalErrors: { $sum: { $size: '$errors' } },
        averageScore: { $avg: '$overallScore' },
        perfectMessages: {
          $sum: { $cond: [{ $eq: [{ $size: '$errors' }, 0] }, 1, 0] }
        },
        correctionsApplied: {
          $sum: { $cond: ['$correctionsApplied', 1, 0] }
        }
      }
    }
  ]);

  // Get error breakdown by type
  const errorBreakdown = await this.aggregate([
    { $match: matchQuery },
    { $unwind: '$errors' },
    {
      $group: {
        _id: '$errors.type',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const baseStats = stats[0] || {
    totalFeedbacks: 0,
    totalErrors: 0,
    averageScore: 0,
    perfectMessages: 0,
    correctionsApplied: 0
  };

  return {
    ...baseStats,
    errorBreakdown: errorBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    accuracyRate: baseStats.totalFeedbacks > 0
      ? Math.round((baseStats.perfectMessages / baseStats.totalFeedbacks) * 100)
      : 0
  };
};

/**
 * Static: Get common errors for a user
 */
GrammarFeedbackSchema.statics.getCommonErrors = async function(userId, limit = 10) {
  const errors = await this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $unwind: '$errors' },
    {
      $group: {
        _id: {
          type: '$errors.type',
          rule: '$errors.rule'
        },
        count: { $sum: 1 },
        example: { $first: '$errors.originalSegment' },
        correction: { $first: '$errors.correctedSegment' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);

  return errors.map(e => ({
    type: e._id.type,
    rule: e._id.rule,
    count: e.count,
    example: e.example,
    correction: e.correction
  }));
};

module.exports = mongoose.model('GrammarFeedback', GrammarFeedbackSchema);
