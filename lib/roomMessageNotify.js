/**
 * Pure decision logic for the new-message push notification sent to
 * user-created "topic" room members (Task 15 follow-up — notifications).
 *
 * Deliberately separate from lib/roomMentions.js: that module answers "who
 * was @mentioned in this room message" (fires for hubs AND topics, one push
 * per mention, no matter how big the room). This module answers "who should
 * get a plain new-message push for a topic room" — every non-sender member
 * who isn't currently viewing the room and hasn't muted it. NEVER used for
 * seeded hubs (a 240-member hub broadcasting a push per message would be
 * spam) — the caller (socket/roomHandler.js) is responsible for only
 * invoking this for `roomType:'topic'` conversations.
 *
 * Extracted here (no Mongoose/DB/socket.io dependency) so the recipient
 * math is unit-testable without a live server, mirroring the existing
 * lib/roomMentions.js pattern.
 */

/**
 * Mirrors Conversation.schema.methods.isMuted's logic (models/Conversation.js)
 * but as a pure function over a plain `mutedBy` array (no document mutation,
 * no auto-unmute side effect — this only needs a read-only yes/no answer for
 * a fire-and-forget push decision).
 *
 * @param {Array<Object>|undefined|null} mutedBy - Conversation.mutedBy shape:
 *   [{ user: ObjectId|String, mutedUntil: Date|null, mutedAt: Date }]
 * @param {String|Object} userId
 * @returns {boolean} true if userId has an active (non-expired) mute entry
 */
function isMemberMuted(mutedBy, userId) {
  if (!Array.isArray(mutedBy) || userId == null) return false;

  const userIdStr = userId.toString();
  const mute = mutedBy.find((m) => m?.user != null && m.user.toString() === userIdStr);
  if (!mute) return false;

  if (mute.mutedUntil && new Date(mute.mutedUntil) < new Date()) {
    return false; // expired mute — treat as not muted
  }

  return true;
}

/**
 * Resolve which room participants should receive a new-message push.
 *
 * @param {Object} params
 * @param {Array<Object>} params.participants - room's participants (ObjectId|String)
 * @param {Array<Object>|undefined|null} params.mutedBy - room's mutedBy array
 * @param {Set<String>|Array<String>|undefined|null} params.activeUserIds -
 *   user ids currently present in the room's live socket room (derived from
 *   the socket.io adapter — see lib/roomPresence.js:getActiveRoomUserIds).
 *   These users already see the message in real time, so no push.
 * @param {String|Object} params.senderId - never notify the sender
 * @returns {Array<String>} deduped recipient user ids, in participants order
 */
function resolveRoomMessageRecipients({ participants, mutedBy, activeUserIds, senderId }) {
  if (!Array.isArray(participants) || participants.length === 0) return [];

  const senderIdStr = senderId != null ? senderId.toString() : null;
  const active = activeUserIds instanceof Set ? activeUserIds : new Set(activeUserIds || []);
  const seen = new Set();
  const recipients = [];

  for (const participant of participants) {
    if (participant === null || participant === undefined) continue;
    const userIdStr = participant.toString();

    if (userIdStr === senderIdStr) continue; // never notify yourself
    if (seen.has(userIdStr)) continue; // dedup
    if (active.has(userIdStr)) continue; // already viewing the room live
    if (isMemberMuted(mutedBy, userIdStr)) continue; // muted this room

    seen.add(userIdStr);
    recipients.push(userIdStr);
  }

  return recipients;
}

module.exports = { isMemberMuted, resolveRoomMessageRecipients };
