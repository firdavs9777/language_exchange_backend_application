const User = require('../models/User');
const { ValidationError, NotFoundError } = require('../utils/errors');

// Both directions are written together so the two arrays can never disagree.
// $addToSet-style guarding is done with an explicit filter because the entries
// are subdocuments (with a timestamp), so $addToSet would not dedupe them.
async function block(userId, targetId) {
  if (userId === targetId) throw new ValidationError('cannot block yourself');

  const target = await User.findById(targetId);
  if (!target || target.isDeleted) throw new NotFoundError('user not found');

  const now = new Date();
  await User.updateOne(
    { _id: userId, 'blockedUsers.user': { $ne: targetId } },
    { $push: { blockedUsers: { user: targetId, blockedAt: now } } },
  );
  await User.updateOne(
    { _id: targetId, 'blockedBy.user': { $ne: userId } },
    { $push: { blockedBy: { user: userId, blockedAt: now } } },
  );

  // A block is a complete severance, not a partial one: end any live match so
  // the pair leaves both users' match lists instead of lingering as a match
  // neither side can act on. Required lazily so blockService does not pull the
  // Match model into every module that only needs listBlocked.
  const Match = require('../models/Match');
  await Match.updateOne(
    { users: Match.pair(userId, targetId), endedBy: null },
    { $set: { endedBy: userId } },
  );
}

async function unblock(userId, targetId) {
  await User.updateOne({ _id: userId }, { $pull: { blockedUsers: { user: targetId } } });
  await User.updateOne({ _id: targetId }, { $pull: { blockedBy: { user: userId } } });
}

async function listBlocked(userId) {
  const me = await User.findById(userId).lean();
  if (!me) throw new NotFoundError('user not found');

  const ids = (me.blockedUsers || []).map((b) => b.user);
  if (ids.length === 0) return [];

  const users = await User.find({ _id: { $in: ids } }).lean();
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return (me.blockedUsers || []).map((b) => {
    const u = byId.get(b.user);
    const primary = u && (u.photos || []).find((p) => p.isPrimary);
    return {
      id: b.user,
      name: u ? u.name : null,
      photo: primary ? primary.url : null,
      blocked_at: b.blockedAt,
    };
  });
}

module.exports = { block, unblock, listBlocked };
