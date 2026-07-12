/**
 * Pure decision logic for Workstream D's mention-only room push
 * (socket/roomHandler.js's room:message handler — Task 7).
 *
 * A hub can have hundreds of members, so `room:message` must NEVER push a
 * notification for the broadcast as a whole — only the specific users
 * @mentioned in that message get a push (mirrors controllers/comments.js's
 * existing mention-notification loop). This module decides WHICH user ids
 * should be notified; the caller (socket/roomHandler.js) is responsible for
 * actually calling notificationService.sendRoomMention for each one.
 */

/**
 * @param {Array<Object>|undefined|null} mentions - Message.mentions shape:
 *   [{ user: ObjectId|String, username, startIndex, endIndex }]
 * @param {String|Object} senderId - the message author's id (never notify self)
 * @returns {Array<String>} deduped list of mentioned user ids (as strings),
 *   excluding the sender, in first-seen order. Empty array for a plain
 *   (non-mention) message — this is what guarantees "0 pushes" for plain
 *   room messages.
 */
function resolveRoomMentionRecipients(mentions, senderId) {
  if (!Array.isArray(mentions) || mentions.length === 0) return [];

  const senderIdStr = senderId != null ? senderId.toString() : null;
  const seen = new Set();
  const recipients = [];

  for (const mention of mentions) {
    const userId = mention?.user;
    if (userId === null || userId === undefined) continue;

    const userIdStr = userId.toString();
    if (userIdStr === senderIdStr) continue; // never notify yourself
    if (seen.has(userIdStr)) continue; // dedup repeated @mentions of the same user

    seen.add(userIdStr);
    recipients.push(userIdStr);
  }

  return recipients;
}

/**
 * Dispatch mention-only pushes for a room message. This is the exact
 * decision socket/roomHandler.js's room:message handler performs: resolve
 * the mention recipients, then call `sendFn` once per recipient (never for
 * the message as a whole). Extracted here — with `sendFn` injected — so the
 * "plain message -> 0 sends, mention -> 1 send" contract is unit testable
 * with a spy, without loading socket/roomHandler.js itself (which
 * transitively requires jsonwebtoken via models/User.js and can't be
 * require()'d standalone in this environment — see prior batch report).
 *
 * @param {Object} params
 * @param {Array<Object>|undefined|null} params.mentions - Message.mentions
 * @param {String|Object} params.senderId
 * @param {String|Object} params.roomId
 * @param {String} params.messageText
 * @param {Function} params.sendFn - (mentionedUserId, senderId, roomId, messageText) => Promise
 * @returns {number} count of pushes dispatched (== recipients.length)
 */
function dispatchRoomMentionPushes({ mentions, senderId, roomId, messageText, sendFn }) {
  const recipients = resolveRoomMentionRecipients(mentions, senderId);
  for (const mentionedUserId of recipients) {
    sendFn(mentionedUserId, senderId, roomId, messageText);
  }
  return recipients.length;
}

module.exports = { resolveRoomMentionRecipients, dispatchRoomMentionPushes };
