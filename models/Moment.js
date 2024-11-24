const mongoose = require('mongoose');
const slugify = require('slugify');

const MomentSchema = new mongoose.Schema({
  title: {
    type: String,
    unique: false,
    required: [true, ' Please add a title'],
    trim: true,
    maxlength: [50, 'Title can not be more than 50 characters']
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
    maxlength: [1000, 'Description can not be more than 500 characters']
  },
  location: {
    // GeoJSON Point
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
  createdAt: {
    type: Date,
    default: Date.now()
  }
});

module.exports = mongoose.model('Moment', MomentSchema);
