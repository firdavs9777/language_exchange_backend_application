const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  text: {
    type: String,
    default: '',
    maxlength: [500, 'Text can not be more than 500 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required for the schema']
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
  moment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Moment',
    required: [true, 'Moment is required for the schema']
  },
  imageUrl: { type: String },
  // Reply support - parent comment reference
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
  },
  replyCount: {
    type: Number,
    default: 0,
  },
  // Like support
  likedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  likeCount: {
    type: Number,
    default: 0,
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
    default: 0,
  },
  // @Mentions
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    offset: Number,
    length: Number
  }],
  // Edit tracking
  isEdited: {
    type: Boolean,
    default: false,
  },
  // Optional correction (e.g. language-exchange partner correcting a post)
  correction: {
    type: new mongoose.Schema({
      originalText: {
        type: String,
        maxlength: [2000, 'Original text can not be more than 2000 characters']
      },
      correctedText: {
        type: String,
        required: [true, 'Corrected text is required when a correction is provided'],
        maxlength: [2000, 'Corrected text can not be more than 2000 characters']
      },
      explanation: {
        type: String,
        maxlength: [500, 'Explanation can not be more than 500 characters']
      },
    }, { _id: false }),
    required: false,
    default: undefined,
  },
});

// Indexes for performance
CommentSchema.index({ moment: 1, createdAt: -1 }); // For finding moment's comments
CommentSchema.index({ user: 1, createdAt: -1 }); // For finding user's comments
CommentSchema.index({ moment: 1, user: 1 }); // For checking user's comment on moment
CommentSchema.index({ parentComment: 1, createdAt: 1 }); // For finding replies

module.exports = mongoose.model('Comment', CommentSchema);
