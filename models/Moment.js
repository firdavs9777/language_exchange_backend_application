const mongoose = require('mongoose');
const ISO6391 = require('iso-639-1');
const MomentSchema = new mongoose.Schema({
  // Kept as optional for backward compatibility with old app versions
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title can not be more than 100 characters'],
    default: ''
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required for the schema']
  },
  comments: {
    type: [mongoose.Schema.Types.Array],
    ref: 'Comment',
  },
  commentCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  likedUsers: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User'
  },
  // Emoji reactions
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  reactionCount: {
    type: Number,
    default: 0
  },
  // Saved/bookmarked moments
  savedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  saveCount: {
    type: Number,
    default: 0
  },
  // Share count
  shareCount: {
    type: Number,
    default: 0
  },
  // Report tracking
  reports: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'harassment', 'hate_speech', 'violence', 'misinformation', 'other'],
      required: true
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    }
  }],
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [2000, 'Description can not be more than 2000 characters'] // Increased from 1000
  },

  // NEW FIELDS - Phase 1
  mood: {
    type: String,
    enum: ['happy', 'excited', 'grateful', 'motivated', 'relaxed', 'curious',
           'sad', 'love', 'funny', 'thoughtful', 'cool', 'tired', ''],
    default: ''
  },
  tags: {
    type: [String],
    validate: [arrayLimit, 'Cannot have more than 5 tags'],
    default: []
  },
  category: {
    type: String,
    enum: ['general', 'language-learning', 'culture', 'food', 'travel', 'music', 'books', 'hobbies',
           'daily-life', 'technology', 'entertainment', 'sports', 'movies', 'study', 'work', 'question'],
    default: 'general'
  },
  language: {
    type: String,
    validate: {
      validator: function(v) {
        // Allow empty string or valid ISO639-1 codes
        return v === '' || ISO6391.validate(v);
      },
      message: 'Invalid language code. Must be a valid ISO639-1 code.'
    },
    default: 'en'
  },
  privacy: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  backgroundColor: {
    type: String,
    enum: ['', 'gradient_sunset', 'gradient_ocean', 'gradient_forest',
           'gradient_purple', 'gradient_fire', 'gradient_midnight',
           'gradient_candy', 'gradient_sky'],
    default: ''
  },

  // EXISTING FIELDS
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    },
    formattedAddress: String,
    street: String,
    city: String,
    state: String,
    zipcode: String,
    country: String
  },
  images: {
    type: [String]
  },

  // Video field for video moments (Instagram-style)
  video: {
    url: {
      type: String,
      default: null
    },
    thumbnail: {
      type: String,
      default: null
    },
    duration: {
      type: Number, // Duration in seconds
      default: null,
      max: [600, 'Video duration cannot exceed 10 minutes (600 seconds)']
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

  // Audio field for voice-note moments
  audio: {
    url: {
      type: String,
      default: null
    },
    duration: {
      type: Number, // Duration in seconds
      default: null,
      max: [60, 'Audio duration cannot exceed 60 seconds']
    },
    waveform: {
      type: [Number],
      default: undefined
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

  // Media type to distinguish between image, video, audio and text moments
  mediaType: {
    type: String,
    enum: ['image', 'video', 'audio', 'text'],
    default: 'text'
  },

  // NEW FIELD - Phase 1
  scheduledFor: {
    type: Date,
    default: null
  },

  // Optional link to the daily prompt this moment was written in response to.
  // No index needed at this scale.
  promptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prompt',
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Workstream G — Reels. Reels ride on Moment (no new collection):
  // isReel:true moments are surfaced only via GET /moments/reels and are
  // excluded from the regular discovery card feeds.
  isReel: {
    type: Boolean,
    default: false
  },
  // Set true once a reel crosses the report auto-hide threshold (>=2
  // distinct reporters). Cleared by the admin "restore" action.
  hiddenPendingReview: {
    type: Boolean,
    default: false
  }
});

// Database Indexes for Performance
MomentSchema.index({ user: 1, createdAt: -1 }); // For user moments queries
MomentSchema.index({ privacy: 1, createdAt: -1 }); // For public feed queries
MomentSchema.index({ category: 1, createdAt: -1 }); // For category filtering
MomentSchema.index({ language: 1, createdAt: -1 }); // For language filtering
MomentSchema.index({ 'location.coordinates': '2dsphere' }); // For geospatial queries

// Reels feed prefilter + recency sort. Residual filters (blocked-user
// $nin, hiddenPendingReview) and the language partition are non-indexed —
// acceptable in-memory work at this dataset size (revisit past ~10k reels).
MomentSchema.index({ isReel: 1, privacy: 1, createdAt: -1 });

// Additional indexes for video/media filtering and interactions
MomentSchema.index({ mediaType: 1, privacy: 1, createdAt: -1 }); // For video-specific feed queries
MomentSchema.index({ likedUsers: 1 }); // For checking if user liked moment
MomentSchema.index({ savedBy: 1 }); // For checking if user saved moment
MomentSchema.index({ privacy: 1, user: 1, createdAt: -1 }); // For feed with $or query optimization
MomentSchema.index({ likeCount: -1, createdAt: -1 }); // For trending moments

// Validation function for tags array
function arrayLimit(val) {
  return val.length <= 5;
}

module.exports = mongoose.model('Moment', MomentSchema);
