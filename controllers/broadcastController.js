/**
 * Broadcast Notification Controller
 *
 * Admin-only endpoint to send announcements to all users
 */

const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const fcmService = require('../services/fcmService');
const AdminAuditLog = require('../models/AdminAuditLog');

/**
 * @desc    Send broadcast notification to all users
 * @route   POST /api/v1/admin/broadcast
 * @access  Admin only
 * @body    { title, body, imageUrl? }
 */
exports.sendBroadcast = asyncHandler(async (req, res, next) => {
  // Admin only
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to send broadcasts', 403));
  }

  const { title, body, imageUrl } = req.body;

  // Validate input
  if (!title || !body) {
    return next(new ErrorResponse('Title and body are required', 400));
  }

  if (title.length > 100) {
    return next(new ErrorResponse('Title must be 100 characters or less', 400));
  }

  if (body.length > 500) {
    return next(new ErrorResponse('Body must be 500 characters or less', 400));
  }

  try {
    console.log(`\n📢 Broadcasting: "${title}" - "${body}"\n`);

    // Get all users with active FCM tokens
    const users = await User.find({
      'fcmTokens': { $exists: true, $ne: [] },
      'fcmTokens.active': true
    }).select('_id').lean();

    const activeUsers = users.filter(u => u.fcmTokens && u.fcmTokens.some(t => t.active));

    if (activeUsers.length === 0) {
      return next(new ErrorResponse('No users with active FCM tokens', 400));
    }

    // Prepare notification
    const notification = {
      title: title,
      body: body
    };

    if (imageUrl) {
      notification.imageUrl = imageUrl;
    }

    const data = {
      type: 'system_broadcast',
      timestamp: new Date().toISOString(),
      broadcastId: `broadcast_${Date.now()}`
    };

    // Send to all users
    const startTime = Date.now();
    const result = await fcmService.sendToUsers(
      activeUsers.map(u => u._id),
      notification,
      data
    );
    const duration = (Date.now() - startTime) / 1000;

    // Log the broadcast action
    if (AdminAuditLog) {
      await AdminAuditLog.create({
        admin: req.user._id,
        action: 'broadcast_notification',
        details: {
          title,
          body,
          usersTargeted: activeUsers.length,
          devicesReached: result.delivered,
          failed: result.failed
        },
        timestamp: new Date()
      });
    }

    // Calculate success rate
    const totalDevices = result.delivered + result.failed;
    const successRate = totalDevices > 0
      ? ((result.delivered / totalDevices) * 100).toFixed(1)
      : '0';

    const response = {
      success: true,
      message: 'Broadcast notification sent successfully',
      stats: {
        usersTargeted: activeUsers.length,
        devicesReached: result.delivered,
        failed: result.failed,
        errored: result.errored,
        successRate: `${successRate}%`,
        timeTaken: `${duration.toFixed(2)}s`
      }
    };

    console.log(`✅ Broadcast sent to ${result.delivered} devices in ${duration.toFixed(2)}s\n`);

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Broadcast error:', error);
    return next(new ErrorResponse(`Failed to send broadcast: ${error.message}`, 500));
  }
});

/**
 * @desc    Get broadcast statistics/history
 * @route   GET /api/v1/admin/broadcast/stats
 * @access  Admin only
 */
exports.getBroadcastStats = asyncHandler(async (req, res, next) => {
  // Admin only
  if (req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized', 403));
  }

  try {
    // Get users with active tokens
    const usersWithTokens = await User.countDocuments({
      'fcmTokens': { $exists: true, $ne: [] },
      'fcmTokens.active': true
    });

    // Get total active devices
    const usersData = await User.aggregate([
      {
        $match: { 'fcmTokens.active': true }
      },
      {
        $project: {
          activeTokenCount: {
            $size: {
              $filter: {
                input: '$fcmTokens',
                as: 'token',
                cond: { $eq: ['$$token.active', true] }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalDevices: { $sum: '$activeTokenCount' }
        }
      }
    ]);

    const totalDevices = usersData[0]?.totalDevices || 0;

    res.status(200).json({
      success: true,
      stats: {
        usersWithActiveTokens: usersWithTokens,
        totalActiveDevices: totalDevices,
        averageDevicesPerUser: usersWithTokens > 0 ? (totalDevices / usersWithTokens).toFixed(1) : 0
      }
    });
  } catch (error) {
    return next(new ErrorResponse(`Failed to get stats: ${error.message}`, 500));
  }
});
