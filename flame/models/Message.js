const mongoose = require('mongoose');
const { getConn } = require('../db');

const reactionSchema = new mongoose.Schema(
  { user: { type: String, required: true }, emoji: { type: String, required: true } },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    sender: { type: String, required: true, index: true },
    receiver: { type: String, required: true },
    text: { type: String, default: '', maxlength: 2000 },
    messageType: {
      type: String,
      // 'sticker' is an emoji carried in `text`, not hosted artwork — the
      // model BananaTalk uses. It has no mediaUrl, so it needs no upload route.
      enum: ['text', 'image', 'video', 'audio', 'voice', 'sticker'],
      default: 'text',
    },
    // Media payload. Null on text messages, which is every message that
    // existed before this shipped — no migration needed.
    mediaUrl: { type: String, default: null },
    // S3 key kept alongside the URL so the object can be deleted later without
    // parsing it back out of the URL, which userService.deletePhoto has to do.
    mediaKey: { type: String, default: null },
    thumbnailUrl: { type: String, default: null },
    // Seconds, because that is the unit the shipped app sends and renders
    // (`_formatDuration(int seconds)` in message_bubble.dart). Do not switch it
    // to milliseconds without changing the app in the same release.
    durationSeconds: { type: Number, default: null },
    mediaWidth: { type: Number, default: null },
    mediaHeight: { type: Number, default: null },
    reactions: { type: [reactionSchema], default: [] },
    replyTo: { type: String, default: null },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedFor: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'messages' },
);

// `default_language: 'none'` disables stemming, which is the one deliberate
// divergence from BananaTalk's equivalent index. BananaTalk stems for a single
// study language; Flame's users chat in whatever they share, and stemming for
// the wrong language silently degrades matching. 'none' gives exact token
// matching across every language.
messageSchema.index({ text: 'text' }, { default_language: 'none' });

module.exports = getConn().model('Message', messageSchema);
