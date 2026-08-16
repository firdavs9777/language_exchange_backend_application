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
async function isMutedFor(conversationId, userId) {
  const conv = await Conversation.findById(conversationId).lean().catch(() => null);
  if (!conv) return false;
  const entry = (conv.mutedBy || []).find((m) => m.user === userId);
  if (!entry) return false;
  if (entry.mutedUntil == null) return true;
  return new Date(entry.mutedUntil).getTime() > Date.now();
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
  return { message_id: messageId, pinned_at: now.toISOString() };
}

async function unpinMessage(userId, conversationId, messageId) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  await Conversation.updateOne(
    { _id: conversationId },
    { $pull: { pinnedBy: { user: userId, messageId } } },
  );
}

module.exports = { mute, unmute, isMutedFor, pinMessage, unpinMessage };
