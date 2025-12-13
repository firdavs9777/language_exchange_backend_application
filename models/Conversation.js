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
  
  // ========== ADVANCED FEATURES (KakaoTalk/HelloTalk Style) ==========
  
  // Chat Theme/Background (KakaoTalk style)
  theme: {
    // Theme preset name
    preset: {
      type: String,
      enum: ['default', 'dark', 'light', 'blue', 'pink', 'green', 'custom'],
      default: 'default'
    },
    // Custom background image URL
    backgroundUrl: String,
    // Background color (for solid colors)
    backgroundColor: String,
    // Chat bubble colors
    senderBubbleColor: String,
    receiverBubbleColor: String,
    // Font settings
    fontSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium'
    }
  },
  
  // Per-user theme settings (each user can have their own theme)
  userThemes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    theme: {
      preset: String,
      backgroundUrl: String,
      backgroundColor: String,
      senderBubbleColor: String,
      receiverBubbleColor: String,
      fontSize: String
    }
  }],
  
  // Secret Chat (KakaoTalk style - end-to-end encrypted)
  isSecret: {
    type: Boolean,
    default: false
  },
  secretChatSettings: {
    // Auto-destruct timer for all messages (seconds)
    defaultDestructTimer: {
      type: Number,
      default: 0 // 0 means no auto-destruct
    },
    // Prevent screenshots (frontend enforcement)
    preventScreenshots: {
      type: Boolean,
      default: true
    },
    // Lock with device password/biometrics (frontend enforcement)
    requireAuthentication: {
      type: Boolean,
      default: false
    },
    // Encryption key identifier (for E2E)
    encryptionKeyId: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Nicknames (KakaoTalk style - custom names for each user in chat)
  nicknames: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    nickname: String,
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    setAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Quick Replies (saved templates for this conversation)
  quickReplies: [{
    text: {
      type: String,
      maxlength: 200
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    useCount: {
      type: Number,
      default: 0
    }
  }],
  
  // Chat Labels/Tags (for organizing)
  labels: [{
    name: String,
    color: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Language settings (for HelloTalk-style features)
  languageSettings: {
    // Primary language of conversation
    primaryLanguage: String,
    // Enable auto-correction suggestions
    enableCorrections: {
      type: Boolean,
      default: true
    },
    // Auto-translate incoming messages
    autoTranslate: {
      type: Boolean,
      default: false
    },
    // Target language for translation
    translateTo: String
  },
  
  // Conversation settings
  settings: {
    // Notifications
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    // Show message previews in notifications
    showPreviews: {
      type: Boolean,
      default: true
    },
    // Allow voice messages
    allowVoiceMessages: {
      type: Boolean,
      default: true
    },
    // Allow media
    allowMedia: {
      type: Boolean,
      default: true
    }
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

// ========== ADVANCED FEATURE METHODS ==========

// Set theme for a user
ConversationSchema.methods.setUserTheme = function(userId, theme) {
  const existingTheme = this.userThemes.find(t => t.user.toString() === userId.toString());
  
  if (existingTheme) {
    existingTheme.theme = { ...existingTheme.theme, ...theme };
  } else {
    this.userThemes.push({
      user: userId,
      theme
    });
  }
  
  return this.save();
};

// Get theme for a user (falls back to conversation theme, then default)
ConversationSchema.methods.getUserTheme = function(userId) {
  const userTheme = this.userThemes.find(t => t.user.toString() === userId.toString());
  
  if (userTheme) {
    return userTheme.theme;
  }
  
  return this.theme || { preset: 'default', fontSize: 'medium' };
};

// Set nickname for a user
ConversationSchema.methods.setNickname = function(targetUserId, nickname, setByUserId) {
  const existingNickname = this.nicknames.find(n => n.user.toString() === targetUserId.toString());
  
  if (existingNickname) {
    existingNickname.nickname = nickname;
    existingNickname.setBy = setByUserId;
    existingNickname.setAt = new Date();
  } else {
    this.nicknames.push({
      user: targetUserId,
      nickname,
      setBy: setByUserId,
      setAt: new Date()
    });
  }
  
  return this.save();
};

// Get nickname for a user
ConversationSchema.methods.getNickname = function(userId) {
  const nickname = this.nicknames.find(n => n.user.toString() === userId.toString());
  return nickname ? nickname.nickname : null;
};

// Remove nickname
ConversationSchema.methods.removeNickname = function(userId) {
  this.nicknames = this.nicknames.filter(n => n.user.toString() !== userId.toString());
  return this.save();
};

// Add quick reply
ConversationSchema.methods.addQuickReply = function(text, userId) {
  // Limit to 20 quick replies
  if (this.quickReplies.length >= 20) {
    // Remove the oldest unused one
    this.quickReplies.sort((a, b) => a.useCount - b.useCount);
    this.quickReplies.shift();
  }
  
  this.quickReplies.push({
    text,
    createdBy: userId,
    createdAt: new Date(),
    useCount: 0
  });
  
  return this.save();
};

// Use quick reply (increment counter)
ConversationSchema.methods.useQuickReply = function(quickReplyId) {
  const quickReply = this.quickReplies.id(quickReplyId);
  if (quickReply) {
    quickReply.useCount += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Remove quick reply
ConversationSchema.methods.removeQuickReply = function(quickReplyId) {
  this.quickReplies = this.quickReplies.filter(qr => qr._id.toString() !== quickReplyId.toString());
  return this.save();
};

// Enable secret chat mode
ConversationSchema.methods.enableSecretChat = function(settings = {}) {
  this.isSecret = true;
  this.secretChatSettings = {
    defaultDestructTimer: settings.destructTimer || 0,
    preventScreenshots: settings.preventScreenshots !== false,
    requireAuthentication: settings.requireAuthentication || false,
    encryptionKeyId: settings.encryptionKeyId || null,
    createdAt: new Date()
  };
  
  return this.save();
};

// Disable secret chat mode
ConversationSchema.methods.disableSecretChat = function() {
  this.isSecret = false;
  this.secretChatSettings = undefined;
  return this.save();
};

// Add label
ConversationSchema.methods.addLabel = function(name, color, userId) {
  const existingLabel = this.labels.find(l => l.name === name);
  
  if (!existingLabel) {
    this.labels.push({
      name,
      color,
      addedBy: userId
    });
  }
  
  return this.save();
};

// Remove label
ConversationSchema.methods.removeLabel = function(labelName) {
  this.labels = this.labels.filter(l => l.name !== labelName);
  return this.save();
};

// Update language settings
ConversationSchema.methods.updateLanguageSettings = function(settings) {
  this.languageSettings = {
    ...this.languageSettings,
    ...settings
  };
  return this.save();
};

// Static method to get secret chats for a user
ConversationSchema.statics.getSecretChats = async function(userId) {
  return await this.find({
    participants: userId,
    isSecret: true
  })
  .populate('participants', 'name images')
  .populate('lastMessage')
  .sort({ lastMessageAt: -1 });
};

// Index for secret chats
ConversationSchema.index({ isSecret: 1, participants: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);

