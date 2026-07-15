const asyncHandler = require('../middleware/async');
const Report = require('../models/Report');
const User = require('../models/User');
const Moment = require('../models/Moment');
const ErrorResponse = require('../utils/errorResponse');
const { logSecurityEvent } = require('../utils/securityLogger');
const emailService = require('../services/emailService');
const banService = require('../services/banService');
const uploadToSpaces = require('../middleware/uploadToSpaces');
const { shouldAutoHide } = require('../lib/reelsFeed');

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

  // Reels auto-hide (spec C1, Workstream G): the Report collection is the
  // ONE authoritative store the admin panel reads (the per-moment
  // reports[] array is a separate, unrelated flow — see moments.js
  // reportMoment). Distinct-reporter dedup is already guaranteed by the
  // unique {reportedBy, type, reportId} index above, so this count is
  // always a distinct-reporter count. Non-blocking: a failure here must
  // never fail the report submission itself.
  if (type === 'moment') {
    try {
      const moment = await Moment.findById(reportId).select('isReel');
      if (moment && moment.isReel) {
        const reportCount = await Report.countDocuments({ type: 'moment', reportId });
        if (shouldAutoHide(reportCount)) {
          await Moment.updateOne({ _id: reportId }, { $set: { hiddenPendingReview: true } });
        }
      }
    } catch (err) {
      console.error('Reel auto-hide check failed (non-blocking):', err.message);
    }
  }

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
    // Step 15: delegate to banService so the side-effect implementation
    // stays in one place. source='report:<id>' surfaces in the audit log
    // so we can tell report-driven bans apart from manual /admin bans.
    await banService.banUser({
      userId: report.reportedUser,
      reason: notes || `Banned following report ${report._id}`,
      moderatorId: req.user.id,
      source: `report:${report._id}`,
      io: req.app.get('io'),
    });
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

  // Cleanup evidence files when report is resolved
  if (report.evidence && report.evidence.length > 0) {
    const fileKeys = report.evidence.map(e => e.key);
    // Fire-and-forget cleanup — failures logged, don't block response
    Promise.all(
      fileKeys.map(key => deleteFromSpaces(key).catch(err =>
        console.error(`Failed to delete evidence file ${key}:`, err.message)
      ))
    ).catch(() => {});
    // Clear evidence array after deletion
    report.evidence = [];
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
 * @desc    Restore a reel that was auto-hidden pending review (Workstream G).
 *          Clears hiddenPendingReview on the reported moment and resolves
 *          the report as no_violation, alongside the existing remove/ban
 *          actions (resolveReport).
 * @route   PUT /api/v1/reports/:id/restore
 * @access  Admin
 */
exports.restoreReport = asyncHandler(async (req, res, next) => {
  const { notes } = req.body;

  const report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse('Report not found', 404));
  }

  if (report.type === 'moment') {
    await Moment.updateOne({ _id: report.reportId }, { $set: { hiddenPendingReview: false } });
  }

  await report.resolve(req.user.id, 'no_violation', notes || 'Restored by admin');

  logSecurityEvent('REPORT_RESTORED', {
    reportId: report._id,
    moderatorId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Content restored',
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

/**
 * @desc    Upload evidence file for a report
 * @route   POST /api/v1/reports/:reportId/evidence
 * @access  Private
 */
exports.uploadEvidence = [
  uploadToSpaces.uploadSingle('file', 'reports'),
  async (req, res, next) => {
    try {
      // Validate report exists
      const report = await Report.findById(req.params.reportId);
      if (!report) {
        return next(new ErrorResponse('Report not found', 404));
      }

      // Validate user is reporter or admin
      const isReporter = report.reportedBy.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin';
      if (!isReporter && !isAdmin) {
        return next(new ErrorResponse('Not authorized to add evidence', 403));
      }

      // Validate file was uploaded
      if (!req.file) {
        return next(new ErrorResponse('No file provided', 400));
      }

      // Validate file type
      const mimeType = req.file.mimetype;
      const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'text/plain'];
      if (!ALLOWED_TYPES.includes(mimeType)) {
        // Delete the uploaded file before rejecting
        await deleteFromSpaces(req.file.key);
        return next(new ErrorResponse('Invalid file type. Allowed: JPG, PNG, TXT', 400));
      }

      // Validate file size (5 MB)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (req.file.size > MAX_FILE_SIZE) {
        await deleteFromSpaces(req.file.key);
        return next(new ErrorResponse('File too large. Max 5 MB per file', 413));
      }

      // Validate max 5 files per report
      if (report.evidence && report.evidence.length >= 5) {
        await deleteFromSpaces(req.file.key);
        return next(new ErrorResponse('Max 5 files per report', 400));
      }

      // Determine evidence type based on MIME type
      let evidenceType = 'image';
      if (mimeType === 'text/plain') {
        evidenceType = 'text';
      }

      // Store evidence metadata in report
      const evidenceFile = {
        filename: req.file.originalname,
        url: req.file.location,
        type: evidenceType,
        size: req.file.size,
        uploadedAt: new Date(),
        key: req.file.key,
      };

      if (!report.evidence) {
        report.evidence = [];
      }
      report.evidence.push(evidenceFile);
      await report.save();

      res.status(201).json({
        success: true,
        data: evidenceFile,
      });
    } catch (err) {
      // If upload partially succeeded but DB save failed, try to clean up
      if (req.file && req.file.key) {
        try {
          await deleteFromSpaces(req.file.key);
        } catch (cleanupErr) {
          console.error('Failed to clean up orphaned file:', cleanupErr.message);
        }
      }
      next(err);
    }
  }
];

// Helper: Delete file from DigitalOcean Spaces
async function deleteFromSpaces(key) {
  const s3 = require('../config/spaces');
  return new Promise((resolve, reject) => {
    s3.deleteObject(
      {
        Bucket: 'my-projects-media',
        Key: key,
      },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}