const mongoose = require('mongoose');
const slugify = require('slugify');

const FitBowlCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    unique: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    maxlength: 500
  },
  image: {
    type: String,
    default: ''
  },
  slug: {
    type: String,
    unique: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'fitbowl_categories'
});

// Indexes
FitBowlCategorySchema.index({ slug: 1 });
FitBowlCategorySchema.index({ displayOrder: 1 });

// Generate slug from name
FitBowlCategorySchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('FitBowlCategory', FitBowlCategorySchema);
