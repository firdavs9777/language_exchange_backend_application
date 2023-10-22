const mongoose = require('mongoose');
const slugify = require('slugify');

const MomentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, ' Please add a title'],
    unique: true,
    trim: true,
    maxlength: [50, 'Title can not be more than 50 characters']
  },
  slug: String,
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Name can not be more than 50 characters']
  },
  location: {
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
    }
  },
  image: {
    type: String,
    default: 'no-photo.jpg'
  },
  createdAt: {
    type: Date,
    default: Date.now()
  }
});

module.exports = mongoose.model('Moment', MomentSchema);
