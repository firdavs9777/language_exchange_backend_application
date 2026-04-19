const mongoose = require('mongoose');

const FitBowlReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlUser',
    required: true
  },
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlMenuItem',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FitBowlOrder'
  },
  rating: {
    type: Number,
    required: [true, 'Please add a rating'],
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  },
  images: [{
    type: String
  }]
}, {
  timestamps: true,
  collection: 'fitbowl_reviews'
});

// One review per user per menu item
FitBowlReviewSchema.index({ user: 1, menuItem: 1 }, { unique: true });

// Static method to calculate average rating for a menu item
FitBowlReviewSchema.statics.getAverageRating = async function(menuItemId) {
  const result = await this.aggregate([
    { $match: { menuItem: menuItemId } },
    {
      $group: {
        _id: '$menuItem',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  try {
    if (result.length > 0) {
      await mongoose.model('FitBowlMenuItem').findByIdAndUpdate(menuItemId, {
        averageRating: Math.round(result[0].averageRating * 10) / 10,
        totalReviews: result[0].totalReviews
      });
    } else {
      await mongoose.model('FitBowlMenuItem').findByIdAndUpdate(menuItemId, {
        averageRating: 0,
        totalReviews: 0
      });
    }
  } catch (err) {
    console.error('Error updating average rating:', err);
  }
};

// Recalculate after save
FitBowlReviewSchema.post('save', async function() {
  await this.constructor.getAverageRating(this.menuItem);
});

// Recalculate after remove
FitBowlReviewSchema.post('deleteOne', { document: true, query: false }, async function() {
  await this.constructor.getAverageRating(this.menuItem);
});

module.exports = mongoose.model('FitBowlReview', FitBowlReviewSchema);
