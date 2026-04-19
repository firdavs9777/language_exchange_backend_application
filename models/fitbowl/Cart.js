const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlMenuItem',
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: [1, 'Quantity must be at least 1']
  },
  size: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  customizations: [{
    ingredient: {
      type: String
    },
    action: {
      type: String,
      enum: ['add', 'remove']
    },
    extraPrice: {
      type: Number,
      default: 0
    }
  }],
  itemPrice: {
    type: Number
  },
  totalPrice: {
    type: Number
  }
}, { _id: true });

const FitBowlCartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlUser',
    required: true,
    unique: true
  },
  items: [CartItemSchema],
  promoCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlPromoCode'
  },
  discount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'fitbowl_carts'
});

// Index
FitBowlCartSchema.index({ user: 1 });

module.exports = mongoose.model('FitBowlCart', FitBowlCartSchema);
