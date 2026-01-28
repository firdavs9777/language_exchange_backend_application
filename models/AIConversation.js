const mongoose = require('mongoose');

/**
 * AI Conversation Message Schema
 */
const AIMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Grammar feedback for user messages
  grammarFeedback: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GrammarFeedback'
  },
  // XP awarded for this message
  xpAwarded: {
    type: Number,
    default: 0
  },
  // Response time in milliseconds (for user messages)
  responseTime: Number,
  // Token usage for this message
  tokensUsed: {
    input: Number,
    output: Number
  }
});

/**
 * AI Conversation Schema
 * Stores AI conversation sessions for language practice
 */
const AIConversationSchema = new mongoose.Schema({
  // User who started the conversation
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Language being practiced
  targetLanguage: {
    type: String,
    required: true,
    index: true
  },

  // User's CEFR level at time of conversation
  cefrLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    required: true
  },

  // User's native language for explanations
  nativeLanguage: {
    type: String,
    default: 'en'
  },

  // Conversation topic
  topic: {
    id: String,
    name: String,
    icon: String
  },

  // Practice scenario (optional)
  scenario: {
    id: String,
    name: String,
    description: String
  },

  // Custom topic if user specified one
  customTopic: String,

  // Conversation messages
  messages: [AIMessageSchema],

  // Conversation status
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active',
    index: true
  },

  // Performance metrics
  performance: {
    totalMessages: {
      type: Number,
      default: 0
    },
    userMessages: {
      type: Number,
      default: 0
    },
    correctMessages: {
      type: Number,
      default: 0
    },
    messagesWithErrors: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    // Topics discussed during conversation
    topicsDiscussed: [String],
    // New vocabulary introduced
    newVocabulary: [{
      word: String,
      translation: String,
      introduced: Date
    }],
    // Grammar points covered
    grammarPoints: [String]
  },

  // XP earned in this conversation
  xpEarned: {
    type: Number,
    default: 0
  },

  // Duration in seconds
  duration: {
    type: Number,
    default: 0
  },

  // Token usage totals
  totalTokens: {
    input: {
      type: Number,
      default: 0
    },
    output: {
      type: Number,
      default: 0
    }
  },

  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  lastMessageAt: {
    type: Date,
    default: Date.now
  },

  // Conversation settings
  settings: {
    // Auto-correct mode
    autoCorrect: {
      type: Boolean,
      default: true
    },
    // Formality level
    formality: {
      type: String,
      enum: ['casual', 'neutral', 'formal'],
      default: 'neutral'
    },
    // Show translations
    showTranslations: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for common queries
AIConversationSchema.index({ user: 1, status: 1, createdAt: -1 });
AIConversationSchema.index({ user: 1, targetLanguage: 1, createdAt: -1 });
AIConversationSchema.index({ user: 1, lastMessageAt: -1 });

/**
 * Virtual for message count
 */
AIConversationSchema.virtual('messageCount').get(function() {
  return this.messages ? this.messages.length : 0;
});

/**
 * Pre-save hook to update metrics
 */
AIConversationSchema.pre('save', function(next) {
  // Update performance metrics
  if (this.messages && this.messages.length > 0) {
    this.performance.totalMessages = this.messages.length;
    this.performance.userMessages = this.messages.filter(m => m.role === 'user').length;
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }

  // Calculate duration if ended
  if (this.endedAt && this.startedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }

  next();
});

/**
 * Add a message to the conversation
 */
AIConversationSchema.methods.addMessage = function(role, content, metadata = {}) {
  const message = {
    role,
    content,
    timestamp: new Date(),
    ...metadata
  };

  this.messages.push(message);
  this.lastMessageAt = message.timestamp;

  // Update token totals
  if (metadata.tokensUsed) {
    this.totalTokens.input += metadata.tokensUsed.input || 0;
    this.totalTokens.output += metadata.tokensUsed.output || 0;
  }

  // Update XP
  if (metadata.xpAwarded) {
    this.xpEarned += metadata.xpAwarded;
  }

  return this.save();
};

/**
 * End the conversation
 */
AIConversationSchema.methods.endConversation = function(reason = 'completed') {
  this.status = reason === 'abandoned' ? 'abandoned' : 'completed';
  this.endedAt = new Date();
  this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);

  return this.save();
};

/**
 * Get messages formatted for AI context
 */
AIConversationSchema.methods.getMessagesForAI = function(limit = 20) {
  const messages = this.messages.slice(-limit);
  return messages.map(m => ({
    role: m.role,
    content: m.content
  }));
};

/**
 * Calculate accuracy rate
 */
AIConversationSchema.methods.getAccuracyRate = function() {
  if (this.performance.userMessages === 0) return 0;
  return Math.round(
    (this.performance.correctMessages / this.performance.userMessages) * 100
  );
};

/**
 * Static: Get user's recent conversations
 */
AIConversationSchema.statics.getUserConversations = async function(userId, options = {}) {
  const {
    status,
    targetLanguage,
    limit = 20,
    offset = 0
  } = options;

  const query = { user: userId };

  if (status) {
    query.status = status;
  }

  if (targetLanguage) {
    query.targetLanguage = targetLanguage;
  }

  const conversations = await this.find(query)
    .select('-messages')
    .sort({ lastMessageAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    conversations,
    total,
    hasMore: offset + conversations.length < total
  };
};

/**
 * Static: Get user's conversation stats
 */
AIConversationSchema.statics.getUserStats = async function(userId, targetLanguage = null) {
  const matchQuery = { user: new mongoose.Types.ObjectId(userId) };

  if (targetLanguage) {
    matchQuery.targetLanguage = targetLanguage;
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        completedConversations: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalMessages: { $sum: '$performance.totalMessages' },
        totalUserMessages: { $sum: '$performance.userMessages' },
        totalXPEarned: { $sum: '$xpEarned' },
        totalDuration: { $sum: '$duration' },
        avgMessagesPerConversation: { $avg: '$performance.totalMessages' }
      }
    }
  ]);

  return stats[0] || {
    totalConversations: 0,
    completedConversations: 0,
    totalMessages: 0,
    totalUserMessages: 0,
    totalXPEarned: 0,
    totalDuration: 0,
    avgMessagesPerConversation: 0
  };
};

/**
 * Static: Check if user has active conversation
 */
AIConversationSchema.statics.hasActiveConversation = async function(userId) {
  const active = await this.findOne({
    user: userId,
    status: 'active'
  }).select('_id');

  return !!active;
};

/**
 * Static: Get user's active conversation
 */
AIConversationSchema.statics.getActiveConversation = async function(userId) {
  return await this.findOne({
    user: userId,
    status: 'active'
  });
};

/**
 * Static: Abandon stale conversations
 */
AIConversationSchema.statics.abandonStaleConversations = async function(staleThresholdHours = 24) {
  const staleThreshold = new Date(Date.now() - staleThresholdHours * 60 * 60 * 1000);

  const result = await this.updateMany(
    {
      status: 'active',
      lastMessageAt: { $lt: staleThreshold }
    },
    {
      $set: {
        status: 'abandoned',
        endedAt: new Date()
      }
    }
  );

  return result.modifiedCount;
};

module.exports = mongoose.model('AIConversation', AIConversationSchema);
