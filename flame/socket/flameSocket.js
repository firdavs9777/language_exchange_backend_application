// Isolated Socket.IO namespace for Flame realtime chat.
//
// This lives entirely on its own namespace `io.of('/flame')` and authenticates
// with the FLAME JWT (FLAME_JWT_SECRET). It never touches the BananaTalk root
// namespace (initializeSocket) or the Fitbowl namespace (io.of('/fitbowl')).
// A BananaTalk/Fitbowl token cannot authenticate here, and vice versa.
const { verifyAccess } = require('../utils/jwt');

const NS = '/flame';
const room = (userId) => `flame_user_${userId}`;

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

    socket.on('disconnect', () => {});
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
