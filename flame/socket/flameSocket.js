// Isolated Socket.IO namespace for Flame realtime chat.
//
// This lives entirely on its own namespace `io.of('/flame')` and authenticates
// with the FLAME JWT (FLAME_JWT_SECRET). It never touches the BananaTalk root
// namespace (initializeSocket) or the Fitbowl namespace (io.of('/fitbowl')).
// A BananaTalk/Fitbowl token cannot authenticate here, and vice versa.
const { verifyAccess } = require('../utils/jwt');
const chatService = require('../services/chatService');
const presenceService = require('../services/presenceService');
const User = require('../models/User');

const NS = '/flame';
const room = (userId) => `flame_user_${userId}`;

// Required lazily (like emitToReceiver does) so a test that swaps the DB
// connection and clears the service from the require cache is answered by the
// live module rather than by a handle captured at load time.
function visibilityService() {
  return require('../services/visibilityService');
}

// The chat partners this socket may know anything about.
//
// partnerIdsOf answers "who shares a conversation with me", which includes
// people on either side of a block — a conversation outlives the block that
// followed it. Presence is broadcast to this list on connect and disconnect and
// echoed back over `presence:bulk`, so an unfiltered list leaks a blocked
// user's online/offline transitions in both directions.
async function visiblePartnerIds(userId) {
  const [partners, blocked] = await Promise.all([
    chatService.partnerIdsOf(userId),
    visibilityService().blockedIdsFor(userId),
  ]);
  const hidden = new Set(blocked);
  return partners.filter((id) => !hidden.has(id));
}

// Should a relay from `fromId` to `toId` be dropped?
//
// Fails CLOSED: `typing`, `stopTyping` and `markRead` are forwarded on a
// client-supplied `data.to`, so if the block lookup itself throws we drop the
// relay rather than risk reaching a blocked user.
async function relayBlocked(fromId, toId) {
  try {
    return await visibilityService().areBlocked(fromId, toId);
  } catch (_) {
    return true;
  }
}

// showOnlineStatus lives under User.preferences (flame/models/User.js), defaulting to
// true. Fall back to true (presence on) if the doc/field is missing for any reason.
function getShowOnlineStatus(userDoc) {
  if (!userDoc || !userDoc.preferences) return true;
  return userDoc.preferences.showOnlineStatus !== false;
}

function initFlameSocket(io) {
  const ns = io.of(NS);

  // Auth: flame access token in the handshake, verified with the flame secret.
  ns.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccess(token);
      socket.userId = payload.userId;
      return next();
    } catch (err) {
      return next(new Error('Authentication failed'));
    }
  });

  ns.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(room(userId));

    // Mark online SYNCHRONOUSLY, before any await, mirroring the disconnect
    // handler's synchronous markOffline. If this were deferred past an
    // `await`, a disconnect racing during that await would run markOffline
    // first (no-op on a still-zero count), and the resumed connect flow
    // would then call markOnline — leaving the count stuck at 1 forever
    // (user permanently reported online).
    let nowOnline = false;
    try {
      nowOnline = presenceService.markOnline(userId);
    } catch (_) {
      nowOnline = false;
    }

    // Online presence: partners-only, respects each user's showOnlineStatus.
    // Best-effort — never let a presence lookup crash the socket connection.
    (async () => {
      try {
        socket.partnerIds = await visiblePartnerIds(userId);
      } catch (_) {
        socket.partnerIds = [];
      }

      try {
        const me = await User.findById(userId).lean();
        const showOnlineStatus = getShowOnlineStatus(me);
        socket.showOnlineStatus = showOnlineStatus;

        // Guard against a socket that already disconnected while we were
        // awaiting the lookups above — don't broadcast a stale "online".
        if (socket.connected && showOnlineStatus && nowOnline) {
          for (const partnerId of socket.partnerIds) {
            ns.to(room(partnerId)).emit('presence', { user_id: userId, online: true });
          }
        }

        const onlinePartnerIds = presenceService.onlineAmong(socket.partnerIds);
        let bulkOnline = [];
        if (onlinePartnerIds.length) {
          const partnerDocs = await User.find({ _id: { $in: onlinePartnerIds } }).lean();
          bulkOnline = partnerDocs
            .filter((doc) => getShowOnlineStatus(doc))
            .map((doc) => doc._id.toString());
        }
        socket.emit('presence:bulk', { online: bulkOnline });
      } catch (_) {
        // Presence is best-effort; ignore failures (e.g. DB unavailable).
      }
    })();

    // Relay typing / read receipts to the other participant's room
    // (best-effort). `data.to` is client-supplied, so every one of these is
    // block-checked before it goes out: a socket connection outlives a block,
    // and these three are the last delivery paths that bypass REST.
    //
    // Async so a test can await the handler; Socket.IO ignores the returned
    // promise, hence the try/catch inside relay() — a rejection here would
    // surface as an unhandled rejection, not as a failed relay.
    const relay = async (data, event, payload) => {
      try {
        if (!data || !data.to) return;
        if (await relayBlocked(userId, data.to)) return;
        ns.to(room(data.to)).emit(event, payload(data));
      } catch (_) {
        // Realtime is best-effort.
      }
    };

    socket.on('typing', (data) => relay(data, 'typing', (d) => ({
      from: userId,
      conversation_id: d.conversation_id,
    })));
    socket.on('stopTyping', (data) => relay(data, 'stopTyping', (d) => ({
      from: userId,
      conversation_id: d.conversation_id,
    })));
    socket.on('markRead', (data) => relay(data, 'read', (d) => ({
      by: userId,
      conversation_id: d.conversation_id,
    })));

    socket.on('disconnect', () => {
      try {
        const nowOffline = presenceService.markOffline(userId);
        if (nowOffline && socket.showOnlineStatus) {
          for (const partnerId of socket.partnerIds || []) {
            ns.to(room(partnerId)).emit('presence', { user_id: userId, online: false });
          }
        }
      } catch (_) {
        // Presence is best-effort; ignore failures.
      }
    });
  });

  return ns;
}

// The one way anything reaches a user's room from outside a connection: push
// `payload` to `receiverId`, unless `otherUserId` — the person the payload is
// about — is on either side of a block with them.
//
// Async because a block has to be re-checked HERE, at delivery time: a socket
// connection outlives a block, and this path bypasses every REST-level check,
// so without this a blocked sender still reaches a live client.
//
// Never rejects — realtime is best-effort and the callers invoke this without
// awaiting, so a rejection would surface as an unhandled rejection rather than
// as a failed send. It fails CLOSED: if the block lookup itself throws we drop
// the push rather than risk delivering into a blocked pair. The message is
// already persisted, so a REST fetch still shows it.
async function emitChecked(io, receiverId, otherUserId, event, payload) {
  if (!io || !receiverId) return;
  try {
    if (otherUserId && await visibilityService().areBlocked(receiverId, otherUserId)) return;
    io.of(NS).to(room(receiverId)).emit(event, payload);
  } catch (_) {
    // Best-effort, fail-closed — see above.
  }
}

async function emitToReceiver(io, receiverId, event, message) {
  return emitChecked(io, receiverId, message && message.sender_id, event, message);
}

// Push a newly-sent message to its receiver's room.
function emitNewMessage(io, receiverId, message) {
  return emitToReceiver(io, receiverId, 'message:new', message);
}

// Push a read receipt into the room of `userId` — the person whose messages
// were read.
//
// The other party is resolved from the conversation rather than taken as an
// argument so no caller can forget to pass it and silently reopen the hole
// emitToReceiver closes. Fails CLOSED: if the conversation cannot be read, or
// the pair is blocked, nothing goes out. The payload shape is unchanged.
async function emitRead(io, userId, conversationId) {
  if (!io || !userId) return;
  let otherId = null;
  try {
    const Conversation = require('../models/Conversation');
    const conv = await Conversation.findById(conversationId).select('participants').lean();
    otherId = conv ? (conv.participants || []).find((p) => p !== userId) : null;
    if (!otherId) return;
  } catch (_) {
    return;
  }
  return emitChecked(io, userId, otherId, 'read', { conversation_id: conversationId });
}

// Push an edited message to its receiver's room.
function emitMessageEdited(io, receiverId, message) {
  return emitToReceiver(io, receiverId, 'message:edited', message);
}

// Push a deleted message to its receiver's room.
function emitMessageDeleted(io, receiverId, message) {
  return emitToReceiver(io, receiverId, 'message:deleted', message);
}

module.exports = { initFlameSocket, emitNewMessage, emitRead, emitMessageEdited, emitMessageDeleted };
