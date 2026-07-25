const mongoose = require('mongoose');
const { getConn } = require('../db');

// Ephemeral photo story. MongoDB's TTL monitor deletes the document shortly
// after `expiresAt` (24h after creation); reads still filter on expiry since
// TTL deletion isn't instantaneous.
const storySchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  mediaUrl:  { type: String, required: true },
  mediaKey:  { type: String, default: null },   // S3 key, kept so we can delete the object
  caption:   { type: String, maxlength: 200, default: null },
  expiresAt: { type: Date, required: true },
  viewerIds: { type: [String], default: [] },   // distinct viewers; viewCount derives from this
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: false },
  collection: 'stories',
});

storySchema.index({ userId: 1, expiresAt: -1 });
// TTL index: auto-delete once expiresAt is in the past.
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = getConn().model('Story', storySchema);
