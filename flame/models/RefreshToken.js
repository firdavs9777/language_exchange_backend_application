const mongoose = require('mongoose');
const { getConn } = require('../db');

const schema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  tokenJti:  { type: String, required: true, unique: true },
  isRevoked: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false },
  collection: 'refresh_tokens',
});

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = getConn().model('RefreshToken', schema);
