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
 * Derive the set of user ids currently "active" in a room — i.e. their
 * socket has an open `room_${roomId}` membership right now. Used to skip
 * the new-message push for topic rooms (Task 15 follow-up — notifications):
 * a member with a live socket in the room already sees the message via the
 * `room:message` broadcast, so pushing to them too would be a redundant
 * double-notify.
 *
 * Same "derive from the live adapter Set, never a stored counter" principle
 * as deriveOnlineCount — correct even after an ungraceful disconnect.
 *
 * @param {import('socket.io').Server} io
 * @param {String} roomId - bare room id (without the 'room_' prefix)
 * @returns {Set<String>} user ids (as strings) with a live socket in the room
 */
function getActiveRoomUserIds(io, roomId) {
  const rooms = io?.sockets?.adapter?.rooms;
  const sockets = io?.sockets?.sockets;
  const userIds = new Set();
  if (!rooms || !sockets) return userIds;

  const roomSet = rooms.get(`room_${roomId}`);
  if (!roomSet) return userIds;

  for (const socketId of roomSet) {
    const socket = sockets.get(socketId);
    const userId = socket?.user?.id;
    if (userId) userIds.add(String(userId));
  }

  return userIds;
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

module.exports = { deriveOnlineCount, getActiveRoomUserIds, buildRoomMessageDoc };
