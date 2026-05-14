const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const AdminAuditLog = require('../models/AdminAuditLog');
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
  const user = await User.findById(req.params.id)
    .select(ADMIN_USER_FIELDS)
    .lean();
  if (!user) return next(new ErrorResponse('User not found', 404));

  const recentActions = await AdminAuditLog.find({ target: req.params.id })
    .sort({ timestamp: -1 })
    .limit(20)
    .populate('moderator', 'name email')
    .lean();

  res.status(200).json({
    success: true,
    data: { ...user, recentActions },
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
