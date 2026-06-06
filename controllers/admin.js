const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const AdminAuditLog = require('../models/AdminAuditLog');
const AIUsageLog = require('../models/AIUsageLog');
const Message = require('../models/Message');
const Moment = require('../models/Moment');
const ErrorResponse = require('../utils/errorResponse');
const banService = require('../services/banService');

// Fields the admin surface exposes per user. Richer than the public
// /users/:id view (which omits ban + role metadata).
const ADMIN_USER_FIELDS =
  'name email username images imageUrls native_language language_to_learn ' +
  'location createdAt lastActive role isBanned banReason bannedAt userMode ' +
  'vipSubscription.isActive';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @desc    Search users (admin view)
 * @route   GET /api/v1/admin/users
 * @access  Admin
 * @query   q (string substring on email/name/username, case-insensitive)
 *          banned=true (filter to isBanned=true)
 *          adminsOnly=true (filter to role=admin)
 *          page (int), limit (int, max 50)
 */
exports.searchUsers = asyncHandler(async (req, res, next) => {
  const { q, banned, adminsOnly } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ email: rx }, { name: rx }, { username: rx }];
  }
  if (banned === 'true') filter.isBanned = true;
  if (adminsOnly === 'true') filter.role = 'admin';

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(ADMIN_USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      total,
      page,
      limit,
      hasMore: skip + users.length < total,
    },
  });
});

/**
 * @desc    Get a user's admin-view detail (richer fields + recent audit
 *          actions targeting this user).
 * @route   GET /api/v1/admin/users/:id
 * @access  Admin
 */
exports.getUserDetail = asyncHandler(async (req, res, next) => {
  const uid = req.params.id;
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [user, recentActions, lastMessage, messagesLast30d, lastMoment, momentsLast30d] =
    await Promise.all([
      User.findById(uid).select(ADMIN_USER_FIELDS).lean(),
      AdminAuditLog.find({ target: uid })
        .sort({ timestamp: -1 })
        .limit(20)
        .populate('moderator', 'name email')
        .lean(),
      Message.findOne({ sender: uid }).sort({ createdAt: -1 }).select('createdAt').lean(),
      Message.countDocuments({ sender: uid, createdAt: { $gte: since30d } }),
      Moment.findOne({ user: uid }).sort({ createdAt: -1 }).select('createdAt').lean(),
      Moment.countDocuments({ user: uid, createdAt: { $gte: since30d } }),
    ]);

  if (!user) return next(new ErrorResponse('User not found', 404));

  res.status(200).json({
    success: true,
    data: {
      ...user,
      recentActions,
      activitySummary: {
        lastMessageAt: lastMessage?.createdAt ?? null,
        messagesLast30d,
        lastMomentAt: lastMoment?.createdAt ?? null,
        momentsLast30d,
      },
    },
  });
});

/**
 * @desc    Ban a user manually (no report required).
 * @route   POST /api/v1/admin/users/:id/ban
 * @access  Admin
 * @body    { reason: string (required, non-whitespace) }
 */
exports.banUser = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return next(new ErrorResponse('Reason is required', 400));
  }
  if (String(req.user.id) === String(req.params.id)) {
    return next(new ErrorResponse('You cannot ban yourself', 403));
  }

  const result = await banService.banUser({
    userId: req.params.id,
    reason: reason.trim(),
    moderatorId: req.user.id,
    source: 'manual',
    io: req.app.get('io'),
  });

  if (!result.ok) {
    return next(new ErrorResponse(result.error || 'Ban failed', 404));
  }
  res.status(200).json({ success: true, message: 'User banned' });
});

/**
 * @desc    Unban a user.
 * @route   POST /api/v1/admin/users/:id/unban
 * @access  Admin
 * @body    { reason: string (required, non-whitespace) }
 */
exports.unbanUser = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return next(new ErrorResponse('Reason is required', 400));
  }

  const result = await banService.unbanUser({
    userId: req.params.id,
    reason: reason.trim(),
    moderatorId: req.user.id,
  });

  if (!result.ok) {
    return next(new ErrorResponse(result.error || 'Unban failed', 404));
  }
  res.status(200).json({
    success: true,
    message: result.noop ? 'User was not banned' : 'User unbanned',
  });
});

/**
 * @desc    Change a user's role (promote / demote).
 * @route   PUT /api/v1/admin/users/:id/role
 * @access  Admin
 * @body    { role: 'admin' | 'user', reason: string (required) }
 */
exports.changeRole = asyncHandler(async (req, res, next) => {
  const { role, reason } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return next(new ErrorResponse('Invalid role', 400));
  }
  if (!reason || !reason.trim()) {
    return next(new ErrorResponse('Reason is required', 400));
  }
  if (String(req.user.id) === String(req.params.id) && role === 'user') {
    return next(
      new ErrorResponse('You cannot revoke your own admin role', 403)
    );
  }

  const result = await banService.changeUserRole({
    userId: req.params.id,
    role,
    reason: reason.trim(),
    moderatorId: req.user.id,
  });

  if (!result.ok) {
    return next(new ErrorResponse(result.error || 'Role change failed', 400));
  }
  res.status(200).json({
    success: true,
    data: {
      previousRole: result.previousRole,
      newRole: result.newRole,
      noop: !!result.noop,
    },
  });
});

/**
 * @desc    Aggregate user stats for the admin analytics screen.
 * @route   GET /api/v1/admin/stats
 * @access  Admin
 * @returns total + byGender + byRole + byMode + banned + admins + vip +
 *          newToday + newThisWeek + activeWeek + topNativeLanguages +
 *          topLearningLanguages
 *
 * One round-trip via $facet so the analytics page renders in one fetch.
 */
exports.getStats = asyncHandler(async (req, res, next) => {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [agg] = await User.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        byGender: [
          {
            $group: {
              _id: { $ifNull: ['$gender', 'unspecified'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        byRole: [
          {
            $group: {
              _id: { $ifNull: ['$role', 'user'] },
              count: { $sum: 1 },
            },
          },
        ],
        byMode: [
          {
            $group: {
              _id: { $ifNull: ['$userMode', 'regular'] },
              count: { $sum: 1 },
            },
          },
        ],
        banned: [
          { $match: { isBanned: true } },
          { $count: 'count' },
        ],
        admins: [
          { $match: { role: 'admin' } },
          { $count: 'count' },
        ],
        vip: [
          { $match: { 'vipSubscription.isActive': true } },
          { $count: 'count' },
        ],
        newToday: [
          { $match: { createdAt: { $gte: todayStart } } },
          { $count: 'count' },
        ],
        newThisWeek: [
          { $match: { createdAt: { $gte: weekStart } } },
          { $count: 'count' },
        ],
        activeWeek: [
          { $match: { lastActive: { $gte: weekStart } } },
          { $count: 'count' },
        ],
        topNativeLanguages: [
          {
            $match: {
              native_language: { $exists: true, $ne: null, $ne: '' },
            },
          },
          { $group: { _id: '$native_language', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
        topLearningLanguages: [
          {
            $match: {
              language_to_learn: { $exists: true, $ne: null, $ne: '' },
            },
          },
          { $group: { _id: '$language_to_learn', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);

  const pluck = (k) => agg[k]?.[0]?.count || 0;

  res.status(200).json({
    success: true,
    data: {
      total: pluck('total'),
      banned: pluck('banned'),
      admins: pluck('admins'),
      vip: pluck('vip'),
      newToday: pluck('newToday'),
      newThisWeek: pluck('newThisWeek'),
      activeWeek: pluck('activeWeek'),
      byGender: agg.byGender || [],
      byRole: agg.byRole || [],
      byMode: agg.byMode || [],
      topNativeLanguages: agg.topNativeLanguages || [],
      topLearningLanguages: agg.topLearningLanguages || [],
      generatedAt: now.toISOString(),
    },
  });
});

/**
 * @desc    Paginated audit log, filterable by moderator/target/action.
 * @route   GET /api/v1/admin/audit-log
 * @access  Admin
 * @query   moderatorId, targetId, action, page, limit (max 100)
 */
exports.getAuditLog = asyncHandler(async (req, res, next) => {
  const { moderatorId, targetId, action } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const filter = {};
  if (moderatorId) filter.moderator = moderatorId;
  if (targetId) filter.target = targetId;
  if (action) filter.action = action;

  const [entries, total] = await Promise.all([
    AdminAuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('moderator', 'name email')
      .populate('target', 'name email')
      .lean(),
    AdminAuditLog.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: entries,
    pagination: {
      total,
      page,
      limit,
      hasMore: skip + entries.length < total,
    },
  });
});

/**
 * @desc    AI feature usage counts grouped by feature and day
 * @route   GET /api/v1/admin/ai-usage
 * @access  Admin
 * @query   feature (string, optional) — filter to one feature
 *          from (ISO date, optional) — start of range, default 30 days ago
 *          to   (ISO date, optional) — end of range, default now
 */
/**
 * @desc    Paginated raw AI usage log entries with user info
 * @route   GET /api/v1/admin/ai-usage/logs
 * @access  Admin
 * @query   feature (optional), from (ISO date), to (ISO date), page, limit (max 100)
 */
exports.getAIUsageLogs = asyncHandler(async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const match = { timestamp: { $gte: from, $lte: to } };
  if (req.query.feature) match.feature = req.query.feature;

  const [logs, total] = await Promise.all([
    AIUsageLog.find(match)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email username')
      .lean(),
    AIUsageLog.countDocuments(match),
  ]);

  res.status(200).json({
    success: true,
    data: logs.map((l) => ({
      id: l._id,
      user: l.userId
        ? { id: l.userId._id, name: l.userId.name, email: l.userId.email }
        : null,
      feature: l.feature,
      timestamp: l.timestamp,
    })),
    pagination: { total, page, limit, hasMore: skip + logs.length < total },
  });
});

exports.getAIUsage = asyncHandler(async (req, res) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const match = { timestamp: { $gte: from, $lte: to } };
  if (req.query.feature) match.feature = req.query.feature;

  const [byFeature, byDay, total] = await Promise.all([
    AIUsageLog.aggregate([
      { $match: match },
      { $group: { _id: '$feature', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, feature: '$_id', count: 1 } },
    ]),
    AIUsageLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', count: 1 } },
    ]),
    AIUsageLog.countDocuments(match),
  ]);

  res.status(200).json({ success: true, data: { total, byFeature, byDay } });
});
