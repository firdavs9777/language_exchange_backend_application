const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const ErrorResponse = require('../utils/errorResponse');
const notificationService = require('../services/notificationService');
const templates = require('../utils/notificationTemplates');

/**
 * @desc    Register FCM token
 * @route   POST /api/v1/notifications/register-token
 * @access  Private
 */
exports.registerToken = asyncHandler(async (req, res, next) => {
  const { token, platform, deviceId } = req.body;
  const userId = req.user.id;

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check if device already exists
  const existingTokenIndex = user.fcmTokens.findIndex(
    t => t.deviceId === deviceId
  );

  if (existingTokenIndex !== -1) {
    // Update existing token
    user.fcmTokens[existingTokenIndex].token = token;
    user.fcmTokens[existingTokenIndex].platform = platform;
    user.fcmTokens[existingTokenIndex].lastUpdated = new Date();
    user.fcmTokens[existingTokenIndex].active = true;
  } else {
    // Add new token
    user.fcmTokens.push({
      token,
      platform,
      deviceId,
      lastUpdated: new Date(),
      active: true
    });
  }

  await user.save();

  console.log(`✅ Registered FCM token for user ${userId}, device ${deviceId}`);

  res.status(200).json({
    success: true,
    message: 'FCM token registered successfully',
    data: {
      deviceId,
      platform
    }
  });
});

/**
 * @desc    Remove FCM token
 * @route   DELETE /api/v1/notifications/remove-token/:deviceId
 * @access  Public (can be called during/after logout)
 */
exports.removeToken = asyncHandler(async (req, res, next) => {
  const { deviceId } = req.params;

  // Try to find user by authenticated session first
  let user;
  if (req.user && req.user.id) {
    // Authenticated request
    user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: {
          fcmTokens: { deviceId }
        }
      },
      { new: true }
    );
  } else {
    // Unauthenticated request (e.g., after logout)
    // Find any user with this deviceId and remove it
    user = await User.findOneAndUpdate(
      { 'fcmTokens.deviceId': deviceId },
      {
        $pull: {
          fcmTokens: { deviceId }
        }
      },
      { new: true }
    );
  }

  if (!user) {
    // Token not found, but that's okay (might have been already removed)
    console.log(`⚠️  No token found for device ${deviceId}`);
    return res.status(200).json({
      success: true,
      message: 'FCM token removal processed'
    });
  }

  console.log(`✅ Removed FCM token for user ${user._id}, device ${deviceId}`);

  res.status(200).json({
    success: true,
    message: 'FCM token removed successfully'
  });
});

/**
 * @desc    Get notification settings
 * @route   GET /api/v1/notifications/settings
 * @access  Private
 */
exports.getSettings = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user.notificationSettings
  });
});

/**
 * @desc    Update notification settings
 * @route   PUT /api/v1/notifications/settings
 * @access  Private
 */
exports.updateSettings = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const settings = req.body;

  // Build update object
  const updateFields = {};
  const allowedFields = [
    'enabled', 'chatMessages', 'moments', 'followerMoments', 'friendRequests',
    'profileVisits', 'marketing', 'sound', 'vibration', 'showPreview'
  ];

  allowedFields.forEach(field => {
    if (settings[field] !== undefined) {
      updateFields[`notificationSettings.${field}`] = settings[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateFields },
    { new: true, runValidators: false }
  );

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  console.log(`✅ Updated notification settings for user ${userId}`);

  res.status(200).json({
    success: true,
    message: 'Notification settings updated successfully',
    data: user.notificationSettings
  });
});

/**
 * @desc    Mute conversation
 * @route   POST /api/v1/notifications/mute-chat/:conversationId
 * @access  Private
 */
exports.muteChat = asyncHandler(async (req, res, next) => {
  const { conversationId } = req.params;
  const userId = req.user.id;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $addToSet: {
        'notificationSettings.mutedChats': conversationId
      }
    },
    { new: true }
  );

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  console.log(`✅ Muted conversation ${conversationId} for user ${userId}`);

  res.status(200).json({
    success: true,
    message: 'Conversation muted successfully',
    data: {
      mutedChats: user.notificationSettings.mutedChats
    }
  });
});

/**
 * @desc    Unmute conversation
 * @route   POST /api/v1/notifications/unmute-chat/:conversationId
 * @access  Private
 */
exports.unmuteChat = asyncHandler(async (req, res, next) => {
  const { conversationId } = req.params;
  const userId = req.user.id;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $pull: {
        'notificationSettings.mutedChats': conversationId
      }
    },
    { new: true }
  );

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  console.log(`✅ Unmuted conversation ${conversationId} for user ${userId}`);

  res.status(200).json({
    success: true,
    message: 'Conversation unmuted successfully',
    data: {
      mutedChats: user.notificationSettings.mutedChats
    }
  });
});

/**
 * @desc    Get notification history
 * @route   GET /api/v1/notifications/history
 * @access  Private
 */
exports.getHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ userId })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId })
  ]);

  res.status(200).json({
    success: true,
    data: {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * @desc    Mark notification as read
 * @route   POST /api/v1/notifications/mark-read/:notificationId
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res, next) => {
  const { notificationId } = req.params;
  const userId = req.user.id;

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return next(new ErrorResponse('Notification not found', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
});

/**
 * @desc    Mark all notifications as read
 * @route   POST /api/v1/notifications/mark-all-read
 * @access  Private
 */
exports.markAllAsRead = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const result = await Notification.updateMany(
    { userId, read: false },
    { read: true }
  );

  // Reset notification badge
  await User.findByIdAndUpdate(userId, {
    'badges.unreadNotifications': 0
  });

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    data: {
      updated: result.modifiedCount
    }
  });
});

/**
 * @desc    Clear all notifications
 * @route   DELETE /api/v1/notifications/clear-all
 * @access  Private
 */
exports.clearAll = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const result = await Notification.deleteMany({ userId });

  // Reset notification badge
  await User.findByIdAndUpdate(userId, {
    'badges.unreadNotifications': 0
  });

  res.status(200).json({
    success: true,
    message: 'All notifications cleared',
    data: {
      deleted: result.deletedCount
    }
  });
});

/**
 * @desc    Get badge count
 * @route   GET /api/v1/notifications/badge-count
 * @access  Private
 */
exports.getBadgeCount = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      unreadMessages: user.badges.unreadMessages || 0,
      unreadNotifications: user.badges.unreadNotifications || 0,
      total: (user.badges.unreadMessages || 0) + (user.badges.unreadNotifications || 0)
    }
  });
});

/**
 * @desc    Reset badge count
 * @route   POST /api/v1/notifications/reset-badge
 * @access  Private
 */
exports.resetBadge = asyncHandler(async (req, res, next) => {
  const { type } = req.body;
  const userId = req.user.id;

  const updateField = type === 'messages' 
    ? 'badges.unreadMessages' 
    : 'badges.unreadNotifications';

  const user = await User.findByIdAndUpdate(
    userId,
    { [updateField]: 0 },
    { new: true }
  );

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    message: `${type} badge reset successfully`,
    data: {
      unreadMessages: user.badges.unreadMessages || 0,
      unreadNotifications: user.badges.unreadNotifications || 0
    }
  });
});

/**
 * @desc    Sync/recalculate badge counts from actual data
 * @route   POST /api/v1/notifications/sync-badges
 * @access  Private
 */
exports.syncBadges = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  // Count actual unread messages (messages sent TO this user that are unread)
  const unreadMessagesCount = await Message.countDocuments({
    receiver: userId,
    read: false
  });

  // Count actual unread notifications
  const unreadNotificationsCount = await Notification.countDocuments({
    userId: userId,
    read: false
  });

  // Update user's badge counts to match reality
  const user = await User.findByIdAndUpdate(
    userId,
    {
      'badges.unreadMessages': unreadMessagesCount,
      'badges.unreadNotifications': unreadNotificationsCount
    },
    { new: true }
  );

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  console.log(`📊 Badge sync for ${userId}: messages=${unreadMessagesCount}, notifications=${unreadNotificationsCount}`);

  res.status(200).json({
    success: true,
    message: 'Badge counts synced successfully',
    data: {
      unreadMessages: unreadMessagesCount,
      unreadNotifications: unreadNotificationsCount,
      total: unreadMessagesCount + unreadNotificationsCount
    }
  });
});

/**
 * @desc    Send test notification
 * @route   POST /api/v1/notifications/test
 * @access  Private
 */
exports.sendTestNotification = asyncHandler(async (req, res, next) => {
  const { userId, type } = req.body;
  const targetUserId = userId || req.user.id;

  // Generate test notification based on type
  let notification;
  
  switch (type) {
    case 'chat_message':
      notification = templates.getChatMessageTemplate(
        'Test User',
        'This is a test message from BanaTalk!',
        { senderId: targetUserId, conversationId: 'test', messageId: 'test' }
      );
      break;
    
    case 'moment_like':
      notification = templates.getMomentLikeTemplate(
        'Test User',
        'This is a test moment',
        { userId: targetUserId, momentId: 'test' }
      );
      break;
    
    case 'moment_comment':
      notification = templates.getMomentCommentTemplate(
        'Test User',
        'This is a test comment!',
        { userId: targetUserId, momentId: 'test', commentId: 'test' }
      );
      break;
    
    case 'friend_request':
      notification = templates.getFriendRequestTemplate(
        'Test User',
        { userId: targetUserId }
      );
      break;
    
    case 'profile_visit':
      notification = templates.getProfileVisitTemplate(
        'Test User',
        { userId: targetUserId }
      );
      break;
    
    default:
      notification = templates.getSystemTemplate(
        'Test Notification',
        'This is a test notification from BanaTalk!'
      );
  }

  const result = await notificationService.send(
    targetUserId,
    type || 'system',
    notification
  );

  if (!result.success) {
    return next(new ErrorResponse(result.error || 'Failed to send test notification', 500));
  }

  res.status(200).json({
    success: true,
    message: 'Test notification sent successfully',
    data: result
  });
});

