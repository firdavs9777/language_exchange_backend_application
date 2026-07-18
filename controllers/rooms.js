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

const mongoose = require('mongoose');
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
  isBanned,
  hasPendingJoinRequest,
  decideRequestJoin,
  canKickMember,
  sortRoomsForCaller
} = require('../lib/roomMembership');
const { isMemberMuted } = require('../lib/roomMessageNotify');
const notificationService = require('../services/notificationService');

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
// group topic rooms under their language and show ownership). bannedUsers/
// joinRequests are selected ONLY so the per-viewer isBanned/hasPendingRequest/
// pendingRequestCount fields can be computed below — the raw arrays
// themselves are always stripped before the response goes out (Task 16 —
// moderation info is owner/admin-only, never the raw member list).
const ROOM_SELECT_FIELDS =
  'roomType title description emojiFlag targetLanguage owner admins memberCount maxMembers lastActivityAt isSeeded participants bannedUsers joinRequests';

// Simple per-user cap so one user can't fragment a language into dozens of
// empty topic rooms. Not configurable yet — follow-up if product wants a
// different limit or a cooldown instead.
const MAX_TOPIC_ROOMS_PER_OWNER = 10;
const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 300;

// Simple per-room cap on pending join requests (Task 16 — moderation), same
// spirit as MAX_TOPIC_ROOMS_PER_OWNER: cheap abuse guard, not a real queueing
// system. A room stuck at the cap just means its owner/admin needs to work
// through the backlog (approve/deny) before new requests can queue up.
const MAX_PENDING_REQUESTS_PER_ROOM = 50;

/**
 * Strip the moderation-only raw arrays and attach the derived per-viewer
 * fields (Task 16). Never send bannedUsers/joinRequests as-is to any client
 * — only owners/admins get pendingRequestCount, and even they don't get the
 * raw arrays here (GET /rooms/:id/requests is the dedicated endpoint for
 * the actual list, with populated requester info).
 *
 * @param {Object} room - plain object with `bannedUsers`, `joinRequests`
 * @param {String|Object} viewerId
 * @param {boolean} isOwnerOrAdmin
 * @returns {Object} a NEW object — does not mutate `room`
 */
function withModerationFields(room, viewerId, isOwnerOrAdmin) {
  const result = {
    ...room,
    isBanned: isBanned(viewerId, room),
    hasPendingRequest: hasPendingJoinRequest(viewerId, room)
  };
  if (isOwnerOrAdmin) {
    result.pendingRequestCount = Array.isArray(room.joinRequests) ? room.joinRequests.length : 0;
  }
  delete result.bannedUsers;
  delete result.joinRequests;
  return result;
}

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
      // The creator owns a brand-new room: never banned, never has a
      // pending request, and (as owner) sees pendingRequestCount: 0.
      ...withModerationFields(roomObj, req.user._id, true),
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

  const data = sorted.map((room) => {
    const isOwnerOrAdmin = isRoomAdmin(user._id, room);
    return {
      ...withModerationFields(room, user._id, isOwnerOrAdmin),
      onlineCount: getOnlineCount(io, String(room._id)),
      isMember: (room.participants || []).some((p) => p.toString() === user._id.toString()),
      isOwnerOrAdmin,
      participants: undefined // don't ship the full member-id list in the directory
    };
  });

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
  const isOwnerOrAdmin = isRoomAdmin(req.user._id, hub);

  res.status(200).json({
    success: true,
    data: {
      ...withModerationFields(hub, req.user._id, isOwnerOrAdmin),
      onlineCount: getOnlineCount(io, String(hub._id)),
      isMember,
      isOwnerOrAdmin,
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

  const hub = await Conversation.findOne({ _id: id, roomType: { $in: ROOM_TYPES } })
    .select('participants roomType owner title mutedBy bannedUsers')
    .lean();
  if (!hub) return next(new ErrorResponse('Room not found', 404));

  // Ban enforcement is topic-room-only (Task 16 — moderation); hubs have no
  // ban concept and stay open/unmoderated as before. A banned user must go
  // through POST /rooms/:id/request-join and get owner/admin approval —
  // they must NOT be silently let back in here.
  if (hub.roomType === 'topic' && isBanned(userId, hub)) {
    return next(new ErrorResponse('You have been banned from this room', 403, 'BANNED_FROM_ROOM'));
  }

  const { isNewMember } = decideJoin(userId, hub);

  const conversationUpdate = { $addToSet: { participants: userId } };
  if (isNewMember) conversationUpdate.$inc = { memberCount: 1 };

  await Promise.all([
    Conversation.updateOne({ _id: id }, conversationUpdate),
    User.updateOne({ _id: userId }, { $pull: { leftHubs: id } })
  ]);

  // Topic-room-only join system message + owner notify (Task 15 follow-up —
  // notifications). Deliberately skipped for seeded hubs (a system message
  // on every join in a 240-member hub would be noisy) and for repeat joins
  // (isNewMember false) so refreshing/rejoining an already-joined room
  // doesn't spam a "X joined" message every time.
  if (isNewMember && hub.roomType === 'topic') {
    const io = req.app.get('io');

    Message.create({
      conversationId: id,
      sender: userId,
      participants: [],
      message: `${req.user.name} joined`,
      isGroupMessage: true,
      messageType: 'system'
    })
      .then(async (systemMessage) => {
        await systemMessage.populate('sender', 'name username images userMode');
        if (io) io.to(`room_${id}`).emit('room:message', systemMessage);
      })
      .catch((err) => console.error('❌ Failed to post room-join system message:', err.message));

    // Notify the owner someone joined their room — never for self-join
    // (creator is auto-added as the first participant, never hits this
    // path since isNewMember is false for them going forward), and never
    // if the owner has muted this room.
    if (
      hub.owner &&
      hub.owner.toString() !== userId.toString() &&
      !isMemberMuted(hub.mutedBy, hub.owner)
    ) {
      notificationService
        .sendRoomJoin(hub.owner, userId, hub)
        .catch((err) => console.error('❌ Room join notification failed:', err.message));
    }
  }

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
 * @desc    Remove a member from a hub/topic room (owner/admin only). For
 *          topic rooms, kick == ban (Task 16 — moderation): the removed
 *          user is also added to bannedUsers so they can't silently rejoin
 *          via POST /join — they must request-join and get re-approved.
 *          Hubs keep the pre-Task-16 behavior (no ban, sticky-leave only).
 * @route   DELETE /api/v1/rooms/:id/members/:userId
 * @access  Private (owner/admin)
 */
exports.removeMember = asyncHandler(async (req, res, next) => {
  const hub = await requireRoomAdmin(req, res, next);
  if (!hub) return;

  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return next(new ErrorResponse('Invalid user id', 400));
  }

  // The owner can never be kicked/banned — not even by another admin. Check
  // this before the membership check so it 400s even if, somehow, the owner
  // isn't currently a participant.
  if (!canKickMember(userId, hub)) {
    return next(new ErrorResponse('The room owner cannot be kicked', 400, 'CANNOT_KICK_OWNER'));
  }

  const wasMember = hub.participants.some((p) => p.toString() === userId.toString());
  if (!wasMember) {
    return next(new ErrorResponse('User is not a member of this room', 404));
  }

  const conversationUpdate = { $pull: { participants: userId }, $inc: { memberCount: -1 } };
  if (hub.roomType === 'topic') {
    conversationUpdate.$addToSet = { bannedUsers: userId };
  }

  await Promise.all([
    Conversation.updateOne({ _id: hub._id }, conversationUpdate),
    // Removed members are treated like they left — sticky, no silent re-add.
    User.updateOne({ _id: userId }, { $addToSet: { leftHubs: hub._id } })
  ]);

  res.status(200).json({
    success: true,
    message: hub.roomType === 'topic' ? 'Member removed and banned' : 'Member removed'
  });
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

/**
 * Shared "this is a moderated topic room" gate for the join-request
 * endpoints below. Hubs have no ban/request concept (they stay
 * open/unmoderated), so every one of these endpoints 400s on a hub rather
 * than silently no-op'ing.
 */
function requireTopicRoom(hub, next) {
  if (hub.roomType !== 'topic') {
    next(new ErrorResponse('Join requests are only supported for topic rooms', 400, 'NOT_A_TOPIC_ROOM'));
    return false;
  }
  return true;
}

/**
 * @desc    Request to join a topic room. Any authenticated non-member may
 *          call this, INCLUDING a user currently in bannedUsers — this is
 *          precisely how a banned user asks to be let back in (Task 16 —
 *          moderation). Notifies the room owner. Idempotent against races:
 *          the actual write is a single conditional update guarded by the
 *          same "not already a member / no existing pending request"
 *          condition checked below, so two concurrent requests can't both
 *          succeed and create a duplicate pending entry.
 * @route   POST /api/v1/rooms/:id/request-join
 * @access  Private
 */
exports.requestJoin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const hub = await Conversation.findOne({ _id: id, roomType: { $in: ROOM_TYPES } })
    .select('participants owner title roomType mutedBy joinRequests')
    .lean();
  if (!hub) return next(new ErrorResponse('Room not found', 404));
  if (!requireTopicRoom(hub, next)) return;

  const decision = decideRequestJoin(userId, hub);
  if (!decision.ok) {
    if (decision.reason === 'already-member') {
      return next(new ErrorResponse('You are already a member of this room', 400, 'ALREADY_MEMBER'));
    }
    return next(new ErrorResponse('You already have a pending request for this room', 400, 'REQUEST_ALREADY_PENDING'));
  }

  if ((hub.joinRequests || []).length >= MAX_PENDING_REQUESTS_PER_ROOM) {
    return next(new ErrorResponse('This room has too many pending join requests right now', 400, 'TOO_MANY_PENDING_REQUESTS'));
  }

  // Atomic, race-safe write: only pushes if the caller is STILL neither a
  // member nor already pending at write time (re-checks both conditions in
  // the query filter, not just in the pre-check above).
  const writeResult = await Conversation.updateOne(
    { _id: id, participants: { $ne: userId }, 'joinRequests.user': { $ne: userId } },
    { $push: { joinRequests: { user: userId, requestedAt: new Date(), status: 'pending' } } }
  );

  if (writeResult.matchedCount === 0) {
    // Lost a race against a concurrent request-join/join — same user-facing
    // outcome either way (already a member or already pending), 400 either
    // way rather than guessing which.
    return next(new ErrorResponse('You already have a pending request for this room', 400, 'REQUEST_ALREADY_PENDING'));
  }

  // Notify the owner — never if they muted this room. Never fails the
  // request itself (fire-and-forget), mirroring joinRoom's sendRoomJoin.
  if (hub.owner && hub.owner.toString() !== userId.toString() && !isMemberMuted(hub.mutedBy, hub.owner)) {
    notificationService
      .sendRoomJoinRequest(hub.owner, userId, hub)
      .catch((err) => console.error('❌ Room join-request notification failed:', err.message));
  }

  res.status(200).json({ success: true, message: 'Join request sent' });
});

/**
 * @desc    List pending join requests for a topic room, with requester
 *          info populated (owner/admin only).
 * @route   GET /api/v1/rooms/:id/requests
 * @access  Private (owner/admin)
 */
exports.getJoinRequests = asyncHandler(async (req, res, next) => {
  const hub = await requireRoomAdmin(req, res, next);
  if (!hub) return;
  if (!requireTopicRoom(hub, next)) return;

  await hub.populate('joinRequests.user', 'name username images');

  const data = (hub.joinRequests || []).map((r) => ({
    user: r.user,
    requestedAt: r.requestedAt,
    status: r.status
  }));

  res.status(200).json({ success: true, count: data.length, data });
});

/**
 * @desc    Approve a pending join request (owner/admin only): un-bans the
 *          user if they were banned, adds them as a member, and clears
 *          their pending request. Approving a user who's already a member
 *          (e.g. a stale/duplicate request) is a no-op on membership but
 *          still clears the request/ban — idempotent, not an error.
 * @route   POST /api/v1/rooms/:id/requests/:userId/approve
 * @access  Private (owner/admin)
 */
exports.approveJoinRequest = asyncHandler(async (req, res, next) => {
  const hub = await requireRoomAdmin(req, res, next);
  if (!hub) return;
  if (!requireTopicRoom(hub, next)) return;

  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return next(new ErrorResponse('Invalid user id', 400));
  }

  const targetUser = await User.findById(userId).select('_id').lean();
  if (!targetUser) return next(new ErrorResponse('User not found', 404));

  const isAlreadyMember = hub.participants.some((p) => p.toString() === userId.toString());

  const update = { $pull: { joinRequests: { user: userId }, bannedUsers: userId } };
  if (!isAlreadyMember) {
    update.$addToSet = { participants: userId };
    update.$inc = { memberCount: 1 };
  }

  await Promise.all([
    Conversation.updateOne({ _id: hub._id }, update),
    User.updateOne({ _id: userId }, { $pull: { leftHubs: hub._id } })
  ]);

  notificationService
    .sendRoomJoinApproved(userId, hub)
    .catch((err) => console.error('❌ Room join-approve notification failed:', err.message));

  res.status(200).json({ success: true, message: 'Join request approved' });
});

/**
 * @desc    Deny a pending join request (owner/admin only). Removes the
 *          request WITHOUT banning — denial is not a ban, the user can
 *          request again later. No-op (still 200) if there was no pending
 *          request for this user.
 * @route   POST /api/v1/rooms/:id/requests/:userId/deny
 * @access  Private (owner/admin)
 */
exports.denyJoinRequest = asyncHandler(async (req, res, next) => {
  const hub = await requireRoomAdmin(req, res, next);
  if (!hub) return;
  if (!requireTopicRoom(hub, next)) return;

  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return next(new ErrorResponse('Invalid user id', 400));
  }

  const hadPendingRequest = hub.joinRequests.some((r) => r.user && r.user.toString() === userId.toString());

  await Conversation.updateOne({ _id: hub._id }, { $pull: { joinRequests: { user: userId } } });

  if (hadPendingRequest) {
    notificationService
      .sendRoomJoinDenied(userId, hub)
      .catch((err) => console.error('❌ Room join-deny notification failed:', err.message));
  }

  res.status(200).json({ success: true, message: 'Join request denied' });
});

// Exported for tests / reuse.
exports.autoJoinMatchingHub = autoJoinMatchingHub;
