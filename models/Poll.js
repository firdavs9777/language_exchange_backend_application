const mongoose = require('mongoose');

/**
 * Poll Schema - For in-chat polls (KakaoTalk/Telegram style)
 */
const PollSchema = new mongoose.Schema({
  // The message this poll is attached to
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    index: true
  },
  
  // Conversation this poll belongs to
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  
  // Poll creator
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Poll question
  question: {
    type: String,
    required: [true, 'Poll question is required'],
    maxlength: [500, 'Question cannot exceed 500 characters'],
    trim: true
  },
  
  // Poll options
  options: [{
    text: {
      type: String,
      required: true,
      maxlength: [200, 'Option cannot exceed 200 characters'],
      trim: true
    },
    votes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      votedAt: {
        type: Date,
        default: Date.now
      }
    }],
    voteCount: {
      type: Number,
      default: 0
    }
  }],
  
  // Poll settings
  settings: {
    // Allow multiple votes per user
    allowMultipleVotes: {
      type: Boolean,
      default: false
    },
    // Maximum votes per user (if multiple allowed)
    maxVotesPerUser: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    },
    // Anonymous voting
    isAnonymous: {
      type: Boolean,
      default: false
    },
    // Show results before voting
    showResultsBeforeVote: {
      type: Boolean,
      default: false
    },
    // Allow users to add options
    allowAddOptions: {
      type: Boolean,
      default: false
    },
    // Quiz mode (one correct answer)
    isQuiz: {
      type: Boolean,
      default: false
    },
    // Correct option index (for quiz mode)
    correctOptionIndex: {
      type: Number,
      default: null
    },
    // Explanation for correct answer (quiz mode)
    explanation: {
      type: String,
      maxlength: 500
    }
  },
  
  // Poll status
  status: {
    type: String,
    enum: ['active', 'closed', 'expired'],
    default: 'active'
  },
  
  // Poll expiration
  expiresAt: {
    type: Date,
    default: null
  },
  
  // When poll was closed
  closedAt: {
    type: Date,
    default: null
  },
  
  // Who closed the poll
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Total vote count (for quick access)
  totalVotes: {
    type: Number,
    default: 0
  },
  
  // Unique voters count
  uniqueVoters: {
    type: Number,
    default: 0
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
PollSchema.index({ conversation: 1, createdAt: -1 });
PollSchema.index({ creator: 1 });
PollSchema.index({ expiresAt: 1 }, { sparse: true });
PollSchema.index({ status: 1 });

// Pre-save hook
PollSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Update vote counts
  this.options.forEach(option => {
    option.voteCount = option.votes.length;
  });
  
  this.totalVotes = this.options.reduce((sum, opt) => sum + opt.voteCount, 0);
  
  // Count unique voters
  const allVoters = new Set();
  this.options.forEach(option => {
    option.votes.forEach(vote => {
      allVoters.add(vote.user.toString());
    });
  });
  this.uniqueVoters = allVoters.size;
  
  // Check expiration
  if (this.expiresAt && new Date() > this.expiresAt && this.status === 'active') {
    this.status = 'expired';
    this.closedAt = this.expiresAt;
  }
  
  next();
});

// ========== METHODS ==========

// Vote on an option
PollSchema.methods.vote = function(userId, optionIndex) {
  if (this.status !== 'active') {
    throw new Error('Poll is not active');
  }
  
  if (optionIndex < 0 || optionIndex >= this.options.length) {
    throw new Error('Invalid option index');
  }
  
  // Check if user already voted
  const existingVotes = [];
  this.options.forEach((option, idx) => {
    const voteIdx = option.votes.findIndex(v => v.user.toString() === userId.toString());
    if (voteIdx !== -1) {
      existingVotes.push({ optionIdx: idx, voteIdx });
    }
  });
  
  // If multiple votes not allowed, remove existing votes
  if (!this.settings.allowMultipleVotes && existingVotes.length > 0) {
    existingVotes.forEach(({ optionIdx, voteIdx }) => {
      this.options[optionIdx].votes.splice(voteIdx, 1);
    });
  } else if (this.settings.allowMultipleVotes) {
    // Check if max votes reached
    if (existingVotes.length >= this.settings.maxVotesPerUser) {
      throw new Error(`Maximum ${this.settings.maxVotesPerUser} votes allowed`);
    }
    
    // Check if already voted for this option
    const alreadyVotedThisOption = existingVotes.some(v => v.optionIdx === optionIndex);
    if (alreadyVotedThisOption) {
      throw new Error('Already voted for this option');
    }
  }
  
  // Add vote
  this.options[optionIndex].votes.push({
    user: userId,
    votedAt: new Date()
  });
  
  return this.save();
};

// Remove vote from an option
PollSchema.methods.unvote = function(userId, optionIndex) {
  if (this.status !== 'active') {
    throw new Error('Poll is not active');
  }
  
  if (optionIndex < 0 || optionIndex >= this.options.length) {
    throw new Error('Invalid option index');
  }
  
  const voteIdx = this.options[optionIndex].votes.findIndex(
    v => v.user.toString() === userId.toString()
  );
  
  if (voteIdx === -1) {
    throw new Error('Vote not found');
  }
  
  this.options[optionIndex].votes.splice(voteIdx, 1);
  return this.save();
};

// Close poll
PollSchema.methods.close = function(userId) {
  if (this.status !== 'active') {
    throw new Error('Poll is already closed');
  }
  
  this.status = 'closed';
  this.closedAt = new Date();
  this.closedBy = userId;
  
  return this.save();
};

// Reopen poll
PollSchema.methods.reopen = function(newExpiresAt = null) {
  if (this.status === 'active') {
    throw new Error('Poll is already active');
  }
  
  this.status = 'active';
  this.closedAt = null;
  this.closedBy = null;
  
  if (newExpiresAt) {
    this.expiresAt = newExpiresAt;
  }
  
  return this.save();
};

// Add option (if allowed)
PollSchema.methods.addOption = function(userId, text) {
  if (!this.settings.allowAddOptions) {
    throw new Error('Adding options is not allowed');
  }
  
  if (this.status !== 'active') {
    throw new Error('Poll is not active');
  }
  
  if (this.options.length >= 10) {
    throw new Error('Maximum 10 options allowed');
  }
  
  this.options.push({
    text,
    votes: [],
    voteCount: 0
  });
  
  return this.save();
};

// Get results (respecting anonymity settings)
PollSchema.methods.getResults = function(requestingUserId) {
  const results = {
    question: this.question,
    totalVotes: this.totalVotes,
    uniqueVoters: this.uniqueVoters,
    status: this.status,
    isQuiz: this.settings.isQuiz,
    options: this.options.map((option, idx) => {
      const result = {
        index: idx,
        text: option.text,
        voteCount: option.voteCount,
        percentage: this.totalVotes > 0 
          ? Math.round((option.voteCount / this.totalVotes) * 100) 
          : 0
      };
      
      // Include voters if not anonymous
      if (!this.settings.isAnonymous) {
        result.voters = option.votes.map(v => ({
          user: v.user,
          votedAt: v.votedAt
        }));
      }
      
      // Include correct answer indicator for quiz (after voting or if closed)
      if (this.settings.isQuiz && (this.status === 'closed' || this.hasVoted(requestingUserId))) {
        result.isCorrect = idx === this.settings.correctOptionIndex;
      }
      
      return result;
    })
  };
  
  // Add explanation for quiz after voting
  if (this.settings.isQuiz && this.settings.explanation && 
      (this.status === 'closed' || this.hasVoted(requestingUserId))) {
    results.explanation = this.settings.explanation;
  }
  
  return results;
};

// Check if user has voted
PollSchema.methods.hasVoted = function(userId) {
  return this.options.some(option => 
    option.votes.some(v => v.user.toString() === userId.toString())
  );
};

// Get user's votes
PollSchema.methods.getUserVotes = function(userId) {
  const votes = [];
  this.options.forEach((option, idx) => {
    if (option.votes.some(v => v.user.toString() === userId.toString())) {
      votes.push(idx);
    }
  });
  return votes;
};

// ========== STATICS ==========

// Get active polls for a conversation
PollSchema.statics.getActivePolls = async function(conversationId) {
  return await this.find({
    conversation: conversationId,
    status: 'active'
  })
  .populate('creator', 'name images')
  .sort({ createdAt: -1 });
};

// Create poll with message
PollSchema.statics.createWithMessage = async function(pollData, messageData) {
  const Message = mongoose.model('Message');
  
  // Create poll
  const poll = await this.create(pollData);
  
  // Create message with poll reference
  const message = await Message.create({
    ...messageData,
    messageType: 'poll',
    poll: poll._id
  });
  
  // Update poll with message reference
  poll.message = message._id;
  await poll.save();
  
  return { poll, message };
};

// Cleanup expired polls
PollSchema.statics.cleanupExpired = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: 'active',
      expiresAt: { $lte: now }
    },
    {
      $set: {
        status: 'expired',
        closedAt: now
      }
    }
  );
  
  return result.modifiedCount;
};

module.exports = mongoose.model('Poll', PollSchema);

