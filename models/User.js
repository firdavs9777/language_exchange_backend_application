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
    required: function() {
      return !this.googleId && !this.facebookId;
    }
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
    required: function() {
      return !this.googleId && !this.facebookId;
    },
    minLength: 6,
    select: false
  },
  
  // EMAIL VERIFICATION FIELDS
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isRegistrationComplete: {
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
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  profileCompleted: {
  type: Boolean,
  default: false
},
  role: {
    type: String,
  },
  bio: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId;
    }
  },
  birth_year: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId;
    }
  },
  birth_month: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId;
    }
  },
  birth_day: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId;
    }
  },
  images: {
    type: [String],
    required: function() {
      return !this.googleId && !this.facebookId;
    }
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
    required: function() {
      return !this.googleId && !this.facebookId;
    }
  },
  language_to_learn: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId;
    }
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
  privacySettings: {
    showCountryRegion: {
      type: Boolean,
      default: true
    },
    showCity: {
      type: Boolean,
      default: true
    },
    showAge: {
      type: Boolean,
      default: true
    },
    showZodiac: {
      type: Boolean,
      default: true
    },
    showOnlineStatus: {
      type: Boolean,
      default: true
    },
    showGiftingLevel: {
      type: Boolean,
      default: true
    },
    birthdayNotification: {
      type: Boolean,
      default: true
    },
    personalizedAds: {
      type: Boolean,
      default: true
    }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  // Account Security Fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    device: {
      type: String,
      default: 'Unknown'
    },
    ipAddress: String,
    userAgent: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 30 * 24 * 60 * 60 // 30 days
    }
  }],
  loginHistory: [{
    ipAddress: String,
    userAgent: String,
    device: String,
    location: String,
    loginAt: {
      type: Date,
      default: Date.now
    },
    success: {
      type: Boolean,
      default: true
    }
  }],
  
  // Email change verification
  newEmail: {
    type: String,
    select: false
  },
  emailChangeCode: {
    type: String,
    select: false
  },
  emailChangeExpire: {
    type: Date,
    select: false
  },
  
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
  
  // Set expiration (5 minutes)
  this.emailVerificationExpire = Date.now() + 5 * 60 * 1000;
  
  return code; // Return unhashed code to send via email
};

// Account lockout methods
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

UserSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Generate refresh token
UserSchema.methods.generateRefreshToken = function(deviceInfo = {}) {
  const refreshToken = jwt.sign(
    { id: this._id, type: 'refresh' },
    process.env.JWT_SECRET + '_refresh',
    { expiresIn: '30d' }
  );
  
  // Store refresh token
  this.refreshTokens.push({
    token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
    device: deviceInfo.device || 'Unknown',
    ipAddress: deviceInfo.ipAddress,
    userAgent: deviceInfo.userAgent
  });
  
  // Keep only last 5 devices
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  
  return refreshToken;
};

// Revoke refresh token
UserSchema.methods.revokeRefreshToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  this.refreshTokens = this.refreshTokens.filter(
    rt => rt.token !== hashedToken
  );
  return this.save();
};

// Revoke all refresh tokens
UserSchema.methods.revokeAllRefreshTokens = function() {
  this.refreshTokens = [];
  return this.save();
};

// Generate email change code
UserSchema.methods.generateEmailChangeCode = function(newEmail) {
  const code = crypto.randomInt(100000, 999999).toString();
  
  this.newEmail = newEmail;
  this.emailChangeCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
  this.emailChangeExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
  
  return code;
};

module.exports = mongoose.model('User', UserSchema);