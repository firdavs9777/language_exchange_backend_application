/**
 * Language Room ("hub") Socket Handler — Workstream D, Task 5.
 *
 * Room-scoped socket events for public language-learning group chats.
 * Presence is always derived live from the socket.io adapter's room Set
 * size (see lib/roomPresence.js:deriveOnlineCount) — never a stored
 * counter — so it stays correct across ungraceful disconnects (app kill,
 * network drop) with no explicit `room:leave` ever firing.
 *
 * The message path broadcasts to the whole room and deliberately does NOT
 * write per-member `unreadCount[]`/`readBy[]` fan-out (a 240-member hub
 * must never pay that write-amplification cost per message).
 *
 * Gated by ROOMS_ENABLED (config/limitations.js — Task 7), accessed via
 * lib/roomMembership.js:getRoomsEnabled().
 */

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { deriveOnlineCount, buildRoomMessageDoc } = require('../lib/roomPresence');
const { getRoomsEnabled } = require('../lib/roomMembership');
const { dispatchRoomMentionPushes } = require('../lib/roomMentions');
const notificationService = require('../services/notificationService');

// Token-bucket rate limiter for room:message, reusing the same shape/limits
// as socketHandler.js's DM sendMessage bucket (capacity 10, refill 1/s) but
// keyed separately so hub chatter can't starve a user's DM budget or vice
// versa.
const roomMessageBuckets = new Map();
const BUCKET_CAPACITY = 10;
const REFILL_RATE_MS = 1000; // 1 token per second

function consumeRoomMessageToken(userId) {
  const now = Date.now();
  let bucket = roomMessageBuckets.get(userId);
  if (!bucket) {
    bucket = { tokens: BUCKET_CAPACITY, lastRefill: now };
    roomMessageBuckets.set(userId, bucket);
  }
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / REFILL_RATE_MS);
  if (refill > 0) {
    bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function clearRoomMessageBucket(userId) {
  roomMessageBuckets.delete(userId);
}

/**
 * Live online-count accessor used by controllers/rooms.js:getRooms to
 * attach a real presence figure to each hub in the directory response.
 * @param {import('socket.io').Server} io
 * @param {String} roomId
 * @returns {number}
 */
function getOnlineCount(io, roomId) {
  return deriveOnlineCount(io, roomId);
}

/**
 * Track which hub rooms a socket has joined, so disconnect can rebroadcast
 * presence for each of them. Keyed by socket.id — a Set of bare roomIds
 * (without the 'room_' prefix).
 */
const socketRooms = new Map();

function trackSocketRoom(socket, roomId) {
  if (!socketRooms.has(socket.id)) {
    socketRooms.set(socket.id, new Set());
  }
  socketRooms.get(socket.id).add(String(roomId));
}

/**
 * Called from socketHandler.js's disconnect handler. Socket.IO has already
 * removed the socket from every room's adapter Set by the time `disconnect`
 * fires, so we just need to (a) know which hub rooms this socket had joined
 * and (b) rebroadcast the now-current (smaller) online count to each.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function handleRoomDisconnect(io, socket) {
  const rooms = socketRooms.get(socket.id);
  socketRooms.delete(socket.id);
  if (!rooms || rooms.size === 0) return;

  for (const roomId of rooms) {
    const online = deriveOnlineCount(io, roomId);
    io.to(`room_${roomId}`).emit('room:presence', { roomId, online });
  }
}

/**
 * Register room-scoped event handlers for a connected socket.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
function registerRoomHandlers(socket, io) {
  const userId = socket.user?.id;
  if (!userId) return;

  socket.on('room:join', async ({ roomId } = {}) => {
    if (!getRoomsEnabled()) return;
    if (!roomId) return;

    try {
      await socket.join(`room_${roomId}`);
      trackSocketRoom(socket, roomId);

      const online = deriveOnlineCount(io, roomId);
      io.to(`room_${roomId}`).emit('room:presence', { roomId, online });
    } catch (error) {
      console.error(`❌ room:join error for room ${roomId}:`, error.message);
      socket.emit('room:error', { message: 'Failed to join room' });
    }
  });

  socket.on('room:leave', async ({ roomId } = {}) => {
    if (!roomId) return;

    try {
      await socket.leave(`room_${roomId}`);
      const rooms = socketRooms.get(socket.id);
      if (rooms) rooms.delete(String(roomId));

      const online = deriveOnlineCount(io, roomId);
      io.to(`room_${roomId}`).emit('room:presence', { roomId, online });
    } catch (error) {
      console.error(`❌ room:leave error for room ${roomId}:`, error.message);
    }
  });

  socket.on('room:message', async (data, callback) => {
    if (!getRoomsEnabled()) return;

    try {
      const roomId = data?.roomId;
      const message = data?.message || data?.text;

      if (!roomId) throw new Error('roomId is required');

      if (!consumeRoomMessageToken(userId)) {
        throw new Error('Too many messages — slow down.');
      }

      const messageDoc = buildRoomMessageDoc({
        roomId,
        senderId: userId,
        message,
        messageType: data?.messageType,
        mentions: data?.mentions,
        media: data?.media
      });

      const newMessage = await Message.create(messageDoc);
      await newMessage.populate('sender', 'name username images userMode');

      // Update hub lastActivityAt (fire-and-forget, non-blocking).
      Conversation.updateOne(
        { _id: roomId, roomType: 'hub' },
        { $set: { lastActivityAt: new Date() } }
      ).catch((err) => console.error('❌ Failed to update hub lastActivityAt:', err.message));

      io.to(`room_${roomId}`).emit('room:message', newMessage);

      // Mention-only push (Task 7): NEVER push for the broadcast as a
      // whole — a 240-member hub can't afford a per-message push fan-out.
      // Only users explicitly @mentioned in this message get notified, one
      // push each, fire-and-forget (mirrors controllers/comments.js's
      // mention-notification loop). See lib/roomMentions.js — the
      // recipient-resolution + dispatch decision is unit tested there.
      dispatchRoomMentionPushes({
        mentions: newMessage.mentions,
        senderId: userId,
        roomId,
        messageText: message,
        sendFn: (mentionedUserId, sender, room, text) =>
          notificationService
            .sendRoomMention(mentionedUserId, sender, room, text)
            .catch((err) => console.error('❌ Room mention notification failed:', err.message))
      });

      if (typeof callback === 'function') {
        callback({ status: 'success', message: newMessage });
      }
    } catch (error) {
      console.error('❌ room:message error:', error.message);
      const errorResponse = { status: 'error', error: error.message };
      if (typeof callback === 'function') {
        callback(errorResponse);
      } else {
        socket.emit('room:error', { message: error.message });
      }
    }
  });

  socket.on('room:typing', ({ roomId } = {}) => {
    if (!roomId) return;
    socket.to(`room_${roomId}`).emit('room:typing', { roomId, userId });
  });

  socket.on('disconnect', () => {
    clearRoomMessageBucket(userId);
  });
}

module.exports = {
  registerRoomHandlers,
  handleRoomDisconnect,
  getOnlineCount
};
