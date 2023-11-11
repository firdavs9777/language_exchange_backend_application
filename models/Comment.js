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
  }
});

module.exports = mongoose.model('Comment', CommentSchema);
