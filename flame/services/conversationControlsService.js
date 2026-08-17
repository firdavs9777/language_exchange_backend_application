const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { ValidationError } = require('../utils/errors');
const { _findConversation, _assertParticipant } = require('./chatService');

// Mutes the conversation for `userId` only. `durationMs` omitted/undefined means
// indefinite (mutedUntil: null); otherwise mutedUntil is durationMs from now.
//
// mutedBy holds one subdocument per user, so calling this twice must not
// produce two entries for the same user — subdocuments carry a timestamp, so
// $addToSet can never see two entries as equal and would happily add a
// second (the trap Phase A's blockService hit). Guarded with an explicit
// $ne on the push; if that push matched nothing (already muted), the second
// update refreshes the existing entry instead — a second mute call is how a
// user changes the duration, not a no-op.
async function mute(userId, conversationId, durationMs) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);

  const mutedUntil = typeof durationMs === 'number' ? new Date(Date.now() + durationMs) : null;
  const now = new Date();

  const pushed = await Conversation.updateOne(
    { _id: conversationId, 'mutedBy.user': { $ne: userId } },
    { $push: { mutedBy: { user: userId, mutedUntil, mutedAt: now } } },
  );
  if (pushed.modifiedCount === 0) {
    await Conversation.updateOne(
      { _id: conversationId, 'mutedBy.user': userId },
      { $set: { 'mutedBy.$.mutedUntil': mutedUntil, 'mutedBy.$.mutedAt': now } },
    );
  }
  return { muted_until: mutedUntil ? mutedUntil.toISOString() : null };
}

async function unmute(userId, conversationId) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  await Conversation.updateOne(
    { _id: conversationId },
    { $pull: { mutedBy: { user: userId } } },
  );
}

// Task 9 calls this to decide whether to suppress a push notification, so the
// argument order (conversationId, userId) is deliberately the reverse of
// mute/pinMessage's (userId, conversationId) — matches the brief's contract.
//
// mutedUntil: null means an indefinite mute. Anything else is a deadline, and
// once it has passed the user is not muted — a mute that silently never
// expires is a bug users would report as "notifications stopped working."
/**
 * Whether `userId` has an active mute in an already-loaded `mutedBy` array.
 *
 * Split out so chatService.toConversation can report mute state from the
 * document it already holds, instead of either re-querying per conversation or
 * keeping a second copy of the expiry rule. A second copy is free to disagree
 * with this one, and only this one gates push notifications.
 */
function isMutedIn(mutedBy, userId) {
  const entry = (mutedBy || []).find((m) => m.user === userId);
  if (!entry) return false;
  if (entry.mutedUntil == null) return true;   // null means indefinite
  return new Date(entry.mutedUntil).getTime() > Date.now();
}

async function isMutedFor(conversationId, userId) {
  const conv = await Conversation.findById(conversationId).lean().catch(() => null);
  if (!conv) return false;
  return isMutedIn(conv.mutedBy, userId);
}

/**
 * The caller's pinned messages, with content.
 *
 * A read of its own rather than a field on the conversation payload: pinned
 * messages need their text, so serving them inside the conversation LIST would
 * be an N+1 across every row to populate a bar only the open chat renders.
 */
async function listPinned(userId, conversationId) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  return { pinned_messages: await _pinnedMessagesFor(conversationId, userId) };
}

// The shipped app (chat_service.dart's pinMessage/unpinMessage) replaces its
// entire pinned-messages list from this response — it does not merge a
// single new entry in. So both mutators return the caller's FULL current
// pin list, not just the one just added or removed. pinnedBy is per-user, so
// this is scoped to `userId`'s own entries only: the other participant's
// pins live in the same array on the same document but must never appear
// here (that would leak one user's pin choices into the other's list).
//
// `content` is the pinned message's text, straight from toMessage's `text`
// field. A media-only message has no text — Message.text defaults to '' for
// those, same as toMessage already reports — so content is '' for a pinned
// image/video/audio/voice message rather than some synthesized placeholder.
async function _pinnedMessagesFor(conversationId, userId) {
  const conv = await Conversation.findById(conversationId).lean();
  const mine = (conv.pinnedBy || []).filter((p) => p.user === userId);
  if (mine.length === 0) return [];

  const msgs = await Message.find({ _id: { $in: mine.map((p) => p.messageId) } }).lean();
  const byId = new Map(msgs.map((m) => [m._id.toString(), m]));

  return mine.map((p) => ({
    message_id: p.messageId,
    content: (byId.get(p.messageId) || {}).text || '',
    pinned_by: p.user,
    pinned_at: p.pinnedAt ? new Date(p.pinnedAt).toISOString() : null,
  }));
}

async function pinMessage(userId, conversationId, messageId) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);

  let msg = null;
  try { msg = await Message.findById(messageId); } catch (_) { msg = null; }
  if (!msg || msg.conversationId !== conversationId) {
    throw new ValidationError('message_id must be a message in this conversation');
  }

  const now = new Date();
  // Same duplicate trap as mute: guard on the (user, messageId) pair so
  // pinning the same message twice for the same user cannot create two
  // entries via $addToSet's non-dedupe on subdocuments.
  await Conversation.updateOne(
    { _id: conversationId, pinnedBy: { $not: { $elemMatch: { user: userId, messageId } } } },
    { $push: { pinnedBy: { user: userId, messageId, pinnedAt: now } } },
  );
  return { pinned_messages: await _pinnedMessagesFor(conversationId, userId) };
}

async function unpinMessage(userId, conversationId, messageId) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  await Conversation.updateOne(
    { _id: conversationId },
    { $pull: { pinnedBy: { user: userId, messageId } } },
  );
  return { pinned_messages: await _pinnedMessagesFor(conversationId, userId) };
}

module.exports = {
  mute, unmute, isMutedFor, isMutedIn, pinMessage, unpinMessage, listPinned,
};
