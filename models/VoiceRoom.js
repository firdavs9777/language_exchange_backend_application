const mongoose = require('mongoose');

/**
 * Voice Room Model
 * Represents a group voice chat room for language practice
 */
const VoiceRoomSchema = new mongoose.Schema({
  // Room title
  title: {
    type: String,
    required: [true, 'Room title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  // Room description
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Topic/category
  topic: {
    type: String,
    enum: ['language_exchange', 'casual_chat', 'study_group', 'pronunciation', 'debate', 'storytelling', 'other'],
    default: 'language_exchange'
  },
  // Primary language for the room
  language: {
    type: String,
    required: true
  },
  // Secondary language (for exchange rooms)
  secondaryLanguage: {
    type: String
  },
  // Room creator/host
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Co-hosts (can manage room)
  coHosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Current participants
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isMuted: {
      type: Boolean,
      default: true
    },
    isSpeaking: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ['host', 'cohost', 'speaker', 'listener'],
      default: 'listener'
    }
  }],
  // Maximum participants allowed
  maxParticipants: {
    type: Number,
    default: 8,
    min: 2,
    max: 50
  },
  // Room status
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting',
    index: true
  },
  // Room visibility
  isPublic: {
    type: Boolean,
    default: true
  },
  // Scheduled start time (for scheduled rooms)
  scheduledAt: {
    type: Date
  },
  // When the room actually started
  startedAt: {
    type: Date
  },
  // When the room ended
  endedAt: {
    type: Date
  },
  // Room settings
  settings: {
    allowRaiseHand: {
      type: Boolean,
      default: true
    },
    allowChat: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    },
    recordingEnabled: {
      type: Boolean,
      default: false
    }
  },
  // Tags for discovery
  tags: [{
    type: String,
    maxlength: 30
  }],
  // Room statistics
  stats: {
    totalParticipants: {
      type: Number,
      default: 0
    },
    peakParticipants: {
      type: Number,
      default: 0
    },
    totalDuration: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
VoiceRoomSchema.index({ status: 1, isPublic: 1, createdAt: -1 });
VoiceRoomSchema.index({ language: 1, status: 1 });
VoiceRoomSchema.index({ topic: 1, status: 1 });
VoiceRoomSchema.index({ host: 1, status: 1 });
VoiceRoomSchema.index({ 'participants.user': 1 });

// Virtual for current participant count
VoiceRoomSchema.virtual('participantCount').get(function() {
  return this.participants?.length || 0;
});

// Virtual for is room full
VoiceRoomSchema.virtual('isFull').get(function() {
  return this.participants?.length >= this.maxParticipants;
});

// Enable virtuals in JSON
VoiceRoomSchema.set('toJSON', { virtuals: true });
VoiceRoomSchema.set('toObject', { virtuals: true });

/**
 * Check if user is in room
 */
VoiceRoomSchema.methods.hasParticipant = function(userId) {
  return this.participants.some(p => p.user?.toString() === userId.toString());
};

/**
 * Check if user is host or co-host
 */
VoiceRoomSchema.methods.isHostOrCoHost = function(userId) {
  const userIdStr = userId.toString();
  return this.host.toString() === userIdStr ||
         this.coHosts.some(ch => ch.toString() === userIdStr);
};

/**
 * Add participant to room
 */
VoiceRoomSchema.methods.addParticipant = async function(userId, role = 'listener') {
  if (this.hasParticipant(userId)) {
    throw new Error('User already in room');
  }
  if (this.participants.length >= this.maxParticipants) {
    throw new Error('Room is full');
  }

  this.participants.push({
    user: userId,
    joinedAt: new Date(),
    isMuted: true,
    isSpeaking: false,
    role
  });

  this.stats.totalParticipants += 1;
  if (this.participants.length > this.stats.peakParticipants) {
    this.stats.peakParticipants = this.participants.length;
  }

  return this.save();
};

/**
 * Remove participant from room
 */
VoiceRoomSchema.methods.removeParticipant = async function(userId) {
  const index = this.participants.findIndex(p => p.user?.toString() === userId.toString());
  if (index === -1) {
    throw new Error('User not in room');
  }

  this.participants.splice(index, 1);

  // If host leaves, end the room or transfer to co-host
  if (this.host.toString() === userId.toString()) {
    if (this.coHosts.length > 0) {
      this.host = this.coHosts[0];
      this.coHosts.shift();
    } else if (this.participants.length > 0) {
      this.host = this.participants[0].user;
      this.participants[0].role = 'host';
    } else {
      this.status = 'ended';
      this.endedAt = new Date();
    }
  }

  return this.save();
};

/**
 * Start the room
 */
VoiceRoomSchema.methods.start = async function() {
  this.status = 'active';
  this.startedAt = new Date();
  return this.save();
};

/**
 * End the room
 */
VoiceRoomSchema.methods.end = async function() {
  this.status = 'ended';
  this.endedAt = new Date();
  if (this.startedAt) {
    this.stats.totalDuration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  return this.save();
};

/**
 * Get active public rooms
 */
VoiceRoomSchema.statics.getActiveRooms = async function(options = {}) {
  const { language, topic, limit = 20, skip = 0 } = options;

  const filter = {
    status: { $in: ['waiting', 'active'] },
    isPublic: true
  };

  if (language) filter.language = language;
  if (topic) filter.topic = topic;

  return this.find(filter)
    .populate('host', 'name images')
    .populate('participants.user', 'name images')
    .sort({ 'participants.length': -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('VoiceRoom', VoiceRoomSchema);
