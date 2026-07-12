/**
 * Pure helpers for Workstream D language-room ("hub") socket presence and
 * the broadcast message path. Extracted from socket/roomHandler.js so the
 * presence-derivation and message-shape logic are unit testable without a
 * live socket.io server.
 */

/**
 * Derive the live online count for a room from the socket.io adapter's room
 * Set. This is the reviewer-mandated source of truth for presence — NEVER a
 * stored counter — because it is automatically correct even after an
 * ungraceful disconnect (app kill, network drop): Socket.IO's adapter
 * removes the dead socket from the room Set (and deletes the room entry
 * when empty) without any explicit `room:leave` event ever firing.
 *
 * @param {import('socket.io').Server} io
 * @param {String} roomId - bare room id (without the 'room_' prefix)
 * @returns {number}
 */
function deriveOnlineCount(io, roomId) {
  const rooms = io?.sockets?.adapter?.rooms;
  if (!rooms) return 0;
  const roomSet = rooms.get(`room_${roomId}`);
  return roomSet ? roomSet.size : 0;
}

/**
 * Build the plain-object shape for a broadcast hub message. Deliberately
 * does NOT include `unreadCount`/`readBy` fan-out fields — hubs can have
 * hundreds of members, so per-member unread/read tracking is not
 * maintained for the broadcast path (reviewer requirement).
 *
 * The caller (socket/roomHandler.js) passes this into `Message.create(...)`.
 *
 * @param {Object} params
 * @param {String} params.roomId - hub Conversation _id, used as conversationId
 * @param {String} params.senderId
 * @param {String} params.message
 * @param {String} [params.messageType='text']
 * @param {Array}  [params.mentions]
 * @param {Object} [params.media]
 * @returns {Object} plain object suitable for Message.create()
 */
function buildRoomMessageDoc({ roomId, senderId, message, messageType, mentions, media }) {
  if (!roomId) throw new Error('roomId is required');
  if (!senderId) throw new Error('senderId is required');
  if (!message && !media) throw new Error('message or media is required');

  const doc = {
    conversationId: roomId,
    sender: senderId,
    // No `receiver` — hubs have no single receiver. Message.receiver's
    // `required` validator is conditioned on `isGroupMessage` (see
    // models/Message.js) specifically so this is valid.
    participants: [],
    message: message || null,
    isGroupMessage: true,
    messageType: messageType || 'text'
  };

  if (mentions) doc.mentions = mentions;
  if (media) doc.media = media;

  return doc;
}

module.exports = { deriveOnlineCount, buildRoomMessageDoc };
