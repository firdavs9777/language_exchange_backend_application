const mongoose = require('mongoose');
const slugify = require('slugify');
const MomentSchema = new mongoose.Schema({
  title: {
    type: String,
    unique: false,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title can not be more than 100 characters'] // Increased from 50
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
  slug: String,
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [2000, 'Description can not be more than 2000 characters'] // Increased from 1000
  },

  // NEW FIELDS - Phase 1
  mood: {
    type: String,
    enum: ['happy', 'excited', 'grateful', 'motivated', 'relaxed', 'curious', ''],
    default: ''
  },
  tags: {
    type: [String],
    validate: [arrayLimit, 'Cannot have more than 5 tags'],
    default: []
  },
  category: {
    type: String,
    enum: ['general', 'language-learning', 'culture', 'food', 'travel', 'music', 'books', 'hobbies'],
    default: 'general'
  },
  language: {
    type: String,
    enum: ['english', 'spanish', 'french', 'german', 'korean', 'japanese', 'chinese'],
    default: 'english'
  },
  privacy: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
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

  // NEW FIELD - Phase 1
  scheduledFor: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now()
  }
});

// Validation function for tags array
function arrayLimit(val) {
  return val.length <= 5;
}

module.exports = mongoose.model('Moment', MomentSchema);
