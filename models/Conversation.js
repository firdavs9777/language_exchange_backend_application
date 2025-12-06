const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  unreadCount: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    count: {
      type: Number,
      default: 0
    }
  }],
  mutedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    mutedUntil: {
      type: Date,
      default: null
    },
    mutedAt: {
      type: Date,
      default: Date.now
    }
  }],
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pinnedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pinnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isGroup: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String
  },
  groupAvatar: {
    type: String
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
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });
ConversationSchema.index({ 'mutedBy.user': 1 });
ConversationSchema.index({ 'archivedBy': 1 });
ConversationSchema.index({ 'pinnedBy.user': 1 });

// Pre-save hook
ConversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to get or create conversation
ConversationSchema.statics.getOrCreateConversation = async function(user1Id, user2Id) {
  // For direct messages, find existing conversation
  if (!this.isGroup) {
    const existing = await this.findOne({
      participants: { $all: [user1Id, user2Id], $size: 2 },
      isGroup: false
    });
    
    if (existing) {
      return existing;
    }
  }
  
  // Create new conversation
  return await this.create({
    participants: [user1Id, user2Id],
    isGroup: false
  });
};

// Method to mute conversation
ConversationSchema.methods.mute = function(userId, duration = null) {
  const mutedUntil = duration ? new Date(Date.now() + duration) : null;
  
  const existingMute = this.mutedBy.find(m => m.user.toString() === userId.toString());
  
  if (existingMute) {
    existingMute.mutedUntil = mutedUntil;
    existingMute.mutedAt = new Date();
  } else {
    this.mutedBy.push({
      user: userId,
      mutedUntil: mutedUntil,
      mutedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to unmute conversation
ConversationSchema.methods.unmute = function(userId) {
  this.mutedBy = this.mutedBy.filter(m => m.user.toString() !== userId.toString());
  return this.save();
};

// Method to check if conversation is muted
ConversationSchema.methods.isMuted = function(userId) {
  const mute = this.mutedBy.find(m => m.user.toString() === userId.toString());
  if (!mute) return false;
  
  if (mute.mutedUntil && mute.mutedUntil < new Date()) {
    // Mute expired, remove it
    this.unmute(userId);
    return false;
  }
  
  return true;
};

// Method to archive conversation
ConversationSchema.methods.archive = function(userId) {
  if (!this.archivedBy.includes(userId)) {
    this.archivedBy.push(userId);
  }
  return this.save();
};

// Method to unarchive conversation
ConversationSchema.methods.unarchive = function(userId) {
  this.archivedBy = this.archivedBy.filter(id => id.toString() !== userId.toString());
  return this.save();
};

// Method to pin conversation
ConversationSchema.methods.pin = function(userId) {
  const existingPin = this.pinnedBy.find(p => p.user.toString() === userId.toString());
  
  if (!existingPin) {
    this.pinnedBy.push({
      user: userId,
      pinnedAt: new Date()
    });
  }
  
  return this.save();
};

// Method to unpin conversation
ConversationSchema.methods.unpin = function(userId) {
  this.pinnedBy = this.pinnedBy.filter(p => p.user.toString() !== userId.toString());
  return this.save();
};

// Method to update unread count
ConversationSchema.methods.updateUnreadCount = function(userId, increment = 1) {
  const unread = this.unreadCount.find(u => u.user.toString() === userId.toString());
  
  if (unread) {
    unread.count = Math.max(0, unread.count + increment);
  } else {
    this.unreadCount.push({
      user: userId,
      count: Math.max(0, increment)
    });
  }
  
  return this.save();
};

// Method to mark as read
ConversationSchema.methods.markAsRead = function(userId) {
  const unread = this.unreadCount.find(u => u.user.toString() === userId.toString());
  
  if (unread) {
    unread.count = 0;
  } else {
    this.unreadCount.push({
      user: userId,
      count: 0
    });
  }
  
  return this.save();
};

module.exports = mongoose.model('Conversation', ConversationSchema);

