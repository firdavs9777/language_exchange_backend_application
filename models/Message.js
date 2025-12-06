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
      enum: ['image', 'video', 'document', 'audio', 'location', null]
    },
    thumbnail: String,
    fileName: String,
    fileSize: Number,
    mimeType: String,
    duration: Number, // For audio/video in seconds
    dimensions: {
      width: Number,
      height: Number
    },
    // For location type
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
      placeName: String
    }
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
    .map(id => mongoose.Types.ObjectId(id));

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

module.exports = mongoose.model('Message', MessageSchema);