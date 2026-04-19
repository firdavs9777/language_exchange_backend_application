const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const FitBowlUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },

  // OAuth
  googleId: {
    type: String,
    sparse: true
  },
  appleId: {
    type: String,
    sparse: true
  },

  role: {
    type: String,
    enum: ['user', 'kitchen_admin', 'delivery_driver'],
    default: 'user'
  },

  // Dietary profile
  dietaryPreferences: [{
    type: String,
    enum: ['keto', 'vegan', 'vegetarian', 'paleo', 'low-carb', 'high-protein', 'gluten-free']
  }],
  allergies: [{
    type: String,
    enum: ['nuts', 'dairy', 'shellfish', 'soy', 'gluten', 'eggs', 'fish']
  }],
  calorieTarget: {
    type: Number,
    default: 2000
  },
  proteinTarget: {
    type: Number,
    default: 150
  },
  carbTarget: {
    type: Number,
    default: 200
  },
  fatTarget: {
    type: Number,
    default: 65
  },

  // Push notifications
  fcmToken: {
    type: String
  },

  // Password reset
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'fitbowl_users'
});

// Indexes
FitBowlUserSchema.index({ email: 1 });
FitBowlUserSchema.index({ googleId: 1 });
FitBowlUserSchema.index({ appleId: 1 });

// Hash password
FitBowlUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT
FitBowlUserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// Match password
FitBowlUserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate reset token
FitBowlUserSchema.methods.getResetPasswordToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

module.exports = mongoose.model('FitBowlUser', FitBowlUserSchema);
