const mongoose = require('mongoose');
const slugify = require('slugify');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required'],
    index: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver is required'],
    index: true
  },
  // New participants field for group chats
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  message: {
    type: String,
    required: function() {
      return !this.media || !this.media.type;
    },
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    trim: true
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  media: {
    url: String,
    type: {
      type: String,
      enum: ['image', 'video', 'document', 'audio', 'voice', 'location', null]
    },
    thumbnail: String,
    fileName: String,
    fileSize: Number,
    mimeType: String,
    duration: Number, // For audio/video/voice in seconds
    dimensions: {
      width: Number,
      height: Number
    },
    // Voice message waveform data (array of amplitude values 0-1)
    waveform: [{
      type: Number,
      min: 0,
      max: 1
    }],
    // For location type
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
      placeName: String
    }
  },
  
  // ========== ADVANCED FEATURES ==========
  
  // Mentions (@username) - HelloTalk/KakaoTalk style
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    startIndex: Number, // Position in message text
    endIndex: Number
  }],
  
  // Message Corrections (HelloTalk language learning feature)
  corrections: [{
    corrector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    originalText: String,
    correctedText: String,
    explanation: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    isAccepted: {
      type: Boolean,
      default: false
    }
  }],
  
  // Disappearing/Self-destruct messages (KakaoTalk Secret Chat style)
  selfDestruct: {
    enabled: {
      type: Boolean,
      default: false
    },
    // Time-based destruction
    expiresAt: Date,
    // Destroy after read
    destructAfterRead: {
      type: Boolean,
      default: false
    },
    // Seconds to live after being read
    destructTimer: {
      type: Number,
      default: 0
    },
    // Track when destruction should happen after read
    destructAt: Date
  },
  
  // Translation support
  translations: [{
    language: String, // ISO language code (e.g., 'ko', 'en', 'ja')
    translatedText: String,
    translatedAt: {
      type: Date,
      default: Date.now
    },
    provider: {
      type: String,
      enum: ['google', 'deepl', 'papago', null],
      default: null
    }
  }],
  
  // Poll reference (for poll messages)
  poll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll'
  },
  
  // Scheduled message reference
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledFor: Date,
  
  // Message type for special messages
  messageType: {
    type: String,
    enum: ['text', 'media', 'voice', 'poll', 'location', 'contact', 'sticker', 'system'],
    default: 'text'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String
  }],
  // New field to distinguish between direct and group messages
  isGroupMessage: {
    type: Boolean,
    default: false
  },
  // Message management fields
  editedAt: {
    type: Date
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Reply functionality
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Forward functionality
  forwardedFrom: {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    originalMessage: String
  },
  isForwarded: {
    type: Boolean,
    default: false
  },
  // Pin functionality
  pinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: {
    type: Date
  },
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-populate participants before saving
MessageSchema.pre('save', function(next) {
  // For direct messages, participants are sender and receiver
  if (!this.isGroupMessage && this.participants.length === 0) {
    this.participants = [this.sender, this.receiver];
  }
  
  // Ensure participants are unique
  this.participants = [...new Set(this.participants.map(p => p.toString()))]
    .map(id => new mongoose.Types.ObjectId(id));

  if (!this.slug) {
    this.slug = slugify(this._id.toString(), {
      lower: true,
      strict: true
    });
  }
  next();
});

MessageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Enhanced getConversation to handle both direct and group chats
MessageSchema.statics.getConversation = async function(user1Id, user2Id = null, limit = 50) {
  const query = user2Id 
    ? {
        $or: [
          { sender: user1Id, receiver: user2Id },
          { sender: user2Id, receiver: user1Id }
        ],
        isGroupMessage: false
      }
    : {
        participants: user1Id,
        isGroupMessage: true
      };

  return await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name avatar')
    .populate('receiver', 'name avatar')
    .populate('participants', 'name avatar')
    .lean();
};

// Enhanced markAsRead to handle group messages
MessageSchema.statics.markAsRead = async function(messageIds, userId) {
  // For direct messages
  const directUpdate = this.updateMany(
    {
      _id: { $in: messageIds },
      isGroupMessage: false,
      receiver: userId,
      read: false
    },
    {
      $set: {
        read: true,
        readAt: Date.now()
      }
    }
  );

  // For group messages
  const groupUpdate = this.updateMany(
    {
      _id: { $in: messageIds },
      isGroupMessage: true,
      'readBy.user': { $ne: userId }
    },
    {
      $push: {
        readBy: {
          user: userId,
          readAt: Date.now()
        }
      }
    }
  );

  await Promise.all([directUpdate, groupUpdate]);
  
  // Update the global read status if all participants have read
  await this.updateMany(
    {
      _id: { $in: messageIds },
      isGroupMessage: true,
      $expr: {
        $eq: [
          { $size: "$participants" },
          { $size: "$readBy" }
        ]
      }
    },
    {
      $set: {
        read: true,
        readAt: Date.now()
      }
    }
  );
};

// Enhanced status virtual property
MessageSchema.virtual('status').get(function() {
  if (this.read) return 'read';
  if (this.isGroupMessage) {
    return this.readBy.length === this.participants.length ? 'read' : 'delivered';
  }
  return this.receiver ? 'delivered' : 'sent';
});

// New method to add participants to group messages
MessageSchema.methods.addParticipants = function(userIds) {
  userIds.forEach(userId => {
    if (!this.participants.includes(userId)) {
      this.participants.push(userId);
    }
  });
};

// New method to remove participants from group messages
MessageSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(
    participant => !participant.equals(userId)
  );
};

// Text index for search (will be created on first use)
// Note: MongoDB text indexes are created separately via ensureIndex or createIndex
// This is just documentation - actual index creation happens in migration or startup

// ========== ADVANCED FEATURE METHODS ==========

// Add a correction to a message (HelloTalk style)
MessageSchema.methods.addCorrection = function(correctorId, originalText, correctedText, explanation) {
  this.corrections.push({
    corrector: correctorId,
    originalText,
    correctedText,
    explanation,
    createdAt: new Date(),
    isAccepted: false
  });
  return this.save();
};

// Accept a correction
MessageSchema.methods.acceptCorrection = function(correctionId) {
  const correction = this.corrections.id(correctionId);
  if (correction) {
    correction.isAccepted = true;
    return this.save();
  }
  return Promise.resolve(this);
};

// Add translation
MessageSchema.methods.addTranslation = function(language, translatedText, provider = null) {
  // Remove existing translation for this language
  this.translations = this.translations.filter(t => t.language !== language);
  
  this.translations.push({
    language,
    translatedText,
    translatedAt: new Date(),
    provider
  });
  return this.save();
};

// Get translation for a specific language
MessageSchema.methods.getTranslation = function(language) {
  return this.translations.find(t => t.language === language);
};

// Set self-destruct timer after message is read
MessageSchema.methods.triggerSelfDestruct = function() {
  if (this.selfDestruct.enabled && this.selfDestruct.destructAfterRead && this.selfDestruct.destructTimer > 0) {
    this.selfDestruct.destructAt = new Date(Date.now() + this.selfDestruct.destructTimer * 1000);
    return this.save();
  }
  return Promise.resolve(this);
};

// Check if message should be destroyed
MessageSchema.methods.shouldBeDestroyed = function() {
  if (!this.selfDestruct.enabled) return false;
  
  const now = new Date();
  
  // Check time-based expiration
  if (this.selfDestruct.expiresAt && now > this.selfDestruct.expiresAt) {
    return true;
  }
  
  // Check read-based destruction
  if (this.selfDestruct.destructAt && now > this.selfDestruct.destructAt) {
    return true;
  }
  
  return false;
};

// Parse mentions from message text
MessageSchema.methods.parseMentions = async function() {
  const User = mongoose.model('User');
  const mentionRegex = /@(\w+)/g;
  const matches = [...this.message.matchAll(mentionRegex)];
  
  this.mentions = [];
  
  for (const match of matches) {
    const username = match[1];
    const user = await User.findOne({ name: new RegExp(`^${username}$`, 'i') });
    
    if (user) {
      this.mentions.push({
        user: user._id,
        username: user.name,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }
  
  return this.save();
};

// Static method to clean up expired self-destruct messages
MessageSchema.statics.cleanupExpiredMessages = async function() {
  const now = new Date();
  
  const result = await this.deleteMany({
    'selfDestruct.enabled': true,
    $or: [
      { 'selfDestruct.expiresAt': { $lte: now } },
      { 'selfDestruct.destructAt': { $lte: now } }
    ]
  });
  
  return result.deletedCount;
};

// Static method to get messages with pending corrections for a user
MessageSchema.statics.getMessagesWithCorrections = async function(userId, limit = 20) {
  return await this.find({
    sender: userId,
    'corrections.0': { $exists: true }
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('corrections.corrector', 'name images')
  .lean();
};

// Index for self-destruct message cleanup
MessageSchema.index({ 'selfDestruct.expiresAt': 1 }, { sparse: true });
MessageSchema.index({ 'selfDestruct.destructAt': 1 }, { sparse: true });

// Index for mentions
MessageSchema.index({ 'mentions.user': 1 }, { sparse: true });

module.exports = mongoose.model('Message', MessageSchema);