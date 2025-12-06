const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Block a user
 * @route   POST /api/v1/users/:userId/block
 * @access  Private
 */
exports.blockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const currentUserId = req.user._id;

  // Can't block yourself
  if (userId === currentUserId.toString()) {
    return next(new ErrorResponse('Cannot block yourself', 400));
  }

  // Get current user
  const user = await User.findById(currentUserId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check if target user exists
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    return next(new ErrorResponse('User to block not found', 404));
  }

  // Check if already blocked
  if (user.isBlocked(userId)) {
    return res.status(200).json({
      success: true,
      message: 'User is already blocked',
      data: {
        blockedUserId: userId,
        blockedAt: user.blockedUsers.find(b => b.userId.toString() === userId)?.blockedAt
      }
    });
  }

  // Block the user
  await user.blockUser(userId, reason);

  // Add to target user's blockedBy array
  if (!targetUser.blockedBy.some(b => b.userId.toString() === currentUserId.toString())) {
    targetUser.blockedBy.push({
      userId: currentUserId,
      blockedAt: new Date()
    });
    await targetUser.save();
  }

  res.status(200).json({
    success: true,
    message: 'User blocked successfully',
    data: {
      blockedUserId: userId,
      blockedAt: user.blockedUsers.find(b => b.userId.toString() === userId)?.blockedAt
    }
  });
});

/**
 * @desc    Unblock a user
 * @route   DELETE /api/v1/users/:userId/block
 * @access  Private
 */
exports.unblockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  // Get current user
  const user = await User.findById(currentUserId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check if user is blocked
  if (!user.isBlocked(userId)) {
    return next(new ErrorResponse('User is not blocked', 400));
  }

  // Unblock the user
  await user.unblockUser(userId);

  // Remove from target user's blockedBy array
  const targetUser = await User.findById(userId);
  if (targetUser) {
    targetUser.blockedBy = targetUser.blockedBy.filter(
      b => b.userId.toString() !== currentUserId.toString()
    );
    await targetUser.save();
  }

  res.status(200).json({
    success: true,
    message: 'User unblocked successfully',
    data: {
      unblockedUserId: userId
    }
  });
});

/**
 * @desc    Get blocked users list
 * @route   GET /api/v1/users/:userId/blocked
 * @access  Private
 */
exports.getBlockedUsers = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  // Users can only view their own blocked list
  if (userId !== currentUserId.toString()) {
    return next(new ErrorResponse('Not authorized to view this user\'s blocked list', 403));
  }

  const user = await User.findById(userId)
    .populate('blockedUsers.userId', 'name email images bio');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const blockedUsers = user.blockedUsers.map(block => ({
    userId: block.userId._id,
    user: block.userId,
    blockedAt: block.blockedAt,
    reason: block.reason
  }));

  res.status(200).json({
    success: true,
    count: blockedUsers.length,
    data: blockedUsers
  });
});

/**
 * @desc    Check block status between two users
 * @route   GET /api/v1/users/:userId/block-status/:targetUserId
 * @access  Private
 */
exports.checkBlockStatus = asyncHandler(async (req, res, next) => {
  const { userId, targetUserId } = req.params;
  const currentUserId = req.user._id;

  // Users can only check their own block status
  if (userId !== currentUserId.toString()) {
    return next(new ErrorResponse('Not authorized', 403));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const isBlocked = user.isBlocked(targetUserId);
  const isBlockedBy = user.isBlockedBy(targetUserId);

  res.status(200).json({
    success: true,
    data: {
      isBlocked: isBlocked,
      isBlockedBy: isBlockedBy,
      canMessage: !isBlocked && !isBlockedBy
    }
  });
});

