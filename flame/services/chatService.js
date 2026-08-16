const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { NotFoundError, ValidationError, FlameError } = require('../utils/errors');
const { toDiscoverUser } = require('./discoveryService');
const visibility = require('./visibilityService');

function toMessage(m) {
  return {
    id: m._id.toString(),
    conversation_id: m.conversationId,
    sender_id: m.sender,
    receiver_id: m.receiver,
    text: m.text,
    message_type: m.messageType,
    reactions: (m.reactions || []).map((r) => ({ user_id: r.user, emoji: r.emoji })),
    reply_to: m.replyTo || null,
    read: m.read,
    read_at: m.readAt ? m.readAt.toISOString() : null,
    is_edited: m.isEdited || false,
    edited_at: m.editedAt ? m.editedAt.toISOString() : null,
    is_deleted: m.isDeleted || false,
    created_at: m.createdAt ? m.createdAt.toISOString() : null,
  };
}

function toConversation(c, forUserId, lastMessageDoc, otherUserDoc) {
  const other = c.participants.find((p) => p !== forUserId) || null;
  const mine = (c.unreadCount || []).find((u) => u.user === forUserId);
  const lastMessageHiddenForViewer = !!(
    lastMessageDoc
    && Array.isArray(lastMessageDoc.deletedFor)
    && lastMessageDoc.deletedFor.includes(forUserId)
  );
  return {
    id: c._id.toString(),
    other_user_id: other,
    other_user: otherUserDoc ? toDiscoverUser(otherUserDoc) : null,
    last_message: (lastMessageDoc && !lastMessageHiddenForViewer) ? toMessage(lastMessageDoc) : null,
    last_message_at: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
    unread_count: mine ? mine.count : 0,
    created_at: c.createdAt ? c.createdAt.toISOString() : null,
  };
}

async function _findConversation(conversationId) {
  let conv = null;
  try { conv = await Conversation.findById(conversationId); } catch (_) { conv = null; }
  if (!conv) throw new NotFoundError('conversation not found');
  return conv;
}

function _assertParticipant(conv, userId) {
  if (!conv.participants.includes(userId)) {
    throw new FlameError('FORBIDDEN', 'not your conversation', 403);
  }
}

async function openConversation(userId, otherUserId) {
  if (otherUserId === userId) throw new ValidationError('cannot open a conversation with yourself');
  await visibility.assertCanInteract(userId, otherUserId);
  let other = null;
  try { other = await User.findById(otherUserId).lean(); } catch (_) { other = null; }
  if (!other) throw new NotFoundError('user not found');

  let conv = await Conversation.findOne({ participants: { $all: [userId, otherUserId], $size: 2 } });
  if (!conv) {
    conv = await Conversation.create({
      participants: [userId, otherUserId],
      unreadCount: [{ user: userId, count: 0 }, { user: otherUserId, count: 0 }],
    });
  }
  return toConversation(conv, userId, null, other);
}

async function listConversations(userId, { limit, offset }) {
  const filter = { participants: userId };
  // A blocked person must leave the list entirely, not just be un-messageable.
  // `$all` keeps "userId is a participant"; `$nin` drops any conversation whose
  // participants include someone on either side of a block. Written as one
  // assignment because it REPLACES the plain `participants: userId` above.
  const hidden = await visibility.blockedIdsFor(userId);
  if (hidden.length) filter.participants = { $all: [userId], $nin: hidden };
  const total = await Conversation.countDocuments(filter);
  const convs = await Conversation.find(filter)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .skip(offset)
    .limit(limit);
  const conversations = [];
  for (const c of convs) {
    const otherId = c.participants.find((p) => p !== userId);
    const otherUser = otherId ? await User.findById(otherId).lean() : null;
    const lm = c.lastMessage ? await Message.findById(c.lastMessage) : null;
    conversations.push(toConversation(c, userId, lm, otherUser));
  }
  return { conversations, total };
}

async function getMessages(userId, conversationId, { limit, offset }) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  const filter = { conversationId, isDeleted: false, deletedFor: { $ne: userId } };
  const total = await Message.countDocuments(filter);
  const msgs = await Message.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit);
  return { messages: msgs.map(toMessage), total };
}

async function sendMessage(userId, conversationId, { text, replyTo }) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  const receiver = conv.participants.find((p) => p !== userId);
  // An existing conversation predates the block, so membership alone is not
  // permission to keep writing into it. Checked before the reply_to validation
  // so a blocked sender learns nothing about the conversation's contents.
  await visibility.assertCanInteract(userId, receiver);
  if (replyTo) {
    let parent = null;
    try { parent = await Message.findById(replyTo); } catch (_) { parent = null; }
    if (!parent || parent.conversationId !== conversationId) {
      throw new ValidationError('reply_to must be a message in this conversation');
    }
  }
  const msg = await Message.create({
    conversationId, sender: userId, receiver, text, messageType: 'text',
    replyTo: replyTo || null,
  });
  conv.lastMessage = msg._id.toString();
  conv.lastMessageAt = msg.createdAt;
  const entry = conv.unreadCount.find((u) => u.user === receiver);
  if (entry) entry.count += 1;
  else conv.unreadCount.push({ user: receiver, count: 1 });
  await conv.save();
  return toMessage(msg);
}

async function markRead(userId, conversationId) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  const result = await Message.updateMany(
    { conversationId, receiver: userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  const entry = conv.unreadCount.find((u) => u.user === userId);
  if (entry) { entry.count = 0; await conv.save(); }
  return { marked: result.modifiedCount || 0 };
}

// Distinct ids of every user who shares a Conversation with userId ("chat partners").
async function partnerIdsOf(userId) {
  const convs = await Conversation.find({ participants: userId }).lean();
  const ids = new Set();
  for (const c of convs) {
    const other = (c.participants || []).find((p) => p !== userId);
    if (other) ids.add(other);
  }
  return [...ids];
}

async function _findMessage(messageId) {
  let m = null;
  try { m = await Message.findById(messageId); } catch (_) { m = null; }
  if (!m) throw new NotFoundError('message not found');
  return m;
}

function _assertMessageParticipant(m, userId) {
  if (m.sender !== userId && m.receiver !== userId) {
    throw new FlameError('FORBIDDEN', 'not your conversation', 403);
  }
}

async function addReaction(userId, messageId, emoji) {
  const m = await _findMessage(messageId);
  _assertMessageParticipant(m, userId);
  m.reactions = m.reactions.filter((r) => r.user !== userId);
  m.reactions.push({ user: userId, emoji });
  await m.save();
  return toMessage(m);
}

async function removeReaction(userId, messageId) {
  const m = await _findMessage(messageId);
  _assertMessageParticipant(m, userId);
  m.reactions = m.reactions.filter((r) => r.user !== userId);
  await m.save();
  return toMessage(m);
}

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

async function editMessage(userId, messageId, text) {
  const m = await _findMessage(messageId);
  if (m.sender !== userId) throw new FlameError('FORBIDDEN', 'not your message', 403);
  if (m.isDeleted) throw new ValidationError('cannot edit a deleted message');
  if (Date.now() - m.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new FlameError('EDIT_WINDOW_EXPIRED', 'edit window passed', 422);
  }
  m.text = text;
  m.isEdited = true;
  m.editedAt = new Date();
  await m.save();
  return toMessage(m);
}

async function deleteMessage(userId, messageId, scope) {
  const m = await _findMessage(messageId);
  _assertMessageParticipant(m, userId);
  if (scope === 'everyone') {
    if (m.sender !== userId) throw new FlameError('FORBIDDEN', 'not your message', 403);
    if (Date.now() - m.createdAt.getTime() > DELETE_WINDOW_MS) {
      throw new FlameError('DELETE_WINDOW_EXPIRED', 'delete window passed', 422);
    }
    m.isDeleted = true;
    m.text = '';
    await m.save();
    return {
      message: toMessage(m),
      scope: 'everyone',
      receiver_id: m.receiver === userId ? m.sender : m.receiver,
    };
  }
  if (!m.deletedFor.includes(userId)) {
    m.deletedFor.push(userId);
    await m.save();
  }
  return { message: toMessage(m), scope: 'me' };
}

module.exports = {
  openConversation, listConversations, getMessages, sendMessage, markRead,
  addReaction, removeReaction, editMessage, deleteMessage, partnerIdsOf,
  toConversation, toMessage,
};
