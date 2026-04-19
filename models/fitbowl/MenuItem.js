const mongoose = require('mongoose');

const FitBowlMenuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a menu item name'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 1000
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlCategory',
    required: [true, 'Please add a category']
  },
  images: [{
    type: String
  }],
  basePrice: {
    type: Number,
    required: [true, 'Please add a base price']
  },
  sizes: [{
    name: {
      type: String,
      enum: ['small', 'medium', 'large'],
      required: true
    },
    priceModifier: {
      type: Number,
      default: 0
    }
  }],

  // Nutrition information
  nutrition: {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 }
  },

  dietaryTags: [{
    type: String,
    enum: ['keto', 'vegan', 'vegetarian', 'paleo', 'low-carb', 'high-protein', 'gluten-free']
  }],
  allergens: [{
    type: String,
    enum: ['nuts', 'dairy', 'shellfish', 'soy', 'gluten', 'eggs', 'fish']
  }],

  ingredients: [{
    name: {
      type: String,
      required: true
    },
    isCustomizable: {
      type: Boolean,
      default: false
    },
    isDefault: {
      type: Boolean,
      default: true
    },
    extraPrice: {
      type: Number,
      default: 0
    }
  }],

  isAvailable: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  preparationTime: {
    type: Number,
    default: 15
  },

  // Ratings & stats
  averageRating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'fitbowl_menu_items'
});

// Indexes
FitBowlMenuItemSchema.index({ category: 1 });
FitBowlMenuItemSchema.index({ dietaryTags: 1 });
FitBowlMenuItemSchema.index({ isAvailable: 1 });
FitBowlMenuItemSchema.index({ isFeatured: 1 });

module.exports = mongoose.model('FitBowlMenuItem', FitBowlMenuItemSchema);
