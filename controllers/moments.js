// controllers/moments.js
const path = require('path');
const asyncHandler = require('../middleware/async');
const Moment = require('../models/Moment');
const ErrorResponse = require('../utils/errorResponse');
const { processUserImages, processMomentImages } = require('../utils/imageUtils');
const deleteFromSpaces = require('../utils/deleteFromSpaces');

// Minimal user fields for population (performance optimization)
const USER_FIELDS = 'name email bio images native_language language_to_learn';

/**
 * @desc    Get all moments (feed)
 * @route   GET /api/v1/moments
 * @access  Public/Private
 */
exports.getMoments = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const actualLimit = Math.min(limit, 50); // Max 50 per page

  // Build query based on privacy and user
  let query = { privacy: 'public' };

  // If user is logged in, they can see their own posts
  if (req.user) {
    query = {
      $or: [
        { privacy: 'public' },
        { user: req.user._id }, // User's own posts (any privacy)
      ]
    };
  }

  // Optimize: Count and query in parallel
  const [totalMoments, moments] = await Promise.all([
    Moment.countDocuments(query),
    Moment.find(query)
      .populate('user', USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(actualLimit)
      .lean() // Use lean() for read-only queries (faster)
  ]);

  // Process images for all moments
  const momentsWithImages = moments.map(moment => {
    const userWithImages = processUserImages(moment.user, req);
    const momentWithImages = processMomentImages(moment, req);
    
    return {
      ...momentWithImages,
      user: userWithImages,
      commentCount: moment.comments?.length || moment.commentCount || 0
    };
  });

  const totalPages = Math.ceil(totalMoments / actualLimit);

  res.status(200).json({
    success: true,
    moments: momentsWithImages,
    pagination: {
      currentPage: page,
      totalPages,
      totalMoments,
      limit: actualLimit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    }
  });
});

/**
 * @desc    Get single moment
 * @route   GET /api/v1/moments/:id
 * @access  Public
 */
exports.getMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findById(req.params.id)
    .populate('user', USER_FIELDS)
    .populate({
      path: 'comments',
      select: 'text user createdAt',
      populate: {
        path: 'user',
        select: 'name images'
      },
      options: { sort: { createdAt: -1 }, limit: 50 }
    })
    .lean();

  if (!moment) {
    return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
  }

  // Process images
  const userWithImages = processUserImages(moment.user, req);
  const momentWithImages = processMomentImages(moment, req);

  res.status(200).json({
    success: true,
    data: {
      ...momentWithImages,
      user: userWithImages,
      commentCount: moment.comments?.length || moment.commentCount || 0
    }
  });
});

/**
 * @desc    Get user's moments
 * @route   GET /api/v1/moments/user/:userId
 * @access  Public
 */
exports.getUserMoments = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const actualLimit = Math.min(limit, 50);

  // Build query - show all user moments if viewing own profile, otherwise only public
  let query = { user: req.params.userId };
  
  // If not viewing own profile, only show public moments
  if (!req.user || req.user._id.toString() !== req.params.userId) {
    query.privacy = 'public';
  }

  const [totalMoments, moments] = await Promise.all([
    Moment.countDocuments(query),
    Moment.find(query)
      .populate('user', USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(actualLimit)
      .lean()
  ]);

  const momentsWithImages = moments.map(moment => {
    const userWithImages = processUserImages(moment.user, req);
    const momentWithImages = processMomentImages(moment, req);
    
    return {
      ...momentWithImages,
      user: userWithImages,
      commentCount: moment.comments?.length || moment.commentCount || 0
    };
  });

  const totalPages = Math.ceil(totalMoments / actualLimit);

  res.status(200).json({
    success: true,
    count: momentsWithImages.length,
    totalMoments,
    data: momentsWithImages,
    pagination: {
      currentPage: page,
      totalPages,
      limit: actualLimit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    }
  });
});

/**
 * @desc    Create moment
 * @route   POST /api/v1/moments
 * @access  Private
 */
exports.createMoment = asyncHandler(async (req, res, next) => {
  const {
    title,
    description,
    mood,
    tags,
    category,
    language,
    privacy,
    location,
    scheduledFor
  } = req.body;

  // Use authenticated user instead of body user (security)
  const userId = req.user._id;

  // Check moment creation limit
  const User = require('../models/User');
  const { resetDailyCounters, formatLimitError } = require('../utils/limitations');
  const LIMITS = require('../config/limitations');
  
  const user = req.limitationUser || await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Visitors cannot create moments
  if (user.userMode === 'visitor') {
    return next(new ErrorResponse('Visitors cannot create moments. Please upgrade to regular user.', 403));
  }

  // Reset counters if new day
  await resetDailyCounters(user);
  await user.save();

  // Check if user can create moment
  const canCreate = await user.canCreateMoment();
  if (!canCreate) {
    const current = user.regularUserLimitations.momentsCreatedToday || 0;
    const max = LIMITS.regular.momentsPerDay;
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(24, 0, 0, 0);
    return next(formatLimitError('moments', current, max, nextReset));
  }

  // Validate scheduled date
  if (scheduledFor && new Date(scheduledFor) < new Date()) {
    return next(new ErrorResponse('Scheduled date must be in the future', 400));
  }

  // Create moment data
  const momentData = {
    title,
    description,
    user: userId,
    mood: mood || '',
    tags: tags || [],
    category: category || 'general',
    language: language || 'en',
    privacy: privacy || 'public',
    scheduledFor: scheduledFor || null
  };

  // If images were uploaded via multer-s3, add their CDN URLs
  if (req.files && req.files.length > 0) {
    momentData.images = req.files.map(file => file.location);
  }

  // Handle location if provided
  if (location && location.coordinates) {
    momentData.location = {
      type: 'Point',
      coordinates: location.coordinates,
      formattedAddress: location.formattedAddress,
      street: location.street,
      city: location.city,
      state: location.state,
      zipcode: location.zipcode,
      country: location.country
    };
  }

  const moment = await Moment.create(momentData);

  // Increment moment count after successful creation
  await user.incrementMomentCount();

  // Populate user for response
  await moment.populate('user', USER_FIELDS);
  const userWithImages = processUserImages(moment.user, req);
  const momentWithImages = processMomentImages(moment, req);

  res.status(201).json({
    success: true,
    data: {
      ...momentWithImages,
      user: userWithImages
    }
  });
});

/**
 * @desc    Update moment
 * @route   PUT /api/v1/moments/:id
 * @access  Private
 */
exports.updateMoment = asyncHandler(async (req, res, next) => {
  let moment = await Moment.findById(req.params.id);

  if (!moment) {
    return next(new ErrorResponse('Moment not found', 404));
  }

  // Check ownership
  if (moment.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized to update this moment', 403));
  }

  // Prepare update data (exclude user field for security)
  const { user, images, ...updateData } = req.body;

  // Handle location update
  if (updateData.location && updateData.location.coordinates) {
    updateData.location = {
      type: 'Point',
      coordinates: updateData.location.coordinates,
      formattedAddress: updateData.location.formattedAddress,
      street: updateData.location.street,
      city: updateData.location.city,
      state: updateData.location.state,
      zipcode: updateData.location.zipcode,
      country: updateData.location.country
    };
  }

  // Update moment
  moment = await Moment.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  await moment.populate('user', USER_FIELDS);
  const userWithImages = processUserImages(moment.user, req);
  const momentWithImages = processMomentImages(moment, req);

  res.status(200).json({
    success: true,
    data: {
      ...momentWithImages,
      user: userWithImages
    }
  });
});

/**
 * @desc    Delete moment
 * @route   DELETE /api/v1/moments/:id
 * @access  Private
 */
exports.deleteMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findById(req.params.id);

  if (!moment) {
    return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
  }

  // Check ownership
  if (moment.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized to delete this moment', 403));
  }

  // Delete associated images from Spaces
  if (moment.images && moment.images.length > 0) {
    console.log(`🗑️ Deleting ${moment.images.length} images from Spaces`);
    // Delete images asynchronously (don't block response)
    moment.images.forEach(async (imageUrl) => {
      try {
        await deleteFromSpaces(imageUrl);
      } catch (err) {
        console.error(`Failed to delete image ${imageUrl}:`, err.message);
      }
    });
  }

  await moment.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
    message: 'Moment deleted successfully'
  });
});

/**
 * @desc    Upload photos to moment
 * @route   PUT /api/v1/moments/:id/photo
 * @access  Private
 */
exports.momentPhotoUpload = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findById(req.params.id);

  if (!moment) {
    return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
  }

  // Check ownership
  if (moment.user.toString() !== req.user._id.toString()) {
    return next(new ErrorResponse('Not authorized to upload photos to this moment', 403));
  }

  // Validate file upload - from multer-s3
  if (!req.files || req.files.length === 0) {
    return next(new ErrorResponse('Please upload at least one file', 400));
  }

  // Limit number of images per moment (max 10)
  const maxImages = 10;
  if (moment.images.length + req.files.length > maxImages) {
    // Delete the just-uploaded files from Spaces since we're rejecting the request
    const { deleteMultipleFromSpaces } = require('../utils/deleteFromSpaces');
    const uploadedUrls = req.files.map(file => file.location);
    await deleteMultipleFromSpaces(uploadedUrls);
    
    return next(new ErrorResponse(`Maximum ${maxImages} images allowed per moment`, 400));
  }

  // Get CDN URLs from multer-s3 uploaded files
  const newImageUrls = req.files.map(file => file.location);

  // Update moment with new images (now full CDN URLs)
  moment.images = [...moment.images, ...newImageUrls];
  await moment.save();

  // KEEP EXACT RESPONSE FORMAT
  res.status(200).json({
    success: true,
    data: {
      _id: moment._id,
      images: moment.images,
      imageUrls: moment.images // Same as images now (already full URLs)
    }
  });
});

/**
 * @desc    Like a moment
 * @route   POST /api/v1/moments/:id/like
 * @access  Private
 */
exports.likeMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findById(req.params.id);

  if (!moment) {
    return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
  }

  const userId = req.user._id.toString();

  // Check if already liked
  if (moment.likedUsers && moment.likedUsers.some(id => id.toString() === userId)) {
    return res.status(200).json({
      success: true,
      message: 'Already liked',
      data: {
        _id: moment._id,
        likeCount: moment.likeCount,
        isLiked: true
      }
    });
  }

  // Add like
  moment.likedUsers = moment.likedUsers || [];
  moment.likedUsers.push(userId);
  moment.likeCount = Math.max(0, (moment.likeCount || 0) + 1);
  await moment.save();

  res.status(200).json({
    success: true,
    data: {
      _id: moment._id,
      likeCount: moment.likeCount,
      isLiked: true
    }
  });
});

/**
 * @desc    Dislike (unlike) a moment
 * @route   POST /api/v1/moments/:id/dislike
 * @access  Private
 */
exports.dislikeMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findById(req.params.id);

  if (!moment) {
    return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
  }

  const userId = req.user._id.toString();

  // Remove like
  moment.likedUsers = (moment.likedUsers || []).filter(id => id.toString() !== userId);
  moment.likeCount = Math.max(0, (moment.likeCount || 0) - 1);
  await moment.save();

  res.status(200).json({
    success: true,
    data: {
      _id: moment._id,
      likeCount: moment.likeCount,
      isLiked: false
    }
  });
});