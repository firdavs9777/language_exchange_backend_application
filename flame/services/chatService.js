const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { NotFoundError, ValidationError, FlameError } = require('../utils/errors');

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
    created_at: m.createdAt ? m.createdAt.toISOString() : null,
  };
}

function toConversation(c, forUserId, lastMessageDoc) {
  const other = c.participants.find((p) => p !== forUserId) || null;
  const mine = (c.unreadCount || []).find((u) => u.user === forUserId);
  return {
    id: c._id.toString(),
    other_user_id: other,
    last_message: lastMessageDoc ? toMessage(lastMessageDoc) : null,
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
  return toConversation(conv, userId, null);
}

async function listConversations(userId, { limit, offset }) {
  const filter = { participants: userId };
  const total = await Conversation.countDocuments(filter);
  const convs = await Conversation.find(filter)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .skip(offset)
    .limit(limit);
  const conversations = [];
  for (const c of convs) {
    const lm = c.lastMessage ? await Message.findById(c.lastMessage) : null;
    conversations.push(toConversation(c, userId, lm));
  }
  return { conversations, total };
}

async function getMessages(userId, conversationId, { limit, offset }) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  const filter = { conversationId, isDeleted: false };
  const total = await Message.countDocuments(filter);
  const msgs = await Message.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit);
  return { messages: msgs.map(toMessage), total };
}

async function sendMessage(userId, conversationId, { text, replyTo }) {
  const conv = await _findConversation(conversationId);
  _assertParticipant(conv, userId);
  if (replyTo) {
    let parent = null;
    try { parent = await Message.findById(replyTo); } catch (_) { parent = null; }
    if (!parent || parent.conversationId !== conversationId) {
      throw new ValidationError('reply_to must be a message in this conversation');
    }
  }
  const receiver = conv.participants.find((p) => p !== userId);
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

module.exports = {
  openConversation, listConversations, getMessages, sendMessage, markRead,
  addReaction, removeReaction,
  toConversation, toMessage,
};
