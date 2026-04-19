const asyncHandler = require('../../middleware/async');
const Review = require('../../models/fitbowl/Review');
const MenuItem = require('../../models/fitbowl/MenuItem');
const Order = require('../../models/fitbowl/Order');
const ErrorResponse = require('../../utils/errorResponse');

/**
 * Helper to recalculate a menu item's average rating and total reviews
 */
const recalculateMenuItemRating = async (menuItemId) => {
  const stats = await Review.aggregate([
    { $match: { menuItem: menuItemId } },
    {
      $group: {
        _id: '$menuItem',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await MenuItem.findByIdAndUpdate(menuItemId, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      totalReviews: stats[0].totalReviews
    });
  } else {
    await MenuItem.findByIdAndUpdate(menuItemId, {
      averageRating: 0,
      totalReviews: 0
    });
  }
};

// @desc    Get reviews for a menu item
// @route   GET /api/v1/fitbowl/reviews?menuItem=:menuItemId
// @access  Public
exports.getReviews = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = {};

  if (req.query.menuItem) {
    query.menuItem = req.query.menuItem;
  }

  const [total, reviews] = await Promise.all([
    Review.countDocuments(query),
    Review.find(query)
      .populate('user', 'name avatar')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: reviews
  });
});

// @desc    Create review
// @route   POST /api/v1/fitbowl/reviews
// @access  Private
exports.createReview = asyncHandler(async (req, res, next) => {
  const { menuItem, rating, comment } = req.body;

  if (!menuItem || !rating) {
    return next(new ErrorResponse('Please provide menuItem and rating', 400));
  }

  // Check if menu item exists
  const menuItemDoc = await MenuItem.findById(menuItem);

  if (!menuItemDoc) {
    return next(new ErrorResponse(`Menu item not found with id of ${menuItem}`, 404));
  }

  // Check if user already reviewed this item
  const existingReview = await Review.findOne({
    user: req.user.id,
    menuItem
  });

  if (existingReview) {
    return next(new ErrorResponse('You have already reviewed this menu item', 400));
  }

  const review = await Review.create({
    user: req.user.id,
    menuItem,
    rating,
    comment
  });

  // Recalculate menu item rating
  await recalculateMenuItemRating(menuItemDoc._id);

  res.status(201).json({
    success: true,
    data: review
  });
});

// @desc    Update review
// @route   PUT /api/v1/fitbowl/reviews/:id
// @access  Private
exports.updateReview = asyncHandler(async (req, res, next) => {
  let review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }

  // Verify belongs to user
  if (review.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to update this review', 403));
  }

  const { rating, comment } = req.body;

  if (rating !== undefined) {
    review.rating = rating;
  }

  if (comment !== undefined) {
    review.comment = comment;
  }

  await review.save();

  // Recalculate menu item rating
  await recalculateMenuItemRating(review.menuItem);

  res.status(200).json({
    success: true,
    data: review
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/fitbowl/reviews/:id
// @access  Private
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ErrorResponse(`Review not found with id of ${req.params.id}`, 404));
  }

  // Verify belongs to user
  if (review.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to delete this review', 403));
  }

  const menuItemId = review.menuItem;

  await Review.findByIdAndDelete(req.params.id);

  // Recalculate menu item rating
  await recalculateMenuItemRating(menuItemId);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get current user's reviews
// @route   GET /api/v1/fitbowl/reviews/me
// @access  Private
exports.getUserReviews = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = { user: req.user.id };

  const [total, reviews] = await Promise.all([
    Review.countDocuments(query),
    Review.find(query)
      .populate('menuItem', 'name images')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  res.status(200).json({
    success: true,
    count: reviews.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: reviews
  });
});
