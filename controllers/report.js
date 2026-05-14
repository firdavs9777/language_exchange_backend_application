const asyncHandler = require('../middleware/async');
const Report = require('../models/Report');
const User = require('../models/User');
const VoiceRoom = require('../models/VoiceRoom');
const ErrorResponse = require('../utils/errorResponse');
const { logSecurityEvent } = require('../utils/securityLogger');
const emailService = require('../services/emailService');
const livekitAdmin = require('../services/livekitAdminService');

/**
 * @desc    Create a new report
 * @route   POST /api/v1/reports
 * @access  Private
 */
exports.createReport = asyncHandler(async (req, res, next) => {
  const { type, reportId, reportedUser, reason, description } = req.body;

  // Validate required fields
  if (!type || !reportId || !reportedUser || !reason) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }
  

  // Check if user already reported this content
  const hasReported = await Report.hasUserReported(
    req.user.id,
    type,
    reportId
  );

  if (hasReported) {
    return next(new ErrorResponse('You have already reported this content. Please wait for moderation.', 400));
  }

  // Additional check: Try to find existing report (in case unique index doesn't catch it)
  const existingReport = await Report.findOne({
    reportedBy: req.user.id,
    type: type,
    reportId: reportId
  });

  if (existingReport) {
    return next(new ErrorResponse('You have already reported this content. Please wait for moderation.', 400));
  }

  // Create report
  let report;
  try {
    report = await Report.create({
      type,
      reportId,
      reportedBy: req.user.id,
      reportedUser,
      reason,
      description
    });
  } catch (error) {
    // Handle duplicate key error (from unique index)
    if (error.code === 11000 || error.name === 'MongoServerError') {
      return next(new ErrorResponse('You have already reported this content. Please wait for moderation.', 400));
    }
    throw error;
  }

  // Log security event
  logSecurityEvent('CONTENT_REPORTED', {
    reportId: report._id,
    type,
    reportedBy: req.user.id,
    reportedUser,
    reason
  });

  // Fire-and-forget admin alert. Step 14 — gated by
  // ADMIN_REPORT_ALERTS_ENABLED inside the helper.
  emailService.sendAdminReportAlert(report).catch(err =>
    console.error('Admin alert failed:', err.message)
  );

  res.status(201).json({
    success: true,
    message: 'Report submitted successfully. We will review it within 24 hours.',
    data: report
  });
});

/**
 * @desc    Get all reports (with filters)
 * @route   GET /api/v1/reports
 * @access  Admin
 */
exports.getAllReports = asyncHandler(async (req, res, next) => {
  const { status, type, priority } = req.query;

  // Build filter
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (priority) filter.priority = priority;

  // Richer populate for the admin reports screen — covers avatar, language
  // pair, country, joined date, and ban status so the moderator can make
  // an informed decision without round-tripping to a profile lookup.
  const USER_FIELDS = 'name email images imageUrls native_language language_to_learn location createdAt isBanned';

  const reports = await Report.find(filter)
    .populate('reportedBy', USER_FIELDS)
    .populate('reportedUser', USER_FIELDS)
    .populate('moderatedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    success: true,
    count: reports.length,
    data: reports
  });
});

/**
 * @desc    Get single report
 * @route   GET /api/v1/reports/:id
 * @access  Admin
 */
exports.getReport = asyncHandler(async (req, res, next) => {
  const USER_FIELDS = 'name email images imageUrls native_language language_to_learn location createdAt isBanned';
  const report = await Report.findById(req.params.id)
    .populate('reportedBy', USER_FIELDS)
    .populate('reportedUser', USER_FIELDS)
    .populate('moderatedBy', 'name email');

  if (!report) {
    return next(new ErrorResponse('Report not found', 404));
  }

  res.status(200).json({
    success: true,
    data: report
  });
});

/**
 * @desc    Get my reports (reports I submitted)
 * @route   GET /api/v1/reports/my-reports
 * @access  Private
 */
exports.getMyReports = asyncHandler(async (req, res, next) => {
  const reports = await Report.find({ reportedBy: req.user.id })
    .populate('reportedUser', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: reports.length,
    data: reports
  });
});

/**
 * @desc    Get reports about a specific user
 * @route   GET /api/v1/reports/user/:userId
 * @access  Admin
 */
exports.getReportsByUser = asyncHandler(async (req, res, next) => {
  const reports = await Report.getReportsByUser(req.params.userId);

  res.status(200).json({
    success: true,
    count: reports.length,
    data: reports
  });
});

/**
 * @desc    Get pending reports count
 * @route   GET /api/v1/reports/stats/pending
 * @access  Admin
 */
exports.getPendingCount = asyncHandler(async (req, res, next) => {
  const count = await Report.getPendingCount();

  res.status(200).json({
    success: true,
    data: {
      pendingReports: count
    }
  });
});

/**
 * @desc    Start reviewing a report
 * @route   PUT /api/v1/reports/:id/review
 * @access  Admin
 */
exports.startReview = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse('Report not found', 404));
  }

  if (report.status !== 'pending') {
    return next(new ErrorResponse('Report is already being reviewed or resolved', 400));
  }

  await report.startReview(req.user.id);

  logSecurityEvent('REPORT_REVIEW_STARTED', {
    reportId: report._id,
    moderatorId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Report marked as under review',
    data: report
  });
});

/**
 * @desc    Resolve a report
 * @route   PUT /api/v1/reports/:id/resolve
 * @access  Admin
 */
exports.resolveReport = asyncHandler(async (req, res, next) => {
  const { action, notes } = req.body;

  if (!action) {
    return next(new ErrorResponse('Please provide moderator action', 400));
  }

  const report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse('Report not found', 404));
  }

  await report.resolve(req.user.id, action, notes);

  // Take action based on moderator decision
  if (action === 'user_banned') {
    await User.findByIdAndUpdate(report.reportedUser, {
      isBanned: true,
      banReason: notes || `Banned following report ${report._id}`,
      bannedAt: new Date()
    });

    // Auto-end the banned user's active voice rooms. Mirrors the canonical
    // flow in controllers/voiceRooms.js#endVoiceRoom (room.end() +
    // livekitAdmin.endRoom() + socket emits to room channel + lobby) so
    // participants are evicted from LiveKit audio AND the listing updates.
    const activeRooms = await VoiceRoom.find({
      host: report.reportedUser,
      status: { $in: ['waiting', 'active'] },
    });
    const io = req.app.get('io');
    for (const room of activeRooms) {
      try {
        await room.end();
        await livekitAdmin.endRoom(String(room._id));
        if (io) {
          io.to(`voiceroom_${room._id}`).emit('voiceroom:ended', {
            roomId: String(room._id),
            endedBy: 'admin',
          });
          io.to('voicerooms:lobby').emit('voiceroom:ended', {
            roomId: String(room._id),
          });
        }
      } catch (err) {
        console.error(`[ban] failed to end room ${room._id}:`, err.message);
      }
    }

    // Clear FCM tokens so banned user stops getting push.
    await User.findByIdAndUpdate(report.reportedUser, {
      $set: { fcmTokens: [] }
    });

    // Send the banned user an email explaining the ban.
    emailService.sendBanNotification(report.reportedUser, notes).catch(err =>
      console.error('Ban notification failed:', err.message)
    );
  } else if (action === 'content_removed') {
    if (report.type === 'moment') {
      const Moment = require('../models/Moment');
      await Moment.findByIdAndDelete(report.reportId).catch(() => {});
    } else if (report.type === 'story') {
      const Story = require('../models/Story');
      await Story.findByIdAndDelete(report.reportId).catch(() => {});
    } else if (report.type === 'comment') {
      const Comment = require('../models/Comment');
      await Comment.findByIdAndDelete(report.reportId).catch(() => {});
    } else if (report.type === 'message') {
      const Message = require('../models/Message');
      await Message.findByIdAndUpdate(report.reportId, { deleted: true }).catch(() => {});
    }
    // No-op for type === 'profile' (handle via user_warned / user_banned instead).
  }

  // Notify the reporter that the report was reviewed (only on user-action
  // resolutions). no_violation + content_removed deliberately don't send,
  // to avoid leaking information about how the report was handled.
  if (['user_banned', 'user_suspended', 'user_warned'].includes(action)) {
    emailService.sendReportResolutionToReporter(report).catch(err =>
      console.error('Reporter notification failed:', err.message)
    );
  }

  logSecurityEvent('REPORT_RESOLVED', {
    reportId: report._id,
    moderatorId: req.user.id,
    action,
    reportedUser: report.reportedUser
  });

  res.status(200).json({
    success: true,
    message: 'Report resolved successfully',
    data: report
  });
});

/**
 * @desc    Dismiss a report (no violation found)
 * @route   PUT /api/v1/reports/:id/dismiss
 * @access  Admin
 */
exports.dismissReport = asyncHandler(async (req, res, next) => {
  const { notes } = req.body;

  const report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse('Report not found', 404));
  }

  report.status = 'dismissed';
  report.moderatedBy = req.user.id;
  report.moderatorAction = 'no_violation';
  report.moderatorNotes = notes || 'No violation found';
  report.reviewedAt = Date.now();
  report.resolvedAt = Date.now();
  await report.save();

  logSecurityEvent('REPORT_DISMISSED', {
    reportId: report._id,
    moderatorId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Report dismissed',
    data: report
  });
});

/**
 * @desc    Delete a report
 * @route   DELETE /api/v1/reports/:id
 * @access  Admin
 */
exports.deleteReport = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse('Report not found', 404));
  }

  await report.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Report deleted successfully',
    data: {}
  });
});

/**
 * @desc    Get report statistics
 * @route   GET /api/v1/reports/stats
 * @access  Admin
 */
exports.getReportStats = asyncHandler(async (req, res, next) => {
  const stats = await Report.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const reasonStats = await Report.aggregate([
    {
      $group: {
        _id: '$reason',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      byStatus: stats,
      byReason: reasonStats
    }
  });
});