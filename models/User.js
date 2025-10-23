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
    minLength: 6,
    select: false
  },
  
  // EMAIL VERIFICATION FIELDS
  isEmailVerified: {
    type: Boolean,
    default: false
  },
   isRegistrationComplete: {  // ADD THIS NEW FIELD
    type: Boolean,
    default: false
  },
  emailVerificationCode: {
    type: String,
    select: false
  },
  emailVerificationExpire: {
    type: Date,
    select: false
  },
    passwordResetCode: {
    type: String,
    select: false
  },
  passwordResetExpire: {
    type: Date,
    select: false
  },
  
  mbti: {
    type: String,
    required: false
  },
  bloodType: {
    type: String,
    required: false
  },
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
  followers: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User'
  },
  following: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User'
  },
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
    sparse: true
  },
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
  }
});

UserSchema.methods.generatePasswordResetCode = function () {
  // Generate 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  
  // Hash and store the code
  this.passwordResetCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
  
  // Set expiration (5 minutes)
  this.passwordResetExpire = Date.now() + 5 * 60 * 1000;
  
  return code; // Return unhashed code to send via email
};
// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
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

// Generate and hash password reset token
UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Generate email verification code (6 digits)
UserSchema.methods.generateEmailVerificationCode = function () {
  // Generate 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  
  // Hash and store the code
  this.emailVerificationCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
  
  // Set expiration (15 minutes)
  this.emailVerificationExpire = Date.now() + 15 * 60 * 1000;
  
  return code; // Return unhashed code to send via email
};

module.exports = mongoose.model('User', UserSchema);