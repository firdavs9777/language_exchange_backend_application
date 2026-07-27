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
  return !!(userDoc && (!userDoc.preferences || userDoc.preferences.showOnlineStatus !== false));
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

    // Online presence: partners-only, respects each user's showOnlineStatus.
    // Best-effort — never let a presence lookup crash the socket connection.
    (async () => {
      try {
        socket.partnerIds = await chatService.partnerIdsOf(userId);
      } catch (_) {
        socket.partnerIds = [];
      }

      try {
        const nowOnline = presenceService.markOnline(userId);
        const me = await User.findById(userId).lean();
        const showOnlineStatus = getShowOnlineStatus(me);
        socket.showOnlineStatus = showOnlineStatus;

        if (showOnlineStatus && nowOnline) {
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

// Push a newly-sent message to its receiver's room. Best-effort; callers guard.
function emitNewMessage(io, receiverId, message) {
  if (!io || !receiverId) return;
  io.of(NS).to(room(receiverId)).emit('message:new', message);
}

function emitRead(io, userId, conversationId) {
  if (!io || !userId) return;
  io.of(NS).to(room(userId)).emit('read', { conversation_id: conversationId });
}

// Push an edited message to its receiver's room. Best-effort; callers guard.
function emitMessageEdited(io, receiverId, message) {
  if (!io || !receiverId) return;
  io.of(NS).to(room(receiverId)).emit('message:edited', message);
}

// Push a deleted message to its receiver's room. Best-effort; callers guard.
function emitMessageDeleted(io, receiverId, message) {
  if (!io || !receiverId) return;
  io.of(NS).to(room(receiverId)).emit('message:deleted', message);
}

module.exports = { initFlameSocket, emitNewMessage, emitRead, emitMessageEdited, emitMessageDeleted };
