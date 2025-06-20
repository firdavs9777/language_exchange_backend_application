const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  gender: {
    type: String,
    required: [true, 'Please add your gender'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please use a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minLeng: 6,
    select: false
  },
  mbti: {
    type: String,
    required: [false, 'Please add your mbti']
  },
  bloodType: {
    type: String, required: [false, "Please add your blood type "]
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
  facebookId: {
    type: String,
    unique: true,
    sparse: true,
  },
  role: {
    type: String,
  },

  bio: {
    type: String,
    required: [true, 'Please add your bio']
  },
  birth_year: {
    type: String,
    required: [true, 'Please add birth year']
  },
  birth_month: {
    type: String,
    required: [true, 'Please add birth month']
  },
  birth_day: {
    type: String,
    required: [true, 'Please add birth day']
  },
  images: {
    type: [String],
    required: [true, 'Please add your image']
  },
  followers: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },
  following: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },
  native_language: {
    type: String,
    required: [true, 'Please add your native language']
  },
  language_to_learn: {
    type: String,
    required: [true, 'Please add language to learn']
  },
  status: {
    type: String,
    enum: ['online', 'away', 'busy', 'offline'],
    default: 'offline',
    index: true
  },
  isOnline: {
    type: Boolean,
    default: false,
    index: true
  },
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String,
    sparse: true // Allow multiple null values
  },
  // Privacy settings for status
  statusVisibility: {
    type: String,
    enum: ['everyone', 'contacts', 'nobody'],
    default: 'everyone'
  },
  lastSeenVisibility: {
    type: String,
    enum: ['everyone', 'contacts', 'nobody'],
    default: 'everyone'
  },

  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt Password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};
// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
// Generate and hash password
UserSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);
