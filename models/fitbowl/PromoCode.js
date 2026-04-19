const mongoose = require('mongoose');

const FitBowlPromoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Please add a promo code'],
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: [true, 'Please add a discount value']
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  maxDiscount: {
    type: Number
  },
  usageLimit: {
    type: Number
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlUser'
  }],
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'fitbowl_promo_codes'
});

// Indexes
FitBowlPromoCodeSchema.index({ code: 1 });

// Uppercase code before save
FitBowlPromoCodeSchema.pre('save', function(next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

// Validate promo code
FitBowlPromoCodeSchema.methods.isValid = function(userId, orderAmount) {
  // Check if active
  if (!this.isActive) {
    return { valid: false, message: 'This promo code is no longer active' };
  }

  // Check start date
  if (this.startDate && new Date() < this.startDate) {
    return { valid: false, message: 'This promo code is not yet available' };
  }

  // Check end date
  if (this.endDate && new Date() > this.endDate) {
    return { valid: false, message: 'This promo code has expired' };
  }

  // Check usage limit
  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return { valid: false, message: 'This promo code has reached its usage limit' };
  }

  // Check if user already used it
  if (userId && this.usedBy.some(id => id.toString() === userId.toString())) {
    return { valid: false, message: 'You have already used this promo code' };
  }

  // Check minimum order amount
  if (orderAmount && orderAmount < this.minOrderAmount) {
    return {
      valid: false,
      message: `Minimum order amount is ${this.minOrderAmount} for this promo code`
    };
  }

  return { valid: true, message: 'Promo code is valid' };
};

module.exports = mongoose.model('FitBowlPromoCode', FitBowlPromoCodeSchema);
