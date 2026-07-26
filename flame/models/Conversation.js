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
  },
  { timestamps: true, collection: 'conversations' },
);

module.exports = getConn().model('Conversation', conversationSchema);
