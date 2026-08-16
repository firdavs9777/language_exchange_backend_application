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
  // Best-effort push notification to the receiver. Guarded no-op until
  // Firebase is configured for flame (see services/pushService.js) — never
  // let a push failure affect the REST send.
  try {
    require('../services/pushService')
      .sendChatMessage(data.receiver_id, {
        senderName: req.user.id,
        text: data.text,
        conversationId: data.conversation_id,
      })
      .catch(() => {});
  } catch (_) { /* push is best-effort */ }
  res.status(201).json({ success: true, data });
}

async function sendMedia(req, res) {
  const kind = req.mediaKind; // set by the route
  const file = req.files ? (req.files[kind] || [])[0] : req.file;
  const thumbnail = req.files ? (req.files.thumbnail || [])[0] : null;

  const message = await chatService.sendMediaMessage(
    req.user.id, req.params.id, kind, file,
    {
      replyTo: req.body.reply_to_id,
      thumbnail,
      duration: req.body.duration,
      width: req.body.width,
      height: req.body.height,
    },
  );
  res.status(201).json({ success: true, data: message });
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

async function editMessage(req, res) {
  const data = await chatService.editMessage(req.user.id, req.params.id, req.body.text);
  try {
    const io = req.app.get('io');
    if (io) {
      const otherId = data.sender_id === req.user.id ? data.receiver_id : data.sender_id;
      require('../socket/flameSocket').emitMessageEdited(io, otherId, data);
    }
  } catch (_) { /* realtime is best-effort */ }
  res.json({ success: true, data });
}

async function deleteMessage(req, res) {
  const result = await chatService.deleteMessage(req.user.id, req.params.id, req.query.scope || 'me');
  try {
    const io = req.app.get('io');
    if (io && result.scope === 'everyone') {
      require('../socket/flameSocket').emitMessageDeleted(io, result.receiver_id, result.message);
    }
  } catch (_) { /* realtime is best-effort */ }
  res.json({ success: true, data: result.message });
}

module.exports = {
  listConversations, openConversation, getMessages, sendMessage, sendMedia, markRead,
  addReaction, removeReaction, editMessage, deleteMessage,
};
