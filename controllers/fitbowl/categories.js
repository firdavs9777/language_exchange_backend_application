const asyncHandler = require('../../middleware/async');
const Category = require('../../models/fitbowl/Category');
const MenuItem = require('../../models/fitbowl/MenuItem');
const ErrorResponse = require('../../utils/errorResponse');

// @desc    Get all categories
// @route   GET /api/v1/fitbowl/categories
// @access  Public
exports.getCategories = asyncHandler(async (req, res, next) => {
  const query = {};

  // By default only show active categories
  if (req.query.includeInactive !== 'true') {
    query.isActive = true;
  }

  const categories = await Category.find(query)
    .sort('displayOrder')
    .lean();

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories
  });
});

// @desc    Get single category
// @route   GET /api/v1/fitbowl/categories/:id
// @access  Public
exports.getCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    Create category
// @route   POST /api/v1/fitbowl/categories
// @access  Private (admin)
exports.createCategory = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to create categories', 403));
  }

  const category = await Category.create(req.body);

  res.status(201).json({
    success: true,
    data: category
  });
});

// @desc    Update category
// @route   PUT /api/v1/fitbowl/categories/:id
// @access  Private (admin)
exports.updateCategory = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update categories', 403));
  }

  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!category) {
    return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: category
  });
});

// @desc    Delete category
// @route   DELETE /api/v1/fitbowl/categories/:id
// @access  Private (admin)
exports.deleteCategory = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete categories', 403));
  }

  // Check if any menu items reference this category
  const menuItemCount = await MenuItem.countDocuments({ category: req.params.id });

  if (menuItemCount > 0) {
    return next(
      new ErrorResponse(
        `Cannot delete category. ${menuItemCount} menu item(s) are still referencing it`,
        400
      )
    );
  }

  const category = await Category.findByIdAndDelete(req.params.id);

  if (!category) {
    return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});
