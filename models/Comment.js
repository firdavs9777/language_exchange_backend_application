const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Please add a text'],
    maxlength: [500, 'Name can not be more than 50 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true,'Author is required for the schema']
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  moment: {
    type: mongoose.Schema.Types.ObjectId,
    ref:'Moment',
    required: [true,'Moment is required for the schema']
  },
  imageUrl: { type: String },
});

// Indexes for performance
CommentSchema.index({ moment: 1, createdAt: -1 }); // For finding moment's comments
CommentSchema.index({ user: 1, createdAt: -1 }); // For finding user's comments
CommentSchema.index({ moment: 1, user: 1 }); // For checking user's comment on moment

module.exports = mongoose.model('Comment', CommentSchema);
