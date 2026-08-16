const mongoose = require('mongoose');
const { getConn } = require('../db');

const unreadSchema = new mongoose.Schema(
  { user: { type: String, required: true }, count: { type: Number, default: 0 } },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: 'participants must have exactly 2 users',
      },
      index: true,
    },
    lastMessage: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
    unreadCount: { type: [unreadSchema], default: [] },

    // Per-user, not per-conversation: muting, pinning and archiving are one
    // participant's choice and must not change what the other sees. Shape
    // copied from BananaTalk's Conversation, which is proven in production.
    mutedBy: {
      type: [{
        user: { type: String, required: true },
        mutedUntil: { type: Date, default: null }, // null = indefinite
        mutedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    pinnedBy: {
      type: [{
        user: { type: String, required: true },
        messageId: { type: String, required: true },
        pinnedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    archivedBy: {
      type: [{
        user: { type: String, required: true },
        archivedAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
  },
  { timestamps: true, collection: 'conversations' },
);

module.exports = getConn().model('Conversation', conversationSchema);
