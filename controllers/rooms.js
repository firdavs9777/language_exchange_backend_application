/**
 * Language Rooms ("hubs") REST controller — Workstream D, Task 4.
 *
 * Directory, detail, message history, join/leave, auto-join, and per-hub
 * admin actions (owner or admins[] gated). All routes are wrapped by the
 * ROOMS_ENABLED kill switch (see routes/rooms.js).
 *
 * Pure decision logic (auto-join idempotency, sticky-leave, admin gating,
 * directory sort) lives in lib/roomMembership.js so it's unit-testable
 * without a database — this file only translates those decisions into
 * Mongo reads/writes.
 */

const asyncHandler = require('../middleware/async');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { normalizeLanguage } = require('../lib/normalizeLanguage');
const {
  decideAutoJoin,
  decideJoin,
  decideLeave,
  isRoomAdmin,
  sortRoomsForCaller
} = require('../lib/roomMembership');

// Live online-count accessor from Task 5's socket presence module. Wired
// here (rather than a hardcoded 0) so getRooms/getRoom always reflect the
// current adapter room size — see socket/roomHandler.js:getOnlineCount.
const { getOnlineCount } = require('../socket/roomHandler');

/**
 * Idempotently auto-join `user` into the hub matching their normalized
 * language_to_learn, unless they've explicitly left it before (sticky-leave)
 * or are already a member. Safe to call on every getRooms request.
 *
 * @param {import('mongoose').Document} user - full User document
 * @returns {Promise<void>}
 */
async function autoJoinMatchingHub(user) {
  const canonicalLanguage = normalizeLanguage(user?.language_to_learn);
  if (!canonicalLanguage) return;

  const hub = await Conversation.findOne({ roomType: 'hub', targetLanguage: canonicalLanguage });
  const decision = decideAutoJoin(user, hub);
  if (!decision.shouldJoin) return;

  await Conversation.updateOne(
    { _id: hub._id, participants: { $ne: user._id } },
    { $addToSet: { participants: user._id }, $inc: { memberCount: 1 } }
  );
}

/**
 * @desc    List all language-room hubs, auto-joining the caller to their
 *          matching-language hub first. Caller's hub sorted first, then by
 *          memberCount desc. Each hub carries a live onlineCount.
 * @route   GET /api/v1/rooms
 * @access  Private
 */
exports.getRooms = asyncHandler(async (req, res, next) => {
  const io = req.app.get('io');
  const user = req.user;

  await autoJoinMatchingHub(user);

  const hubs = await Conversation.find({ roomType: 'hub' })
    .select('title description emojiFlag targetLanguage owner admins memberCount maxMembers lastActivityAt isSeeded participants')
    .lean();

  const callerLanguage = normalizeLanguage(user.language_to_learn);
  const sorted = sortRoomsForCaller(hubs, callerLanguage);

  const data = sorted.map((hub) => ({
    ...hub,
    onlineCount: getOnlineCount(io, String(hub._id)),
    isMember: (hub.participants || []).some((p) => p.toString() === user._id.toString()),
    participants: undefined // don't ship the full member-id list in the directory
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

/**
 * @desc    Get a single hub's detail (with live onlineCount).
 * @route   GET /api/v1/rooms/:id
 * @access  Private
 */
exports.getRoom = asyncHandler(async (req, res, next) => {
  const io = req.app.get('io');
  const hub = await Conversation.findOne({ _id: req.params.id, roomType: 'hub' }).lean();

  if (!hub) return next(new ErrorResponse('Room not found', 404));

  const isMember = (hub.participants || []).some((p) => p.toString() === req.user._id.toString());

  res.status(200).json({
    success: true,
    data: {
      ...hub,
      onlineCount: getOnlineCount(io, String(hub._id)),
      isMember,
      participants: undefined
    }
  });
});

/**
 * @desc    Paginated message history for a hub, filtered by conversationId.
 *          Mirrors controllers/messages.js's pagination shape.
 * @route   GET /api/v1/rooms/:id/messages
 * @access  Private
 */
exports.getRoomMessages = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const hub = await Conversation.findOne({ _id: id, roomType: 'hub' }).select('_id').lean();
  if (!hub) return next(new ErrorResponse('Room not found', 404));

  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const skip = (page - 1) * limit;

  const query = { conversationId: id, isDeleted: { $ne: true } };

  const [total, messages] = await Promise.all([
    Message.countDocuments(query),
    Message.find(query)
      .populate('sender', 'name username images userMode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  messages.reverse(); // oldest first, chat order

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    success: true,
    count: messages.length,
    total,
    pagination: {
      currentPage: page,
      totalPages,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: messages
  });
});

/**
 * @desc    Explicitly join a hub. Removes the hub from the caller's
 *          leftHubs (undoes sticky-leave) and increments memberCount only
 *          if newly added.
 * @route   POST /api/v1/rooms/:id/join
 * @access  Private
 */
exports.joinRoom = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const hub = await Conversation.findOne({ _id: id, roomType: 'hub' }).select('participants').lean();
  if (!hub) return next(new ErrorResponse('Room not found', 404));

  const { isNewMember } = decideJoin(userId, hub);

  const conversationUpdate = { $addToSet: { participants: userId } };
  if (isNewMember) conversationUpdate.$inc = { memberCount: 1 };

  await Promise.all([
    Conversation.updateOne({ _id: id }, conversationUpdate),
    User.updateOne({ _id: userId }, { $pull: { leftHubs: id } })
  ]);

  res.status(200).json({ success: true, message: 'Joined room', data: { isNewMember } });
});

/**
 * @desc    Explicitly leave a hub. Adds the hub to the caller's leftHubs
 *          (sticky-leave — blocks future auto-join) and decrements
 *          memberCount only if they were actually a member.
 * @route   POST /api/v1/rooms/:id/leave
 * @access  Private
 */
exports.leaveRoom = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const hub = await Conversation.findOne({ _id: id, roomType: 'hub' }).select('participants').lean();
  if (!hub) return next(new ErrorResponse('Room not found', 404));

  const { wasMember } = decideLeave(userId, hub);

  const conversationUpdate = { $pull: { participants: userId } };
  if (wasMember) conversationUpdate.$inc = { memberCount: -1 };

  await Promise.all([
    Conversation.updateOne({ _id: id }, conversationUpdate),
    User.updateOne({ _id: userId }, { $addToSet: { leftHubs: id } })
  ]);

  res.status(200).json({ success: true, message: 'Left room', data: { wasMember } });
});

/**
 * Shared owner/admin gate for the admin endpoints below. Fetches the hub
 * and 403s if the caller is neither owner nor in admins[].
 */
async function requireRoomAdmin(req, res, next) {
  const { id } = req.params;
  const hub = await Conversation.findOne({ _id: id, roomType: 'hub' });
  if (!hub) {
    next(new ErrorResponse('Room not found', 404));
    return null;
  }
  if (!isRoomAdmin(req.user._id, hub)) {
    next(new ErrorResponse('Not authorized — owner/admin only', 403));
    return null;
  }
  return hub;
}

/**
 * @desc    Remove a member from a hub (owner/admin only).
 * @route   DELETE /api/v1/rooms/:id/members/:userId
 * @access  Private (owner/admin)
 */
exports.removeMember = asyncHandler(async (req, res, next) => {
  const hub = await requireRoomAdmin(req, res, next);
  if (!hub) return;

  const { userId } = req.params;
  const wasMember = hub.participants.some((p) => p.toString() === userId.toString());

  const conversationUpdate = { $pull: { participants: userId } };
  if (wasMember) conversationUpdate.$inc = { memberCount: -1 };

  await Promise.all([
    Conversation.updateOne({ _id: hub._id }, conversationUpdate),
    // Removed members are treated like they left — sticky, no silent re-add.
    User.updateOne({ _id: userId }, { $addToSet: { leftHubs: hub._id } })
  ]);

  res.status(200).json({ success: true, message: 'Member removed' });
});

/**
 * @desc    Mute a member in a hub (owner/admin only). Reuses
 *          Conversation.mute() (shared with DM mute).
 * @route   POST /api/v1/rooms/:id/members/:userId/mute
 * @access  Private (owner/admin)
 */
exports.muteMember = asyncHandler(async (req, res, next) => {
  const hub = await requireRoomAdmin(req, res, next);
  if (!hub) return;

  const { userId } = req.params;
  const { duration } = req.body || {};

  await hub.mute(userId, duration);

  res.status(200).json({ success: true, message: 'Member muted' });
});

/**
 * @desc    Update hub metadata (owner/admin only).
 * @route   PUT /api/v1/rooms/:id
 * @access  Private (owner/admin)
 */
exports.updateRoom = asyncHandler(async (req, res, next) => {
  const hub = await requireRoomAdmin(req, res, next);
  if (!hub) return;

  const EDITABLE_FIELDS = ['title', 'description', 'emojiFlag', 'maxMembers'];
  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) hub[field] = req.body[field];
  }

  await hub.save();

  res.status(200).json({ success: true, message: 'Room updated', data: hub });
});

// Exported for tests / reuse.
exports.autoJoinMatchingHub = autoJoinMatchingHub;
