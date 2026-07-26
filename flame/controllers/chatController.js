const chatService = require('../services/chatService');

async function listConversations(req, res) {
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = parseInt(req.query.offset, 10) || 0;
  const { conversations, total } = await chatService.listConversations(req.user.id, { limit, offset });
  res.json({
    success: true,
    data: {
      conversations,
      pagination: { total, limit, offset, has_more: offset + conversations.length < total },
    },
  });
}

async function openConversation(req, res) {
  const data = await chatService.openConversation(req.user.id, req.body.user_id);
  res.status(201).json({ success: true, data });
}

async function getMessages(req, res) {
  const limit = parseInt(req.query.limit, 10) || 30;
  const offset = parseInt(req.query.offset, 10) || 0;
  const { messages, total } = await chatService.getMessages(req.user.id, req.params.id, { limit, offset });
  res.json({
    success: true,
    data: {
      messages,
      pagination: { total, limit, offset, has_more: offset + messages.length < total },
    },
  });
}

async function sendMessage(req, res) {
  const data = await chatService.sendMessage(req.user.id, req.params.id, {
    text: req.body.text,
    replyTo: req.body.reply_to,
  });
  // Best-effort realtime push to the receiver. Never let a socket issue fail
  // the REST send (which is the source of truth).
  try {
    const io = req.app.get('io');
    if (io) require('../socket/flameSocket').emitNewMessage(io, data.receiver_id, data);
  } catch (_) { /* realtime is best-effort */ }
  res.status(201).json({ success: true, data });
}

async function markRead(req, res) {
  const data = await chatService.markRead(req.user.id, req.params.id);
  res.json({ success: true, data });
}

async function addReaction(req, res) {
  const data = await chatService.addReaction(req.user.id, req.params.id, req.body.emoji);
  res.status(201).json({ success: true, data });
}

async function removeReaction(req, res) {
  const data = await chatService.removeReaction(req.user.id, req.params.id);
  res.json({ success: true, data });
}

module.exports = {
  listConversations, openConversation, getMessages, sendMessage, markRead,
  addReaction, removeReaction,
};
