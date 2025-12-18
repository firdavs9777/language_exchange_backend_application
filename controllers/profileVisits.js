const asyncHandler = require('../middleware/async');
const ProfileVisit = require('../models/ProfileVisit');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const notificationService = require('../services/notificationService');

/**
 * @desc    Record a profile visit
 * @route   POST /api/v1/users/:userId/profile-visit
 * @access  Private
 */
exports.recordProfileVisit = asyncHandler(async (req, res, next) => {
  const profileOwnerId = req.params.userId;
  const visitorId = req.user.id;
  const { source, deviceType } = req.body;

  // Don't record if visiting own profile
  if (profileOwnerId === visitorId) {
    return res.status(200).json({
      success: true,
      message: 'Own profile visit not recorded'
    });
  }

  // Check if profile owner exists
  const profileOwner = await User.findById(profileOwnerId);
  if (!profileOwner) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check if blocked
  const isBlocked = profileOwner.blockedUsers.some(
    block => block.userId.toString() === visitorId
  );
  if (isBlocked) {
    return res.status(200).json({
      success: true,
      message: 'Visit recorded'
    });
  }

  // Record the visit
  const visit = await ProfileVisit.recordVisit(profileOwnerId, visitorId, {
    source: source || 'other',
    deviceType: deviceType || 'ios',
    isAnonymous: false
  });

  // Update profile owner's stats
  if (visit) {
    const uniqueCount = await ProfileVisit.getUniqueVisitorCount(profileOwnerId);
    const totalCount = await ProfileVisit.countDocuments({ profileOwner: profileOwnerId });

    await User.findByIdAndUpdate(profileOwnerId, {
      'profileStats.uniqueVisitors': uniqueCount,
      'profileStats.totalVisits': totalCount,
      'profileStats.lastVisitorUpdate': new Date()
    });

    // Send notification if profile owner is VIP and has notifications enabled
    if (profileOwner.isVIP && profileOwner.isVIP()) {
      notificationService.sendProfileVisit(
        profileOwnerId,
        visitorId
      ).catch(err => console.error('Profile visit notification failed:', err));
    }
  }

  res.status(200).json({
    success: true,
    message: 'Profile visit recorded',
    data: {
      recorded: !!visit
    }
  });
});

/**
 * @desc    Get profile visitors list
 * @route   GET /api/v1/users/:userId/visitors
 * @access  Private
 */
exports.getProfileVisitors = asyncHandler(async (req, res, next) => {
  const profileOwnerId = req.params.userId;
  const requesterId = req.user.id;

  // Only the profile owner can see their visitors
  if (profileOwnerId !== requesterId) {
    return next(new ErrorResponse('Not authorized to view this data', 403));
  }

  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  // Get recent visitors with details
  const visitors = await ProfileVisit.getRecentVisitors(profileOwnerId, limit + skip);
  const paginatedVisitors = visitors.slice(skip, skip + limit);

  // Get visit stats
  const stats = await ProfileVisit.getVisitStats(profileOwnerId);

  res.status(200).json({
    success: true,
    count: paginatedVisitors.length,
    stats: stats,
    data: paginatedVisitors.map(visitor => ({
      user: {
        _id: visitor._id,
        name: visitor.visitorInfo.name,
        photo: visitor.visitorInfo.photo,
        gender: visitor.visitorInfo.gender,
        city: visitor.visitorInfo.city,
        country: visitor.visitorInfo.country,
        isVIP: visitor.visitorInfo.isVIP,
        nativeLanguage: visitor.visitorInfo.nativeLanguage
      },
      lastVisit: visitor.lastVisit,
      visitCount: visitor.visitCount,
      source: visitor.source
    }))
  });
});

/**
 * @desc    Get my profile visitor stats
 * @route   GET /api/v1/users/me/visitor-stats
 * @access  Private
 */
exports.getMyVisitorStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const stats = await ProfileVisit.getVisitStats(userId);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Clear profile visit history
 * @route   DELETE /api/v1/users/me/visitors
 * @access  Private
 */
exports.clearVisitHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  await ProfileVisit.deleteMany({ profileOwner: userId });

  // Reset stats
  await User.findByIdAndUpdate(userId, {
    'profileStats.uniqueVisitors': 0,
    'profileStats.totalVisits': 0,
    'profileStats.lastVisitorUpdate': new Date()
  });

  res.status(200).json({
    success: true,
    message: 'Visit history cleared'
  });
});

/**
 * @desc    Get who I've visited
 * @route   GET /api/v1/users/me/visited-profiles
 * @access  Private
 */
exports.getMyVisitedProfiles = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 20;

  const visits = await ProfileVisit.find({ visitor: userId })
    .sort({ visitedAt: -1 })
    .limit(limit)
    .populate('profileOwner', 'name photo gender city country isVIP nativeLanguage');

  res.status(200).json({
    success: true,
    count: visits.length,
    data: visits.map(visit => ({
      user: {
        _id: visit.profileOwner._id,
        name: visit.profileOwner.name,
        photo: visit.profileOwner.photo,
        gender: visit.profileOwner.gender,
        city: visit.profileOwner.city,
        country: visit.profileOwner.country,
        isVIP: visit.profileOwner.isVIP,
        nativeLanguage: visit.profileOwner.nativeLanguage
      },
      visitedAt: visit.visitedAt,
      source: visit.source
    }))
  });
});

