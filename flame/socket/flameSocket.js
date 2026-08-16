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
        socket.partnerIds = await chatService.partnerIdsOf(userId);
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

    // Relay typing to the other participant's room (best-effort).
    socket.on('typing', (data) => {
      if (data && data.to) {
        ns.to(room(data.to)).emit('typing', {
          from: userId,
          conversation_id: data.conversation_id,
        });
      }
    });
    socket.on('stopTyping', (data) => {
      if (data && data.to) {
        ns.to(room(data.to)).emit('stopTyping', {
          from: userId,
          conversation_id: data.conversation_id,
        });
      }
    });
    // Relay a read receipt to the other participant.
    socket.on('markRead', (data) => {
      if (data && data.to) {
        ns.to(room(data.to)).emit('read', {
          by: userId,
          conversation_id: data.conversation_id,
        });
      }
    });

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

// Push a message payload into its receiver's room.
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
async function emitToReceiver(io, receiverId, event, message) {
  if (!io || !receiverId) return;
  try {
    const senderId = message && message.sender_id;
    if (senderId) {
      const visibility = require('../services/visibilityService');
      if (await visibility.areBlocked(receiverId, senderId)) return;
    }
    io.of(NS).to(room(receiverId)).emit(event, message);
  } catch (_) {
    // Best-effort, fail-closed — see above.
  }
}

// Push a newly-sent message to its receiver's room.
function emitNewMessage(io, receiverId, message) {
  return emitToReceiver(io, receiverId, 'message:new', message);
}

function emitRead(io, userId, conversationId) {
  if (!io || !userId) return;
  io.of(NS).to(room(userId)).emit('read', { conversation_id: conversationId });
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
