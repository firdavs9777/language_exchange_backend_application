const mongoose = require('mongoose');
const slugify = require('slugify');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required'],
    index: true // Added for better query performance
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver is required'],
    index: true // Added for better query performance
  },
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [500, 'Message cannot exceed 500 characters'], // Increased from 50
    trim: true
  },
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
    index: true // Added for sorting
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // For media messages (future extension)
  media: {
    url: String,
    type: {
      type: String,
      enum: ['image', 'video', 'document', 'audio', null]
    }
  },
  // For message reactions (future extension)
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String
  }]
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug from the message ID before saving
MessageSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = slugify(this._id.toString(), {
      lower: true,
      strict: true
    });
  }
  next();
});

// Update the updatedAt field before saving
MessageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get conversation between two users
MessageSchema.statics.getConversation = async function(user1Id, user2Id, limit = 50) {
  return await this.find({
    $or: [
      { sender: user1Id, receiver: user2Id },
      { sender: user2Id, receiver: user1Id }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('sender', 'name avatar')
  .populate('receiver', 'name avatar')
  .lean();
};

// Static method to mark messages as read
MessageSchema.statics.markAsRead = async function(messageIds, userId) {
  return await this.updateMany(
    {
      _id: { $in: messageIds },
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
};

// Virtual for message status (useful for UI)
MessageSchema.virtual('status').get(function() {
  if (this.read) return 'read';
  if (this.receiver) return 'delivered';
  return 'sent';
});

module.exports = mongoose.model('Message', MessageSchema);