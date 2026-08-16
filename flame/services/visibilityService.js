const User = require('../models/User');
const Swipe = require('../models/Swipe');
const { ForbiddenError } = require('../utils/errors');

// Single source of truth for "who is this user not allowed to see or reach".
//
// This exists as one module rather than eight scattered checks because a block
// has to hold on every surface that returns another user — discover, matches,
// conversation lists, message sends, SOCKET DELIVERY, the story feed and
// profile reads. Missing one leaks a blocked person straight back into view,
// and socket delivery is the easiest to forget because it bypasses REST.

// Hardened the same way areBlocked is, and for the same reason: blockService
// writes `blockedUsers` and `blockedBy` in two separate, non-atomic updates, so
// the viewer's own document can be missing half the relationship. Reading only
// the viewer's arrays would then leave the blocker visible on every LISTING
// surface (discover, matches, conversation list, story feed) even though
// areBlocked already refuses the interaction.
//
// The second query is the mirror of the first — "whose document names me" —
// and it is ONE query for the whole listing, not one per candidate.
async function blockedIdsFor(userId) {
  const out = new Set();

  const me = await User.findById(userId).select('blockedUsers blockedBy').lean();
  if (me) {
    for (const b of me.blockedUsers || []) out.add(b.user);
    for (const b of me.blockedBy || []) out.add(b.user);
  }

  const others = await User.find({
    $or: [{ 'blockedUsers.user': userId }, { 'blockedBy.user': userId }],
  })
    .select('_id')
    .lean();
  for (const u of others) out.add(u._id.toString());

  out.delete(userId);
  return [...out];
}

async function swipedIdsFor(userId) {
  const rows = await Swipe.find({ from: userId }).select('to').lean();
  return rows.map((r) => r.to);
}

async function excludedIdsFor(userId, { includeSwiped = false } = {}) {
  const blocked = await blockedIdsFor(userId);
  if (!includeSwiped) return blocked;
  const swiped = await swipedIdsFor(userId);
  return [...new Set([...blocked, ...swiped])];
}

// Checks BOTH users' documents rather than just `a`'s.
//
// blockService writes `blockedUsers` and `blockedBy` in two separate,
// non-atomic updates, so a crash between them can leave the pair diverged.
// Trusting one side would then let a blocked user slip through. A block holds
// if EITHER document records the relationship, so the guarantee does not
// depend on the mirror being perfect.
async function areBlocked(a, b) {
  const found = await User.findOne({
    $or: [
      { _id: a, $or: [{ 'blockedUsers.user': b }, { 'blockedBy.user': b }] },
      { _id: b, $or: [{ 'blockedUsers.user': a }, { 'blockedBy.user': a }] },
    ],
  })
    .select('_id')
    .lean();
  return !!found;
}

async function assertCanInteract(a, b) {
  if (await areBlocked(a, b)) {
    throw new ForbiddenError('interaction not allowed');
  }
}

module.exports = { blockedIdsFor, excludedIdsFor, areBlocked, assertCanInteract };
