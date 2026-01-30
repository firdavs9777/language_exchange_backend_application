const mongoose = require('mongoose');

/**
 * Wave Model
 * Tracks "waves" between users (like a friendly hello/interest indicator)
 */
const WaveSchema = new mongoose.Schema({
  // User who sent the wave
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // User who received the wave
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Whether the recipient has seen the wave
  isRead: {
    type: Boolean,
    default: false
  },
  // When the wave was read
  readAt: {
    type: Date
  },
  // Optional message with the wave
  message: {
    type: String,
    maxlength: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
WaveSchema.index({ from: 1, to: 1 });
WaveSchema.index({ to: 1, isRead: 1, createdAt: -1 });

// Prevent duplicate waves within 24 hours
WaveSchema.index(
  { from: 1, to: 1, createdAt: 1 },
  {
    unique: true,
    partialFilterExpression: {
      createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
  }
);

/**
 * Check if there's a mutual wave (both users waved at each other)
 */
WaveSchema.statics.checkMutualWave = async function(userId1, userId2) {
  const [wave1, wave2] = await Promise.all([
    this.findOne({ from: userId1, to: userId2 }),
    this.findOne({ from: userId2, to: userId1 })
  ]);
  return !!(wave1 && wave2);
};

/**
 * Get unread wave count for a user
 */
WaveSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({ to: userId, isRead: false });
};

/**
 * Mark waves as read
 */
WaveSchema.statics.markAsRead = async function(userId, waveIds = null) {
  const filter = { to: userId, isRead: false };
  if (waveIds && waveIds.length > 0) {
    filter._id = { $in: waveIds };
  }
  return this.updateMany(filter, { isRead: true, readAt: new Date() });
};

module.exports = mongoose.model('Wave', WaveSchema);
