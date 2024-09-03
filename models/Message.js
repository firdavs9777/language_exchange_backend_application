const mongoose = require('mongoose');
const slugify = require('slugify');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true,'Author is required for the schema']
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true,'Author is required for the schema']
  },
  slug: String,
  message: {
    type: String,
    required: [true, ' Please add a message'],
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  createdAt: {
    type: Date, default: Date.now
  }
});
module.exports = mongoose.model('Message', MessageSchema);
