const chatService = require('../services/chatService');
const conversationControlsService = require('../services/conversationControlsService');

async function searchMessages(req, res) {
  const { messages, total } = await require('../services/messageSearchService')
    .search(req.user.id, {
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
    });

  res.json({
    success: true,
    data: {
      // conversation_id rides along because a result the caller cannot
      // navigate to is not a result; toMessage does not carry it.
      messages: messages.map((m) => ({
        ...chatService.toMessage(m),
        conversation_id: m.conversationId,
      })),
      total,
    },
  });
}

async function listPinned(req, res) {
  const data = await require('../services/conversationControlsService')
    .listPinned(req.user.id, req.params.id);
  res.json({ success: true, data });
}

async function archiveConversation(req, res) {
  const data = await chatService.archiveConversation(req.user.id, req.params.id);
  res.json({ success: true, data });
}

async function unarchiveConversation(req, res) {
  const data = await chatService.unarchiveConversation(req.user.id, req.params.id);
  res.json({ success: true, data });
}

async function listConversations(req, res) {
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = parseInt(req.query.offset, 10) || 0;
  // Archive is per-user filing: the same list endpoint serves both sides of
  // the line rather than a separate archived endpoint that could drift from it.
  const archived = req.query.archived === 'true';
  const { conversations, total } = await chatService.listConversations(
    req.user.id, { limit, offset, archived },
  );
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
  const before = req.query.before || null;
  const { messages, total, hasMore } = await chatService.getMessages(
    req.user.id, req.params.id, { limit, offset, before },
  );

  // `total` and `offset` are echoed only on the legacy path, so a cursor
  // response never carries a field it did not compute.
  const pagination = { limit, has_more: hasMore ?? (offset + messages.length < total) };
  if (total !== undefined) {
    pagination.total = total;
    pagination.offset = offset;
  }
  res.json({ success: true, data: { messages, pagination } });
}

async function sendMessage(req, res) {
  const data = await chatService.sendMessage(req.user.id, req.params.id, {
    text: req.body.text,
    replyTo: req.body.reply_to,
    messageType: req.body.message_type,
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
  // Identical best-effort realtime + push blocks to sendMessage's. Without
  // them a received photo or voice note did not appear in the recipient's
  // list, did not move the unread badge, did not appear in an open chat (the
  // REST poll is disabled whenever realtime is on) and fired no notification —
  // a media message was silently a second-class citizen.
  try {
    const io = req.app.get('io');
    if (io) require('../socket/flameSocket').emitNewMessage(io, message.receiver_id, message);
  } catch (_) { /* realtime is best-effort */ }
  try {
    require('../services/pushService')
      .sendChatMessage(message.receiver_id, {
        senderName: req.user.id,
        // A media message has no text, so the push body is the bracketed kind
        // preview rather than an empty string.
        text: `[${kind}]`,
        conversationId: message.conversation_id,
      })
      .catch(() => {});
  } catch (_) { /* push is best-effort */ }
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

const MS_PER_HOUR = 60 * 60 * 1000;

// Two body shapes, one meaning. `duration_hours` is what the shipped app
// sends; `duration` is milliseconds, the unit conversationControlsService
// itself takes. Neither present means an indefinite mute.
//
// duration_hours: 0 is treated as an UNMUTE, not a zero-length mute. Clients
// already in users' hands post exactly `{ duration_hours: 0 }` to this route
// as their unmute (DELETE /mute is the canonical path, and newer app builds
// use it) — reading that as "mute until now", which the service would store as
// an already-expired mutedUntil, is harmless, but reading it as "mute
// forever" would silence a conversation the user just asked to hear again.
async function muteConversation(req, res) {
  const hours = req.body.duration_hours;
  if (hours === 0) {
    await conversationControlsService.unmute(req.user.id, req.params.id);
    return res.status(201).json({ success: true, data: { muted_until: null } });
  }
  const durationMs = typeof hours === 'number'
    ? Math.round(hours * MS_PER_HOUR)
    : req.body.duration;
  const data = await conversationControlsService.mute(req.user.id, req.params.id, durationMs);
  return res.status(201).json({ success: true, data });
}

async function unmuteConversation(req, res) {
  await conversationControlsService.unmute(req.user.id, req.params.id);
  res.json({ success: true, data: null });
}

async function pinMessage(req, res) {
  const data = await conversationControlsService.pinMessage(req.user.id, req.params.id, req.body.message_id);
  res.status(201).json({ success: true, data });
}

async function unpinMessage(req, res) {
  const data = await conversationControlsService.unpinMessage(req.user.id, req.params.id, req.params.messageId);
  res.json({ success: true, data });
}

module.exports = {
  listConversations, openConversation, getMessages, sendMessage, sendMedia, markRead,
  addReaction, removeReaction, editMessage, deleteMessage,
  muteConversation, unmuteConversation, pinMessage, unpinMessage,
  archiveConversation, unarchiveConversation, searchMessages, listPinned,
};
