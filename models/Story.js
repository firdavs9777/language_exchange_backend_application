const { default: mongoose } = require("mongoose");

const StorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true
  },
  mediaUrl: String,
  mediaUrls: [String], // Multiple uploads per story (to Spaces)
  mediaType: {
    type: String,
    enum: ['image', 'video', 'text'],
    required: false
  },

  // Video metadata (YouTube-style video stories)
  videoMetadata: {
    duration: {
      type: Number, // Duration in seconds
      default: null,
      max: [600, 'Video duration cannot exceed 10 minutes (600 seconds)']
    },
    thumbnail: {
      type: String, // Thumbnail URL
      default: null
    },
    width: {
      type: Number,
      default: null
    },
    height: {
      type: Number,
      default: null
    },
    mimeType: {
      type: String,
      default: null
    },
    fileSize: {
      type: Number, // Size in bytes
      default: null
    }
  },
  text: { type: String, maxLength: 5000 },
  backgroundColor: { type: String, default: '#000000' },
  textColor: { type: String, default: '#ffffff' },
  fontStyle: { 
    type: String, 
    enum: ['normal', 'bold', 'italic', 'handwriting'],
    default: 'normal'
  },
  
  // Privacy settings
  privacy: { 
    type: String, 
    enum: ['public', 'friends', 'close_friends'], 
    default: 'friends' 
  },
  
  // View tracking
  views: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now },
    viewDuration: Number // Seconds spent viewing
  }],
  viewCount: { type: Number, default: 0 },
  
  // ========== NEW FEATURES ==========
  
  // Story Reactions (Instagram/Snapchat style)
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String, required: true }, // ❤️ 😂 😮 😢 😡 🔥 👏 etc.
    reactedAt: { type: Date, default: Date.now }
  }],
  reactionCount: { type: Number, default: 0 },
  
  // Story Replies (sends to DM)
  replies: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }, // Reference to DM
    repliedAt: { type: Date, default: Date.now }
  }],
  replyCount: { type: Number, default: 0 },
  
  // Mentions (@username)
  mentions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    position: { // Position on story for display
      x: Number, // 0-100 percentage
      y: Number  // 0-100 percentage
    }
  }],
  
  // Location tag
  location: {
    name: String,
    address: String,
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number] // [longitude, latitude]
    },
    placeId: String // Google/Apple Maps place ID
  },
  
  // Link sticker (swipe up / tap to visit)
  link: {
    url: String,
    title: String,
    displayText: String // "Learn More", "Shop Now", etc.
  },
  
  // Poll/Question sticker
  poll: {
    question: String,
    options: [{
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      voteCount: { type: Number, default: 0 }
    }],
    isAnonymous: { type: Boolean, default: false },
    expiresAt: Date
  },
  
  // Question box (ask me anything)
  questionBox: {
    prompt: String, // "Ask me anything!"
    responses: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      respondedAt: { type: Date, default: Date.now },
      isAnonymous: { type: Boolean, default: false }
    }]
  },
  
  // Music/Audio
  music: {
    trackId: String,
    title: String,
    artist: String,
    coverUrl: String,
    previewUrl: String,
    startTime: Number, // Start position in seconds
    duration: Number   // Duration to play
  },
  
  // Hashtags
  hashtags: [String],
  
  // Story highlight reference (if added to highlight)
  highlight: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoryHighlight'
  },
  
  // Archive flag (for viewing old stories)
  isArchived: { type: Boolean, default: false },
  archivedAt: Date,
  
  // Share tracking
  shares: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sharedTo: { type: String, enum: ['dm', 'story', 'external'] },
    sharedAt: { type: Date, default: Date.now }
  }],
  shareCount: { type: Number, default: 0 },
  
  // Allow sharing/replies
  allowReplies: { type: Boolean, default: true },
  allowSharing: { type: Boolean, default: true },
  
  // Status
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
  
}, { timestamps: true });

// Indexes
StorySchema.index({ user: 1, createdAt: -1 });
StorySchema.index({ expiresAt: 1 });
StorySchema.index({ isActive: 1, expiresAt: 1 });
StorySchema.index({ 'location.coordinates': '2dsphere' });
StorySchema.index({ hashtags: 1 });

// Virtual for checking if expired
StorySchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

// Method to add reaction
StorySchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from same user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({ user: userId, emoji, reactedAt: new Date() });
  this.reactionCount = this.reactions.length;
  
  return this.save();
};

// Method to remove reaction
StorySchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  this.reactionCount = this.reactions.length;
  return this.save();
};

// Method to vote on poll
StorySchema.methods.votePoll = function(userId, optionIndex) {
  if (!this.poll || !this.poll.options[optionIndex]) {
    throw new Error('Invalid poll option');
  }
  
  // Remove existing vote
  this.poll.options.forEach(option => {
    option.votes = option.votes.filter(v => v.toString() !== userId.toString());
    option.voteCount = option.votes.length;
  });
  
  // Add new vote
  this.poll.options[optionIndex].votes.push(userId);
  this.poll.options[optionIndex].voteCount = this.poll.options[optionIndex].votes.length;
  
  return this.save();
};

// Method to answer question box
StorySchema.methods.answerQuestion = function(userId, text, isAnonymous = false) {
  if (!this.questionBox) {
    throw new Error('Story has no question box');
  }
  
  this.questionBox.responses.push({
    user: userId,
    text,
    respondedAt: new Date(),
    isAnonymous
  });
  
  return this.save();
};

// Method to archive story
StorySchema.methods.archive = function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Static to get archived stories
StorySchema.statics.getArchivedStories = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  return await this.find({
    user: userId,
    isArchived: true
  })
  .sort({ archivedAt: -1 })
  .skip(skip)
  .limit(limit)
  .lean();
};

// Static to cleanup expired stories (run via cron)
StorySchema.statics.archiveExpired = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      isActive: true,
      expiresAt: { $lte: now },
      isArchived: false
    },
    {
      $set: {
        isActive: false,
        isArchived: true,
        archivedAt: now
      }
    }
  );
  
  return result.modifiedCount;
};

module.exports = mongoose.model('Story', StorySchema);