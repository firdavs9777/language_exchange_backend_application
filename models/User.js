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
      return !this.googleId && !this.facebookId && !this.appleId;
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
      return !this.googleId && !this.facebookId && !this.appleId;
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
  // TERMS OF SERVICE FIELDS
  termsAccepted: {
    type: Boolean,
    default: false,
    required: true
  },
  termsAcceptedDate: {
    type: Date,
    default: null
  },
  
  // FCM TOKENS
  fcmTokens: [{
    token: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      enum: ['ios', 'android'],
      required: true
    },
    deviceId: {
      type: String,
      required: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    active: {
      type: Boolean,
      default: true
    }
  }],
  
  // NOTIFICATION SETTINGS
  notificationSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    chatMessages: {
      type: Boolean,
      default: true
    },
    moments: {
      type: Boolean,
      default: true
    },
    followerMoments: {
      type: Boolean,
      default: true
    },
    friendRequests: {
      type: Boolean,
      default: true
    },
    profileVisits: {
      type: Boolean,
      default: true
    },
    marketing: {
      type: Boolean,
      default: false
    },
    sound: {
      type: Boolean,
      default: true
    },
    vibration: {
      type: Boolean,
      default: true
    },
    showPreview: {
      type: Boolean,
      default: true
    },
    mutedChats: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    }],
    // Learning notifications
    learningReminders: {
      type: Boolean,
      default: true
    },
    streakReminders: {
      type: Boolean,
      default: true
    },
    vocabularyReviewReminders: {
      type: Boolean,
      default: true
    },
    achievementNotifications: {
      type: Boolean,
      default: true
    },
    leaderboardNotifications: {
      type: Boolean,
      default: true
    }
  },

  // BADGE COUNTS
  badges: {
    unreadMessages: {
      type: Number,
      default: 0
    },
    unreadNotifications: {
      type: Number,
      default: 0
    }
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
  appleId: {
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
  enum: ['user', 'admin'],  // Add enum
  default: 'user'            // Add default
},
  // User Mode: visitor, regular, or vip
  userMode: {
    type: String,
    enum: ['visitor', 'regular', 'vip'],
    default: 'regular'
  },

  // VIP subscription details
  vipSubscription: {
    isActive: {
      type: Boolean,
      default: false
    },
    plan: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', null],
      default: null
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    autoRenew: {
      type: Boolean,
      default: false
    },
    paymentMethod: {
      type: String,
      default: null
    },
    lastPaymentDate: {
      type: Date,
      default: null
    },
    nextBillingDate: {
      type: Date,
      default: null
    },
    transactions: [{
      transactionId: String,
      productId: String,
      plan: String,
      purchaseDate: Date,
      type: {
        type: String,
        enum: ['initial', 'renewal', 'upgrade', 'downgrade'],
        default: 'initial'
      },
      platform: {
        type: String,
        enum: ['ios', 'android', null],
        default: null
      },
      purchaseToken: String // For Android - truncated token for webhook matching
    }],
    // Tracking for expiry warning notifications
    warnings: {
      '7day': { type: Boolean, default: false },
      '3day': { type: Boolean, default: false },
      '1day': { type: Boolean, default: false }
    },
    gracePeriodNotified: {
      type: Boolean,
      default: false
    }
  },

  // VIP features
  vipFeatures: {
    unlimitedMessages: {
      type: Boolean,
      default: false
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    noAds: {
      type: Boolean,
      default: false
    },
    customBadge: {
      type: Boolean,
      default: false
    },
    advancedSearch: {
      type: Boolean,
      default: false
    },
    translationFeature: {
      type: Boolean,
      default: false
    }
  },

  // Visitor mode limitations
  visitorLimitations: {
    messagesSent: {
      type: Number,
      default: 0
    },
    lastMessageReset: {
      type: Date,
      default: Date.now
    },
    profileViewsToday: {
      type: Number,
      default: 0
    },
    lastProfileViewReset: {
      type: Date,
      default: Date.now
    }
  },
  // Regular user limitations
  regularUserLimitations: {
    messagesSentToday: {
      type: Number,
      default: 0
    },
    lastMessageReset: {
      type: Date,
      default: Date.now
    },
    momentsCreatedToday: {
      type: Number,
      default: 0
    },
    lastMomentReset: {
      type: Date,
      default: Date.now
    },
    storiesCreatedToday: {
      type: Number,
      default: 0
    },
    lastStoryReset: {
      type: Date,
      default: Date.now
    },
    commentsCreatedToday: {
      type: Number,
      default: 0
    },
    lastCommentReset: {
      type: Date,
      default: Date.now
    },
    profileViewsToday: {
      type: Number,
      default: 0
    },
    lastProfileViewReset: {
      type: Date,
      default: Date.now
    }
  },
  bio: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId && !this.appleId;
    }
  },
  birth_year: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId && !this.appleId;
    }
  },
  birth_month: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId && !this.appleId;
    }
  },
  birth_day: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId && !this.appleId;
    }
  },
  images: {
    type: [String],
    required: function() {
      return !this.googleId && !this.facebookId && !this.appleId;
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
  
  // Profile visitor stats
  profileStats: {
    totalVisits: {
      type: Number,
      default: 0
    },
    uniqueVisitors: {
      type: Number,
      default: 0
    },
    lastVisitorUpdate: {
      type: Date,
      default: null
    }
  },
  
  // Close Friends list (for story privacy)
  closeFriends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Users who added you to their close friends (for notifications)
  closeFriendsOf: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // User blocking
  blockedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    blockedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      default: null
    }
  }],
  blockedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    blockedAt: {
      type: Date,
      default: Date.now
    }
  }],
  native_language: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId && !this.appleId;
    }
  },
  language_to_learn: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId && !this.appleId;
    }
  },
  // Community interest topics (max 10)
  topics: [{
    type: String,
    maxlength: 50
  }],
  // Language proficiency level (CEFR scale)
  languageLevel: {
    type: String,
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null],
    default: null
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
    },
    // Email notification preferences
    emailNotifications: {
      type: Boolean,
      default: true
    },
    weeklyDigest: {
      type: Boolean,
      default: true
    },
    newMessageEmails: {
      type: Boolean,
      default: true  // Only sent when user is inactive for 24+ hours
    },
    newFollowerEmails: {
      type: Boolean,
      default: true
    },
    securityAlerts: {
      type: Boolean,
      default: true  // Password changes, new logins
    }
  },
  
  // Activity tracking for inactivity emails
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  inactivityEmailsSent: {
    type: [String],
    default: []  // ['first_reminder', 'second_reminder', 'warning', 'final_warning']
  },
  lastInactivityEmailAt: {
    type: Date
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
  
  // ========== ADVANCED CHAT FEATURES ==========
  
  // Bookmarked messages
  bookmarkedMessages: [{
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    bookmarkedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Quick reply templates (global, not per conversation)
  quickReplyTemplates: [{
    text: {
      type: String,
      maxlength: 200
    },
    category: {
      type: String,
      default: 'general'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Language learning preferences (HelloTalk style)
  languageLearningSettings: {
    // Show correction suggestions
    acceptCorrections: {
      type: Boolean,
      default: true
    },
    // Auto-translate messages
    autoTranslate: {
      type: Boolean,
      default: false
    },
    // Preferred translation target
    translateTo: String,
    // Show original text with translation
    showOriginal: {
      type: Boolean,
      default: true
    }
  },

  // ========== LEARNING STATS (Cached summary for quick profile display) ==========
  learningStats: {
    // Streak info
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    // XP and Level
    totalXP: {
      type: Number,
      default: 0
    },
    level: {
      type: Number,
      default: 1
    },
    // Proficiency
    proficiencyLevel: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      default: 'A1'
    },
    // Progress counts
    lessonsCompleted: {
      type: Number,
      default: 0
    },
    vocabularyCount: {
      type: Number,
      default: 0
    },
    vocabularyMastered: {
      type: Number,
      default: 0
    },
    achievementsUnlocked: {
      type: Number,
      default: 0
    },
    // Rankings
    weeklyRank: {
      type: Number,
      default: null
    },
    // Last synced from LearningProgress
    lastSyncedAt: {
      type: Date,
      default: null
    }
  },

  // Learning preferences (separate from languageLearningSettings for backwards compat)
  learningPreferences: {
    dailyGoal: {
      type: String,
      enum: ['casual', 'regular', 'serious', 'intense'],
      default: 'regular'
    },
    reminderEnabled: {
      type: Boolean,
      default: true
    },
    reminderTime: {
      type: String,
      default: '09:00' // HH:mm format
    },
    soundEffects: {
      type: Boolean,
      default: true
    },
    showStreakReminders: {
      type: Boolean,
      default: true
    },
    weeklyReportEnabled: {
      type: Boolean,
      default: true
    }
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

// Check if user is VIP
UserSchema.methods.isVIP = function() {
  return this.userMode === 'vip' && this.vipSubscription.isActive &&
         this.vipSubscription.endDate > Date.now();
};

// Check if user is visitor
UserSchema.methods.isVisitor = function() {
  return this.userMode === 'visitor';
};

// Activate VIP subscription
UserSchema.methods.activateVIP = function(plan, paymentMethod) {
  const now = new Date();
  let endDate = new Date();

  // Calculate end date based on plan
  switch(plan) {
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'quarterly':
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }

  this.userMode = 'vip';
  this.vipSubscription = {
    isActive: true,
    plan: plan,
    startDate: now,
    endDate: endDate,
    autoRenew: false,
    paymentMethod: paymentMethod,
    lastPaymentDate: now,
    nextBillingDate: endDate,
    transactions: this.vipSubscription?.transactions || [],
    // Reset warning flags on activation/renewal
    warnings: {
      '7day': false,
      '3day': false,
      '1day': false
    },
    gracePeriodNotified: false
  };

  // Enable all VIP features
  this.vipFeatures = {
    unlimitedMessages: true,
    prioritySupport: true,
    noAds: true,
    customBadge: true,
    advancedSearch: true,
    translationFeature: true
  };

  return this.save();
};

// Deactivate VIP subscription
UserSchema.methods.deactivateVIP = function() {
  this.userMode = 'regular';
  this.vipSubscription.isActive = false;

  // Disable all VIP features
  this.vipFeatures = {
    unlimitedMessages: false,
    prioritySupport: false,
    noAds: false,
    customBadge: false,
    advancedSearch: false,
    translationFeature: false
  };

  return this.save();
};

// Convert visitor to regular user
UserSchema.methods.upgradeFromVisitor = function() {
  if (this.userMode === 'visitor') {
    this.userMode = 'regular';
    // Reset visitor limitations
    this.visitorLimitations = {
      messagesSent: 0,
      lastMessageReset: Date.now(),
      profileViewsToday: 0,
      lastProfileViewReset: Date.now()
    };
    return this.save();
  }
  return Promise.resolve(this);
};

// Check message limit based on user mode
UserSchema.methods.canSendMessage = function() {
  const LIMITS = require('../config/limitations');
  
  if (this.userMode === 'vip') return true;

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastMessageReset);

    // Reset counter if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.messagesSentToday = 0;
      this.regularUserLimitations.lastMessageReset = now;
    }

    return this.regularUserLimitations.messagesSentToday < LIMITS.regular.messagesPerDay;
  }

  if (this.userMode === 'visitor') {
    const now = new Date();
    const lastReset = new Date(this.visitorLimitations.lastMessageReset);

    // Reset counter if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.visitorLimitations.messagesSent = 0;
      this.visitorLimitations.lastMessageReset = now;
    }

    return this.visitorLimitations.messagesSent < LIMITS.visitor.messagesPerDay;
  }

  return false;
};

// Increment message count based on user mode
UserSchema.methods.incrementMessageCount = function() {
  if (this.userMode === 'vip') {
    return Promise.resolve(this); // VIP has unlimited messages
  }

  if (this.userMode === 'regular') {
    // Reset if new day
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastMessageReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.messagesSentToday = 0;
      this.regularUserLimitations.lastMessageReset = now;
    }
    this.regularUserLimitations.messagesSentToday += 1;
    return this.save();
  }

  if (this.userMode === 'visitor') {
    // Reset if new day
    const now = new Date();
    const lastReset = new Date(this.visitorLimitations.lastMessageReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.visitorLimitations.messagesSent = 0;
      this.visitorLimitations.lastMessageReset = now;
    }
    this.visitorLimitations.messagesSent += 1;
    return this.save();
  }

  return Promise.resolve(this);
};

// Check profile view limit based on user mode
UserSchema.methods.canViewProfile = function() {
  const LIMITS = require('../config/limitations');
  
  if (this.userMode === 'vip') return true;

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastProfileViewReset);

    // Reset counter if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.profileViewsToday = 0;
      this.regularUserLimitations.lastProfileViewReset = now;
    }

    return this.regularUserLimitations.profileViewsToday < LIMITS.regular.profileViewsPerDay;
  }

  if (this.userMode === 'visitor') {
    const now = new Date();
    const lastReset = new Date(this.visitorLimitations.lastProfileViewReset);

    // Reset counter if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.visitorLimitations.profileViewsToday = 0;
      this.visitorLimitations.lastProfileViewReset = now;
    }

    return this.visitorLimitations.profileViewsToday < LIMITS.visitor.profileViewsPerDay;
  }

  return false;
};

// Increment profile view count based on user mode
UserSchema.methods.incrementProfileViewCount = function() {
  if (this.userMode === 'vip') {
    return Promise.resolve(this); // VIP has unlimited profile views
  }

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastProfileViewReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.profileViewsToday = 0;
      this.regularUserLimitations.lastProfileViewReset = now;
    }
    this.regularUserLimitations.profileViewsToday += 1;
    return this.save();
  }

  if (this.userMode === 'visitor') {
    const now = new Date();
    const lastReset = new Date(this.visitorLimitations.lastProfileViewReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.visitorLimitations.profileViewsToday = 0;
      this.visitorLimitations.lastProfileViewReset = now;
    }
    this.visitorLimitations.profileViewsToday += 1;
    return this.save();
  }

  return Promise.resolve(this);
};

// Check if regular user can create moment
UserSchema.methods.canCreateMoment = function() {
  const LIMITS = require('../config/limitations');
  
  if (this.userMode === 'vip') return true;
  if (this.userMode === 'visitor') return false; // Visitors cannot create moments

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastMomentReset);

    // Reset counter if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.momentsCreatedToday = 0;
      this.regularUserLimitations.lastMomentReset = now;
    }

    return this.regularUserLimitations.momentsCreatedToday < LIMITS.regular.momentsPerDay;
  }

  return false;
};

// Increment moment count for regular users
UserSchema.methods.incrementMomentCount = function() {
  if (this.userMode === 'vip') {
    return Promise.resolve(this); // VIP has unlimited moments
  }

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastMomentReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.momentsCreatedToday = 0;
      this.regularUserLimitations.lastMomentReset = now;
    }
    this.regularUserLimitations.momentsCreatedToday += 1;
    return this.save();
  }

  return Promise.resolve(this);
};

// Check if regular user can create story
UserSchema.methods.canCreateStory = function() {
  const LIMITS = require('../config/limitations');
  
  if (this.userMode === 'vip') return true;
  if (this.userMode === 'visitor') return false; // Visitors cannot create stories

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastStoryReset);

    // Reset counter if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.storiesCreatedToday = 0;
      this.regularUserLimitations.lastStoryReset = now;
    }

    return this.regularUserLimitations.storiesCreatedToday < LIMITS.regular.storiesPerDay;
  }

  return false;
};

// Increment story count for regular users
UserSchema.methods.incrementStoryCount = function() {
  if (this.userMode === 'vip') {
    return Promise.resolve(this); // VIP has unlimited stories
  }

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastStoryReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.storiesCreatedToday = 0;
      this.regularUserLimitations.lastStoryReset = now;
    }
    this.regularUserLimitations.storiesCreatedToday += 1;
    return this.save();
  }

  return Promise.resolve(this);
};

// Check if regular user can create comment
UserSchema.methods.canCreateComment = function() {
  const LIMITS = require('../config/limitations');
  
  if (this.userMode === 'vip') return true;
  if (this.userMode === 'visitor') return false; // Visitors cannot create comments

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastCommentReset);

    // Reset counter if it's a new day
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.commentsCreatedToday = 0;
      this.regularUserLimitations.lastCommentReset = now;
    }

    return this.regularUserLimitations.commentsCreatedToday < LIMITS.regular.commentsPerDay;
  }

  return false;
};

// Increment comment count for regular users
UserSchema.methods.incrementCommentCount = function() {
  if (this.userMode === 'vip') {
    return Promise.resolve(this); // VIP has unlimited comments
  }

  if (this.userMode === 'regular') {
    const now = new Date();
    const lastReset = new Date(this.regularUserLimitations.lastCommentReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
      this.regularUserLimitations.commentsCreatedToday = 0;
      this.regularUserLimitations.lastCommentReset = now;
    }
    this.regularUserLimitations.commentsCreatedToday += 1;
    return this.save();
  }

  return Promise.resolve(this);
};

// Reset all daily limits if it's a new day
UserSchema.methods.resetDailyLimits = function() {
  const now = new Date();
  let needsSave = false;

  // Reset regular user limitations
  if (this.userMode === 'regular') {
    const lastMessageReset = new Date(this.regularUserLimitations.lastMessageReset);
    const lastMomentReset = new Date(this.regularUserLimitations.lastMomentReset);
    const lastStoryReset = new Date(this.regularUserLimitations.lastStoryReset);
    const lastCommentReset = new Date(this.regularUserLimitations.lastCommentReset);
    const lastProfileViewReset = new Date(this.regularUserLimitations.lastProfileViewReset);

    const isNewDay = (lastReset) => {
      return now.getDate() !== lastReset.getDate() || 
             now.getMonth() !== lastReset.getMonth() || 
             now.getFullYear() !== lastReset.getFullYear();
    };

    if (isNewDay(lastMessageReset)) {
      this.regularUserLimitations.messagesSentToday = 0;
      this.regularUserLimitations.lastMessageReset = now;
      needsSave = true;
    }
    if (isNewDay(lastMomentReset)) {
      this.regularUserLimitations.momentsCreatedToday = 0;
      this.regularUserLimitations.lastMomentReset = now;
      needsSave = true;
    }
    if (isNewDay(lastStoryReset)) {
      this.regularUserLimitations.storiesCreatedToday = 0;
      this.regularUserLimitations.lastStoryReset = now;
      needsSave = true;
    }
    if (isNewDay(lastCommentReset)) {
      this.regularUserLimitations.commentsCreatedToday = 0;
      this.regularUserLimitations.lastCommentReset = now;
      needsSave = true;
    }
    if (isNewDay(lastProfileViewReset)) {
      this.regularUserLimitations.profileViewsToday = 0;
      this.regularUserLimitations.lastProfileViewReset = now;
      needsSave = true;
    }
  }

  // Reset visitor limitations
  if (this.userMode === 'visitor') {
    const lastMessageReset = new Date(this.visitorLimitations.lastMessageReset);
    const lastProfileViewReset = new Date(this.visitorLimitations.lastProfileViewReset);

    const isNewDay = (lastReset) => {
      return now.getDate() !== lastReset.getDate() || 
             now.getMonth() !== lastReset.getMonth() || 
             now.getFullYear() !== lastReset.getFullYear();
    };

    if (isNewDay(lastMessageReset)) {
      this.visitorLimitations.messagesSent = 0;
      this.visitorLimitations.lastMessageReset = now;
      needsSave = true;
    }
    if (isNewDay(lastProfileViewReset)) {
      this.visitorLimitations.profileViewsToday = 0;
      this.visitorLimitations.lastProfileViewReset = now;
      needsSave = true;
    }
  }

  if (needsSave) {
    return this.save();
  }

  return Promise.resolve(this);
};

// Block a user
UserSchema.methods.blockUser = function(userId, reason = null) {
  // Check if already blocked
  const alreadyBlocked = this.blockedUsers.some(
    block => block.userId.toString() === userId.toString()
  );
  
  if (alreadyBlocked) {
    return Promise.resolve(this);
  }
  
  this.blockedUsers.push({
    userId: userId,
    blockedAt: new Date(),
    reason: reason
  });
  
  // Remove from following/followers if exists
  this.following = this.following.filter(
    id => id.toString() !== userId.toString()
  );
  
  return this.save();
};

// Unblock a user
UserSchema.methods.unblockUser = function(userId) {
  this.blockedUsers = this.blockedUsers.filter(
    block => block.userId.toString() !== userId.toString()
  );
  return this.save();
};

// Check if user is blocked
UserSchema.methods.isBlocked = function(userId) {
  return this.blockedUsers.some(
    block => block.userId.toString() === userId.toString()
  );
};

// Check if user is blocked by another user
UserSchema.methods.isBlockedBy = function(userId) {
  return this.blockedBy.some(
    block => block.userId.toString() === userId.toString()
  );
};

// FCM Token indexes
UserSchema.index({ 'fcmTokens.token': 1 });
UserSchema.index({ 'fcmTokens.deviceId': 1 });

module.exports = mongoose.model('User', UserSchema);