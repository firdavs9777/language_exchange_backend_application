const mongoose = require('mongoose');
const { getConn } = require('../db');

// A mutual like. `users` is ALWAYS stored sorted, which is what makes a match
// unique regardless of who swiped first — with the unique index below there is
// exactly one row per pair, and no code anywhere needs to ask "did A match B or
// B match A?".
const matchSchema = new mongoose.Schema(
  {
    users: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2 && v[0] !== v[1],
        message: 'users must be exactly 2 distinct ids',
      },
    },
    conversationId: { type: String, required: true },
    // Set when either side unmatches. The row is kept rather than deleted so
    // the swipe history stays meaningful and the pair does not reappear in
    // Discover.
    endedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, collection: 'matches' },
);

matchSchema.index({ users: 1 }, { unique: true });

// Canonical ordering for a pair. Every caller must build `users` through this.
matchSchema.statics.pair = function pair(a, b) {
  return [a, b].sort();
};

module.exports = getConn().model('Match', matchSchema);
