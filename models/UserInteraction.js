const mongoose = require('mongoose');

/**
 * UserInteraction Model
 * Tracks user interactions like skips, waves, likes in the community
 * Used to prevent showing same users repeatedly
 */
const UserInteractionSchema = new mongoose.Schema({
  // The user who performed the action
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The target user who received the action
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Type of interaction
  type: {
    type: String,
    enum: ['skip', 'wave', 'like', 'superlike', 'view'],
    required: true,
    index: true
  },

  // Optional message (for waves)
  message: {
    type: String,
    maxlength: 500
  },

  // Whether the interaction has been seen by target
  seen: {
    type: Boolean,
    default: false
  },

  // Expiry for temporary interactions (e.g., skips expire after 24h)
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
UserInteractionSchema.index({ user: 1, targetUser: 1, type: 1 }, { unique: true });
UserInteractionSchema.index({ user: 1, type: 1, createdAt: -1 });
UserInteractionSchema.index({ targetUser: 1, type: 1, seen: 1 });

// TTL index - automatically delete expired interactions
UserInteractionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to record an interaction
UserInteractionSchema.statics.recordInteraction = async function(userId, targetUserId, type, options = {}) {
  const { message, expiresIn } = options;

  // Calculate expiry if specified (in hours)
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null;

  // Upsert - update if exists, create if not
  return await this.findOneAndUpdate(
    { user: userId, targetUser: targetUserId, type },
    {
      user: userId,
      targetUser: targetUserId,
      type,
      message: message || undefined,
      expiresAt,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
};

// Static method to get all interactions of a type for a user
UserInteractionSchema.statics.getUserInteractions = async function(userId, type, options = {}) {
  const { limit = 1000, includeExpired = false } = options;

  const query = { user: userId, type };

  // Exclude expired interactions unless specified
  if (!includeExpired) {
    query.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];
  }

  return await this.find(query)
    .select('targetUser createdAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get target user IDs for exclusion
UserInteractionSchema.statics.getExcludedUserIds = async function(userId, types = ['skip', 'wave']) {
  const interactions = await this.find({
    user: userId,
    type: { $in: types },
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  })
  .select('targetUser')
  .lean();

  return interactions.map(i => i.targetUser);
};

// Static method to check if interaction exists
UserInteractionSchema.statics.hasInteraction = async function(userId, targetUserId, type) {
  const interaction = await this.findOne({
    user: userId,
    targetUser: targetUserId,
    type,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });

  return !!interaction;
};

// Static method to remove an interaction
UserInteractionSchema.statics.removeInteraction = async function(userId, targetUserId, type) {
  return await this.deleteOne({ user: userId, targetUser: targetUserId, type });
};

// Static method to get received interactions (waves, likes received)
UserInteractionSchema.statics.getReceivedInteractions = async function(targetUserId, type, options = {}) {
  const { limit = 50, unreadOnly = false } = options;

  const query = { targetUser: targetUserId, type };
  if (unreadOnly) {
    query.seen = false;
  }

  return await this.find(query)
    .populate('user', 'name images bio native_language language_to_learn')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to mark interactions as seen
UserInteractionSchema.statics.markAsSeen = async function(targetUserId, type, interactionIds = null) {
  const query = { targetUser: targetUserId, type, seen: false };

  if (interactionIds && interactionIds.length > 0) {
    query._id = { $in: interactionIds };
  }

  return await this.updateMany(query, { seen: true });
};

module.exports = mongoose.model('UserInteraction', UserInteractionSchema);
