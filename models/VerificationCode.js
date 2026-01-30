/**
 * Verification Code Model
 * Stores email verification and password reset codes in MongoDB
 * with automatic expiration (TTL index)
 */

const mongoose = require('mongoose');

const VerificationCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true
  },
  code: {
    type: String,
    required: [true, 'Verification code is required']
  },
  type: {
    type: String,
    enum: ['email_verify', 'password_reset'],
    required: [true, 'Code type is required']
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5 // Max verification attempts
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index - automatically delete expired codes
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient lookups
VerificationCodeSchema.index({ email: 1, type: 1 });

// Static method to create or update verification code
VerificationCodeSchema.statics.createCode = async function(email, type, code, expiresInMinutes = 10) {
  // Remove any existing codes for this email and type
  await this.deleteMany({ email: email.toLowerCase(), type });

  // Create new code
  return await this.create({
    email: email.toLowerCase(),
    code,
    type,
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000)
  });
};

// Static method to verify a code
VerificationCodeSchema.statics.verifyCode = async function(email, code, type) {
  const record = await this.findOne({
    email: email.toLowerCase(),
    type,
    expiresAt: { $gt: new Date() }
  });

  if (!record) {
    return { valid: false, reason: 'Code not found or expired' };
  }

  if (record.attempts >= 5) {
    await record.deleteOne();
    return { valid: false, reason: 'Too many attempts. Please request a new code.' };
  }

  if (record.code !== code) {
    record.attempts += 1;
    await record.save();
    return { valid: false, reason: 'Invalid code', attemptsLeft: 5 - record.attempts };
  }

  // Code is valid - delete it (one-time use)
  await record.deleteOne();
  return { valid: true };
};

// Static method to check if a code exists
VerificationCodeSchema.statics.hasActiveCode = async function(email, type) {
  const count = await this.countDocuments({
    email: email.toLowerCase(),
    type,
    expiresAt: { $gt: new Date() }
  });
  return count > 0;
};

// Clean up old codes (called by scheduler)
VerificationCodeSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

module.exports = mongoose.model('VerificationCode', VerificationCodeSchema);
