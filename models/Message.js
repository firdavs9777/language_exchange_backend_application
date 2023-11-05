const mongoose = require('mongoose');
const slugify = require('slugify');

const MessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, ' Please add a title'],
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  slug: String,
  message: {
    type: String,
    required: [true, ' Please add a title'],
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  createdAt: {
    type: Date, default: Date.now
  }
});
module.exports = mongoose.model('Message', MessageSchema);
