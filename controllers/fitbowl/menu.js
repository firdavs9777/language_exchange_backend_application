const asyncHandler = require('../../middleware/async');
const MenuItem = require('../../models/fitbowl/MenuItem');
const Category = require('../../models/fitbowl/Category');
const ErrorResponse = require('../../utils/errorResponse');

// @desc    Get all menu items (paginated, filtered)
// @route   GET /api/v1/fitbowl/menu
// @access  Public
exports.getMenuItems = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const query = {};

  // Filter by category
  if (req.query.category) {
    query.category = req.query.category;
  }

  // Filter by dietary tags (comma-separated)
  if (req.query.dietaryTags) {
    const tags = req.query.dietaryTags.split(',').map((tag) => tag.trim());
    query.dietaryTags = { $in: tags };
  }

  // Search by name or description
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    query.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  // Price range filter
  if (req.query.minPrice || req.query.maxPrice) {
    query.basePrice = {};
    if (req.query.minPrice) {
      query.basePrice.$gte = parseFloat(req.query.minPrice);
    }
    if (req.query.maxPrice) {
      query.basePrice.$lte = parseFloat(req.query.maxPrice);
    }
  }

  // Availability filter (default true)
  query.isAvailable = req.query.isAvailable !== undefined
    ? req.query.isAvailable === 'true'
    : true;

  // Sort
  const sort = req.query.sort || '-createdAt';

  const [total, menuItems] = await Promise.all([
    MenuItem.countDocuments(query),
    MenuItem.find(query)
      .populate('category')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  res.status(200).json({
    success: true,
    count: menuItems.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: menuItems
  });
});

// @desc    Get featured menu items
// @route   GET /api/v1/fitbowl/menu/featured
// @access  Public
exports.getFeaturedItems = asyncHandler(async (req, res, next) => {
  const menuItems = await MenuItem.find({
    isFeatured: true,
    isAvailable: true
  })
    .populate('category')
    .limit(10)
    .lean();

  res.status(200).json({
    success: true,
    count: menuItems.length,
    data: menuItems
  });
});

// @desc    Get single menu item
// @route   GET /api/v1/fitbowl/menu/:id
// @access  Public
exports.getMenuItem = asyncHandler(async (req, res, next) => {
  const menuItem = await MenuItem.findById(req.params.id)
    .populate('category')
    .populate('reviews');

  if (!menuItem) {
    return next(new ErrorResponse(`Menu item not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: menuItem
  });
});

// @desc    Get personalized recommendations
// @route   GET /api/v1/fitbowl/menu/recommendations
// @access  Private
exports.getRecommendations = asyncHandler(async (req, res, next) => {
  const userPreferences = req.user.dietaryPreferences || [];

  const query = {
    isAvailable: true
  };

  if (userPreferences.length > 0) {
    query.dietaryTags = { $in: userPreferences };
  }

  const menuItems = await MenuItem.find(query)
    .sort({ averageRating: -1 })
    .limit(10)
    .populate('category')
    .lean();

  res.status(200).json({
    success: true,
    count: menuItems.length,
    data: menuItems
  });
});

// @desc    Create menu item
// @route   POST /api/v1/fitbowl/menu
// @access  Private (kitchen_admin)
exports.createMenuItem = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'kitchen_admin' && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to create menu items', 403));
  }

  const menuItem = await MenuItem.create(req.body);

  res.status(201).json({
    success: true,
    data: menuItem
  });
});

// @desc    Update menu item
// @route   PUT /api/v1/fitbowl/menu/:id
// @access  Private (kitchen_admin)
exports.updateMenuItem = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'kitchen_admin' && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update menu items', 403));
  }

  const menuItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!menuItem) {
    return next(new ErrorResponse(`Menu item not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: menuItem
  });
});

// @desc    Delete menu item
// @route   DELETE /api/v1/fitbowl/menu/:id
// @access  Private (kitchen_admin)
exports.deleteMenuItem = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'kitchen_admin' && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete menu items', 403));
  }

  const menuItem = await MenuItem.findByIdAndDelete(req.params.id);

  if (!menuItem) {
    return next(new ErrorResponse(`Menu item not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Search menu items (text search)
// @route   GET /api/v1/fitbowl/menu/search
// @access  Public
exports.searchMenuItems = asyncHandler(async (req, res, next) => {
  const { q } = req.query;

  if (!q) {
    return next(new ErrorResponse('Please provide a search query', 400));
  }

  const menuItems = await MenuItem.find(
    { $text: { $search: q } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .populate('category')
    .lean();

  res.status(200).json({
    success: true,
    count: menuItems.length,
    data: menuItems
  });
});
