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
    messageType: { type: String, enum: ['text'], default: 'text' },
    reactions: { type: [reactionSchema], default: [] },
    replyTo: { type: String, default: null },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedFor: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'messages' },
);

module.exports = getConn().model('Message', messageSchema);
