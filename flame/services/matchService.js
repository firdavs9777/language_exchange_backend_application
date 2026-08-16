const Match = require('../models/Match');
const User = require('../models/User');
const visibility = require('./visibilityService');
const { NotFoundError } = require('../utils/errors');

const { toPublicMinimal } = require('./userService');

async function list(userId, { limit = 20, offset = 0 } = {}) {
  const hidden = await visibility.blockedIdsFor(userId);

  const filter = {
    // When there are hidden ids, $all requires userId to be a member of the
    // pair and $nin requires none of the pair's members to be blocked — this
    // replaces the plain `users: userId` below rather than adding to it, so it
    // is written as a single assignment instead of a duplicated object key.
    users: hidden.length ? { $all: [userId], $nin: hidden } : userId,
    endedBy: null,
  };

  const total = await Match.countDocuments(filter);
  const rows = await Match.find(filter)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const otherIds = rows.map((m) => m.users.find((u) => u !== userId));
  const users = await User.find({ _id: { $in: otherIds } }).lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  const matches = rows.map((m) => {
    const otherId = m.users.find((u) => u !== userId);
    const u = byId.get(otherId);
    return {
      id: m._id.toString(),
      user: u ? toPublicMinimal(u) : { id: otherId },
      matched_at: m.createdAt,
      // Always false in a listing: `is_new` drives the app's match-celebration
      // UI, and everything returned here existed before this request. Only the
      // swipe response reports a genuinely new match.
      is_new: false,
      last_message: null,
    };
  });

  return { matches, total };
}

async function unmatch(userId, matchId) {
  const match = await Match.findOne({ _id: matchId, users: userId });
  // 404 rather than 403 so a stranger cannot probe which match ids exist.
  if (!match) throw new NotFoundError('match not found');

  match.endedBy = userId;
  await match.save();
}

module.exports = { list, unmatch };
