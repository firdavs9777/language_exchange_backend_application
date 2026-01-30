const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Wave = require('../models/Wave');
const Topic = require('../models/Topic');

// ============================================
// NEARBY USERS
// ============================================

/**
 * @desc    Get nearby users based on location
 * @route   GET /api/v1/community/nearby
 * @access  Private
 */
exports.getNearbyUsers = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  // Parse query parameters
  const {
    latitude,
    longitude,
    radius = 50, // Default 50km
    limit = 50,
    offset = 0,
    language,
    minAge,
    maxAge,
    gender,
    onlineOnly
  } = req.query;

  // Validate coordinates
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return next(new ErrorResponse('Valid latitude and longitude are required', 400));
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return next(new ErrorResponse('Invalid coordinates', 400));
  }

  // Convert radius to meters (MongoDB uses meters)
  const radiusInMeters = Math.min(Math.max(parseFloat(radius) || 50, 1), 500) * 1000;
  const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
  const offsetNum = Math.max(parseInt(offset) || 0, 0);

  // Get current user for blocking check
  const currentUser = await User.findById(userId).select('blockedUsers blockedBy');
  const blockedUserIds = [
    ...(currentUser?.blockedUsers || []),
    ...(currentUser?.blockedBy || [])
  ].map(id => id.toString());

  // Build match criteria
  const matchCriteria = {
    _id: { $ne: userId, $nin: blockedUserIds.map(id => require('mongoose').Types.ObjectId(id)) },
    'location.coordinates': { $exists: true, $ne: [0, 0] }
  };

  // Language filter
  if (language) {
    matchCriteria.$or = [
      { native_language: language },
      { language_to_learn: language }
    ];
  }

  // Gender filter
  if (gender && ['male', 'female', 'other'].includes(gender)) {
    matchCriteria.gender = gender;
  }

  // Age filter (calculate from birth_year)
  const currentYear = new Date().getFullYear();
  if (minAge || maxAge) {
    matchCriteria.birth_year = {};
    if (minAge) {
      matchCriteria.birth_year.$lte = String(currentYear - parseInt(minAge));
    }
    if (maxAge) {
      matchCriteria.birth_year.$gte = String(currentYear - parseInt(maxAge));
    }
  }

  // Build aggregation pipeline
  const pipeline = [
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        distanceField: 'distance',
        maxDistance: radiusInMeters,
        spherical: true,
        query: matchCriteria
      }
    },
    // Convert distance to kilometers
    {
      $addFields: {
        distance: { $divide: ['$distance', 1000] }
      }
    }
  ];

  // Online only filter (check if user has recent socket activity)
  if (onlineOnly === 'true') {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    pipeline.push({
      $match: { lastActive: { $gte: fiveMinutesAgo } }
    });
  }

  // Get total count before pagination
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await User.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Add pagination
  pipeline.push(
    { $skip: offsetNum },
    { $limit: limitNum }
  );

  // Project only needed fields
  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      images: 1,
      location: {
        type: '$location.type',
        coordinates: '$location.coordinates',
        city: '$location.city',
        country: '$location.country'
      },
      distance: { $round: ['$distance', 2] },
      native_language: 1,
      language_to_learn: 1,
      gender: 1,
      bio: 1,
      isOnline: {
        $cond: {
          if: { $gte: ['$lastActive', new Date(Date.now() - 5 * 60 * 1000)] },
          then: true,
          else: false
        }
      },
      lastSeen: '$lastActive',
      level: 1,
      topics: 1
    }
  });

  const users = await User.aggregate(pipeline);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + users.length < total
    }
  });
});

// ============================================
// WAVES
// ============================================

/**
 * @desc    Send a wave to another user
 * @route   POST /api/v1/community/wave
 * @access  Private
 */
exports.sendWave = asyncHandler(async (req, res, next) => {
  const fromUserId = req.user.id;
  const { targetUserId, message } = req.body;

  if (!targetUserId) {
    return next(new ErrorResponse('Target user ID is required', 400));
  }

  if (fromUserId === targetUserId) {
    return next(new ErrorResponse('Cannot wave at yourself', 400));
  }

  // Check if target user exists
  const targetUser = await User.findById(targetUserId).select('_id blockedUsers');
  if (!targetUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check if current user is blocked by target
  if (targetUser.blockedUsers?.includes(fromUserId)) {
    return next(new ErrorResponse('Cannot wave to this user', 403));
  }

  // Check for existing recent wave (prevent spam)
  const recentWave = await Wave.findOne({
    from: fromUserId,
    to: targetUserId,
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  if (recentWave) {
    return next(new ErrorResponse('You already waved at this user recently', 429));
  }

  // Create wave
  const wave = await Wave.create({
    from: fromUserId,
    to: targetUserId,
    message: message?.substring(0, 100)
  });

  // Check if mutual wave exists
  const isMutual = await Wave.checkMutualWave(fromUserId, targetUserId);

  // TODO: Send push notification to target user

  res.status(201).json({
    success: true,
    data: {
      waveId: wave._id,
      isMutual,
      message: isMutual ? 'It\'s a match! You both waved at each other.' : 'Wave sent!'
    }
  });
});

/**
 * @desc    Get waves received by current user
 * @route   GET /api/v1/community/waves
 * @access  Private
 */
exports.getWaves = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { page = 1, limit = 20, unreadOnly } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(Math.max(1, parseInt(limit)), 50);
  const skip = (pageNum - 1) * limitNum;

  const filter = { to: userId };
  if (unreadOnly === 'true') {
    filter.isRead = false;
  }

  const [waves, total, unreadCount] = await Promise.all([
    Wave.find(filter)
      .populate('from', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Wave.countDocuments(filter),
    Wave.getUnreadCount(userId)
  ]);

  res.status(200).json({
    success: true,
    data: {
      waves: waves.map(w => ({
        waveId: w._id,
        from: w.from,
        message: w.message,
        createdAt: w.createdAt,
        isRead: w.isRead
      })),
      unreadCount
    },
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: skip + waves.length < total
    }
  });
});

/**
 * @desc    Mark waves as read
 * @route   PUT /api/v1/community/waves/read
 * @access  Private
 */
exports.markWavesAsRead = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { waveIds } = req.body;

  await Wave.markAsRead(userId, waveIds);

  res.status(200).json({
    success: true,
    message: 'Waves marked as read'
  });
});

// ============================================
// TOPICS
// ============================================

/**
 * @desc    Get all community topics
 * @route   GET /api/v1/community/topics
 * @access  Private
 */
exports.getTopics = asyncHandler(async (req, res, next) => {
  const { category, lang = 'en' } = req.query;

  const filter = { isActive: true };
  if (category) {
    filter.category = category;
  }

  const topics = await Topic.find(filter)
    .sort({ order: 1 })
    .lean();

  // Add localized names
  const localizedTopics = topics.map(topic => ({
    id: topic.topicId,
    name: topic.localizedNames?.[lang] || topic.name,
    icon: topic.icon,
    category: topic.category,
    color: topic.color,
    userCount: topic.userCount
  }));

  res.status(200).json({
    success: true,
    data: localizedTopics
  });
});

/**
 * @desc    Get users interested in a topic
 * @route   GET /api/v1/community/topics/:topicId/users
 * @access  Private
 */
exports.getTopicUsers = asyncHandler(async (req, res, next) => {
  const { topicId } = req.params;
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(Math.max(1, parseInt(limit)), 50);
  const skip = (pageNum - 1) * limitNum;

  // Get current user for blocking check
  const currentUser = await User.findById(userId).select('blockedUsers blockedBy');
  const blockedUserIds = [
    ...(currentUser?.blockedUsers || []),
    ...(currentUser?.blockedBy || [])
  ].map(id => id.toString());

  const filter = {
    _id: { $ne: userId },
    topics: topicId
  };

  // Exclude blocked users
  if (blockedUserIds.length > 0) {
    filter._id.$nin = blockedUserIds;
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name images native_language language_to_learn level lastActive location.city location.country')
      .sort({ lastActive: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter)
  ]);

  const usersWithOnlineStatus = users.map(user => ({
    ...user,
    isOnline: user.lastActive && (Date.now() - new Date(user.lastActive).getTime()) < 5 * 60 * 1000
  }));

  res.status(200).json({
    success: true,
    data: usersWithOnlineStatus,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: skip + users.length < total
    }
  });
});

/**
 * @desc    Update current user's topics
 * @route   PUT /api/v1/community/topics/my
 * @access  Private
 */
exports.updateMyTopics = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { topics } = req.body;

  if (!Array.isArray(topics)) {
    return next(new ErrorResponse('Topics must be an array', 400));
  }

  // Limit to 10 topics
  const validTopics = topics.slice(0, 10);

  // Get old topics for count update
  const user = await User.findById(userId).select('topics');
  const oldTopics = user?.topics || [];

  // Update user topics
  await User.findByIdAndUpdate(userId, { topics: validTopics });

  // Update topic user counts
  const removedTopics = oldTopics.filter(t => !validTopics.includes(t));
  const addedTopics = validTopics.filter(t => !oldTopics.includes(t));

  await Promise.all([
    ...removedTopics.map(topicId => Topic.incrementUserCount(topicId, -1)),
    ...addedTopics.map(topicId => Topic.incrementUserCount(topicId, 1))
  ]);

  res.status(200).json({
    success: true,
    data: { topics: validTopics }
  });
});

/**
 * @desc    Seed default topics (admin only)
 * @route   POST /api/v1/community/topics/seed
 * @access  Private/Admin
 */
exports.seedTopics = asyncHandler(async (req, res, next) => {
  await Topic.seedDefaults();

  res.status(200).json({
    success: true,
    message: 'Default topics seeded successfully'
  });
});
