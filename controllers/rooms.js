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
 *
 * User-created "topic" rooms (Task 15): same Conversation shape as a hub
 * (roomType:'topic' instead of 'hub'), scoped to a targetLanguage, created
 * via createRoom below with the creator set as `owner` (so isRoomAdmin/the
 * owner-or-admin gate below already works for them — no new membership
 * mechanism needed). Every read/join/leave/message/admin endpoint that used
 * to hardcode `roomType: 'hub'` now matches BOTH types via ROOM_TYPES so
 * topic rooms are fully usable, EXCEPT autoJoinMatchingHub, which must stay
 * hub-only — topic rooms are opt-in only, never auto-joined.
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

// Both room kinds share every read/join/leave/message/admin endpoint below —
// only autoJoinMatchingHub and createRoom care about the distinction.
const ROOM_TYPES = ['hub', 'topic'];

// Fields returned in the room directory / detail payloads — kept as a single
// list so getRooms/getRoom/createRoom always ship the same shape (the client
// depends on this: roomType + targetLanguage + owner/admins are what let it
// group topic rooms under their language and show ownership).
const ROOM_SELECT_FIELDS =
  'roomType title description emojiFlag targetLanguage owner admins memberCount maxMembers lastActivityAt isSeeded participants';

// Simple per-user cap so one user can't fragment a language into dozens of
// empty topic rooms. Not configurable yet — follow-up if product wants a
// different limit or a cooldown instead.
const MAX_TOPIC_ROOMS_PER_OWNER = 10;
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 300;

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
 * @desc    Create a user-created topic room nested under a language (e.g.
 *          Spanish -> "Travel"). The creator becomes the room's `owner`
 *          (reusing the same owner/admins gate as seeded hubs — no separate
 *          membership mechanism) and its first participant. Capped per user
 *          so one account can't fragment a language into empty rooms.
 * @route   POST /api/v1/rooms
 * @access  Private
 */
exports.createRoom = asyncHandler(async (req, res, next) => {
  const io = req.app.get('io');
  const body = req.body || {};

  const rawTitle = body.topic ?? body.title ?? body.name ?? '';
  const title = String(rawTitle).trim();
  if (!title) {
    return next(new ErrorResponse('A room name/topic is required', 400));
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return next(new ErrorResponse(`Room name must be ${MAX_TITLE_LENGTH} characters or fewer`, 400));
  }

  const canonicalLanguage = normalizeLanguage(body.targetLanguage);
  if (!canonicalLanguage) {
    return next(new ErrorResponse('A valid targetLanguage is required', 400));
  }

  let description;
  if (body.description !== undefined && body.description !== null) {
    description = String(body.description).trim().slice(0, MAX_DESCRIPTION_LENGTH);
  }

  let emojiFlag;
  if (body.emojiFlag !== undefined && body.emojiFlag !== null) {
    emojiFlag = String(body.emojiFlag).trim().slice(0, 8);
  }

  const ownedCount = await Conversation.countDocuments({ roomType: 'topic', owner: req.user._id });
  if (ownedCount >= MAX_TOPIC_ROOMS_PER_OWNER) {
    return next(new ErrorResponse(`You can only own up to ${MAX_TOPIC_ROOMS_PER_OWNER} topic rooms`, 400));
  }

  const room = await Conversation.create({
    roomType: 'topic',
    targetLanguage: canonicalLanguage,
    title,
    description,
    emojiFlag,
    owner: req.user._id,
    participants: [req.user._id],
    memberCount: 1,
    isPublic: true,
    isSeeded: false
  });

  const roomObj = room.toObject();
  delete roomObj.participants;

  res.status(201).json({
    success: true,
    message: 'Room created',
    data: {
      ...roomObj,
      onlineCount: getOnlineCount(io, String(room._id)),
      isMember: true,
      isOwnerOrAdmin: true
    }
  });
});

/**
 * @desc    List all language-room hubs AND user-created topic rooms,
 *          auto-joining the caller to their matching-language hub first.
 *          Caller's hub sorted first, then by memberCount desc. Each room
 *          carries roomType/targetLanguage/owner/isOwnerOrAdmin so the
 *          client can group topic rooms under their parent language and
 *          show ownership, plus a live onlineCount.
 * @route   GET /api/v1/rooms
 * @access  Private
 */
exports.getRooms = asyncHandler(async (req, res, next) => {
  const io = req.app.get('io');
  const user = req.user;

  await autoJoinMatchingHub(user);

  const rooms = await Conversation.find({ roomType: { $in: ROOM_TYPES } })
    .select(ROOM_SELECT_FIELDS)
    .lean();

  const callerLanguage = normalizeLanguage(user.language_to_learn);
  const sorted = sortRoomsForCaller(rooms, callerLanguage);

  const data = sorted.map((room) => ({
    ...room,
    onlineCount: getOnlineCount(io, String(room._id)),
    isMember: (room.participants || []).some((p) => p.toString() === user._id.toString()),
    isOwnerOrAdmin: isRoomAdmin(user._id, room),
    participants: undefined // don't ship the full member-id list in the directory
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

/**
 * @desc    Get a single hub/topic room's detail (with live onlineCount).
 * @route   GET /api/v1/rooms/:id
 * @access  Private
 */
exports.getRoom = asyncHandler(async (req, res, next) => {
  const io = req.app.get('io');
  const hub = await Conversation.findOne({ _id: req.params.id, roomType: { $in: ROOM_TYPES } }).lean();

  if (!hub) return next(new ErrorResponse('Room not found', 404));

  const isMember = (hub.participants || []).some((p) => p.toString() === req.user._id.toString());

  res.status(200).json({
    success: true,
    data: {
      ...hub,
      onlineCount: getOnlineCount(io, String(hub._id)),
      isMember,
      isOwnerOrAdmin: isRoomAdmin(req.user._id, hub),
      participants: undefined
    }
  });
});

/**
 * @desc    Paginated message history for a hub/topic room, filtered by
 *          conversationId. Mirrors controllers/messages.js's pagination shape.
 * @route   GET /api/v1/rooms/:id/messages
 * @access  Private
 */
exports.getRoomMessages = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const hub = await Conversation.findOne({ _id: id, roomType: { $in: ROOM_TYPES } }).select('_id').lean();
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
 * @desc    Explicitly join a hub or topic room. Removes the hub from the
 *          caller's leftHubs (undoes sticky-leave) and increments
 *          memberCount only if newly added.
 * @route   POST /api/v1/rooms/:id/join
 * @access  Private
 */
exports.joinRoom = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const hub = await Conversation.findOne({ _id: id, roomType: { $in: ROOM_TYPES } }).select('participants').lean();
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
 * @desc    Explicitly leave a hub or topic room. Adds the room to the
 *          caller's leftHubs (sticky-leave — blocks future auto-join; a
 *          no-op for topic rooms since those are never auto-joined) and
 *          decrements memberCount only if they were actually a member.
 * @route   POST /api/v1/rooms/:id/leave
 * @access  Private
 */
exports.leaveRoom = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const hub = await Conversation.findOne({ _id: id, roomType: { $in: ROOM_TYPES } }).select('participants').lean();
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
  const hub = await Conversation.findOne({ _id: id, roomType: { $in: ROOM_TYPES } });
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
