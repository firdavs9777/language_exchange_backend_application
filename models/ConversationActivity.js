const mongoose = require('mongoose');

/**
 * ConversationActivity Model
 * Tracks user activity in conversations for learning progress
 */
const ConversationActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },

  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },

  // Activity type
  activityType: {
    type: String,
    enum: [
      'message_sent',           // Sent a message
      'message_received',       // Received a message
      'correction_given',       // Gave a correction
      'correction_received',    // Received a correction
      'correction_accepted',    // Accepted a correction
      'translation_requested',  // Requested translation
      'voice_message_sent',     // Sent voice message
      'voice_message_received'  // Received voice message
    ],
    required: true,
    index: true
  },

  // Language info
  messageLanguage: {
    type: String,
    default: null
  },
  detectedLanguage: {
    type: String,
    default: null
  },
  isTargetLanguage: {
    type: Boolean,
    default: false,
    index: true
  },
  isNativeLanguage: {
    type: Boolean,
    default: false
  },

  // User's target language at time of activity
  userTargetLanguage: {
    type: String,
    required: true
  },
  userNativeLanguage: {
    type: String,
    required: true
  },

  // Partner info
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Message stats
  messageLength: {
    type: Number,
    default: 0
  },
  wordCount: {
    type: Number,
    default: 0
  },

  // Correction details (if applicable)
  correction: {
    originalText: String,
    correctedText: String,
    explanation: String,
    isAccepted: {
      type: Boolean,
      default: false
    }
  },

  // XP awarded for this activity
  xpAwarded: {
    type: Number,
    default: 0
  },

  // Date tracking
  date: {
    type: Date,
    default: Date.now,
    index: true
  },

  // For daily/weekly aggregation
  dateKey: {
    type: String, // Format: YYYY-MM-DD
    index: true
  },
  weekKey: {
    type: String, // Format: YYYY-WW
    index: true
  }

}, { timestamps: true });

// Compound indexes for efficient queries
ConversationActivitySchema.index({ user: 1, date: -1 });
ConversationActivitySchema.index({ user: 1, activityType: 1, date: -1 });
ConversationActivitySchema.index({ user: 1, isTargetLanguage: 1, date: -1 });
ConversationActivitySchema.index({ user: 1, dateKey: 1 });
ConversationActivitySchema.index({ user: 1, weekKey: 1 });
ConversationActivitySchema.index({ conversation: 1, date: -1 });

// Pre-save hook to set date keys
ConversationActivitySchema.pre('save', function(next) {
  if (this.isNew || this.isModified('date')) {
    const d = this.date || new Date();

    // Set date key (YYYY-MM-DD)
    this.dateKey = d.toISOString().split('T')[0];

    // Set week key (YYYY-WW)
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    this.weekKey = `${d.getFullYear()}-${String(weekNum).padStart(2, '0')}`;
  }
  next();
});

/**
 * Get daily activity summary for a user
 */
ConversationActivitySchema.statics.getDailySummary = async function(userId, date = new Date()) {
  const dateKey = date.toISOString().split('T')[0];

  const summary = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        dateKey: dateKey
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: {
          $sum: { $cond: [{ $in: ['$activityType', ['message_sent']] }, 1, 0] }
        },
        targetLanguageMessages: {
          $sum: { $cond: ['$isTargetLanguage', 1, 0] }
        },
        correctionsGiven: {
          $sum: { $cond: [{ $eq: ['$activityType', 'correction_given'] }, 1, 0] }
        },
        correctionsReceived: {
          $sum: { $cond: [{ $eq: ['$activityType', 'correction_received'] }, 1, 0] }
        },
        correctionsAccepted: {
          $sum: { $cond: [{ $eq: ['$activityType', 'correction_accepted'] }, 1, 0] }
        },
        totalXPEarned: { $sum: '$xpAwarded' },
        totalWords: { $sum: '$wordCount' },
        uniquePartners: { $addToSet: '$partner' }
      }
    },
    {
      $project: {
        _id: 0,
        totalMessages: 1,
        targetLanguageMessages: 1,
        correctionsGiven: 1,
        correctionsReceived: 1,
        correctionsAccepted: 1,
        totalXPEarned: 1,
        totalWords: 1,
        uniquePartners: { $size: '$uniquePartners' }
      }
    }
  ]);

  return summary[0] || {
    totalMessages: 0,
    targetLanguageMessages: 0,
    correctionsGiven: 0,
    correctionsReceived: 0,
    correctionsAccepted: 0,
    totalXPEarned: 0,
    totalWords: 0,
    uniquePartners: 0
  };
};

/**
 * Get weekly activity summary for a user
 */
ConversationActivitySchema.statics.getWeeklySummary = async function(userId, weekKey = null) {
  if (!weekKey) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    weekKey = `${now.getFullYear()}-${String(weekNum).padStart(2, '0')}`;
  }

  const summary = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        weekKey: weekKey
      }
    },
    {
      $group: {
        _id: '$dateKey',
        messages: {
          $sum: { $cond: [{ $eq: ['$activityType', 'message_sent'] }, 1, 0] }
        },
        targetLanguageMessages: {
          $sum: { $cond: ['$isTargetLanguage', 1, 0] }
        },
        xpEarned: { $sum: '$xpAwarded' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Fill in missing days with zeros
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const dailyData = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];

    const dayData = summary.find(s => s._id === dateKey) || {
      _id: dateKey,
      messages: 0,
      targetLanguageMessages: 0,
      xpEarned: 0
    };

    dailyData.push({
      date: dateKey,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      ...dayData
    });
  }

  return {
    weekKey,
    dailyData,
    totals: {
      messages: dailyData.reduce((sum, d) => sum + d.messages, 0),
      targetLanguageMessages: dailyData.reduce((sum, d) => sum + d.targetLanguageMessages, 0),
      xpEarned: dailyData.reduce((sum, d) => sum + d.xpEarned, 0),
      activeDays: dailyData.filter(d => d.messages > 0).length
    }
  };
};

/**
 * Get conversation partners stats
 */
ConversationActivitySchema.statics.getPartnerStats = async function(userId, limit = 10) {
  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        activityType: 'message_sent'
      }
    },
    {
      $group: {
        _id: '$partner',
        totalMessages: { $sum: 1 },
        targetLanguageMessages: {
          $sum: { $cond: ['$isTargetLanguage', 1, 0] }
        },
        lastActivity: { $max: '$date' }
      }
    },
    { $sort: { totalMessages: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'partnerInfo'
      }
    },
    { $unwind: '$partnerInfo' },
    {
      $project: {
        _id: 1,
        totalMessages: 1,
        targetLanguageMessages: 1,
        lastActivity: 1,
        partnerName: '$partnerInfo.name',
        partnerImage: { $arrayElemAt: ['$partnerInfo.images', 0] }
      }
    }
  ]);
};

/**
 * Check if user was active today
 */
ConversationActivitySchema.statics.wasActiveToday = async function(userId) {
  const today = new Date().toISOString().split('T')[0];
  const count = await this.countDocuments({
    user: userId,
    dateKey: today
  });
  return count > 0;
};

/**
 * Get language usage breakdown
 */
ConversationActivitySchema.statics.getLanguageUsage = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        activityType: 'message_sent',
        date: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$detectedLanguage',
        count: { $sum: 1 },
        wordCount: { $sum: '$wordCount' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('ConversationActivity', ConversationActivitySchema);
