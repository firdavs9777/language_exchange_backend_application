const mongoose = require('mongoose');
const { getConn } = require('../db');

const matchSchema = new mongoose.Schema(
  {
    users: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2 && v[0] < v[1],
        message: 'users must be exactly 2 distinct ids in sorted order — build it with Match.pair()',
      },
    },
    // Scalar identity for the pair, derived from `users`.
    //
    // A unique index on `users` itself cannot work: because `users` is an
    // array, Mongo builds a MULTIKEY index and enforces uniqueness per
    // ELEMENT, which would cap every user at one match ever. Uniqueness
    // therefore lives on this scalar.
    pairKey: { type: String, required: true, unique: true },
    conversationId: { type: String, required: true },
    // Set when either side unmatches. The row is kept rather than deleted so
    // the swipe history stays meaningful and the pair does not reappear in
    // Discover.
    endedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, collection: 'matches' },
);

// Non-unique: still needed for "every match this user is in" lookups.
matchSchema.index({ users: 1 });

// Derived rather than caller-supplied, so pairKey can never disagree with
// users and no caller has to know it exists.
matchSchema.pre('validate', function setPairKey(next) {
  if (Array.isArray(this.users) && this.users.length === 2) {
    this.pairKey = [...this.users].sort().join(':');
  }
  next();
});

// Canonical ordering for a pair. Every caller must build `users` through this.
matchSchema.statics.pair = function pair(a, b) {
  return [a, b].sort();
};

module.exports = getConn().model('Match', matchSchema);
