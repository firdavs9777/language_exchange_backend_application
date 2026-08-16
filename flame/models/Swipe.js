const mongoose = require('mongoose');
const { getConn } = require('../db');

// One row per swipe decision. Append-only: this is the record of everything a
// user has already seen, so Discover can stop re-showing them.
//
// Its own collection rather than an array on User: an active swiper generates
// thousands of rows, which would push the user document toward Mongo's 16MB
// ceiling and turn "has A swiped B?" into an array scan instead of an index hit.
const swipeSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    action: { type: String, enum: ['like', 'pass', 'super'], required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false }, collection: 'swipes' },
);

// Makes "already swiped?" an index hit, and makes a double-tap physically
// unable to create two rows — the controller relies on this for idempotency.
swipeSchema.index({ from: 1, to: 1 }, { unique: true });

// Powers mutual detection ("did `to` already like `from`?") and a future
// "who liked you" list.
swipeSchema.index({ to: 1, action: 1 });

module.exports = getConn().model('Swipe', swipeSchema);
