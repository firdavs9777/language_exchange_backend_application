const Story = require('../models/Story');

// Privacy levels whose stories are ever eligible to light a story ring for
// someone other than the owner. `close_friends` is deliberately excluded —
// those stories never surface a ring for non-close viewers, so the DB query
// never even fetches them.
const VISIBLE_PRIVACIES = ['public', 'friends'];

/**
 * Pure decision function (no DB access): given raw story docs (each with a
 * `user` id and a `privacy` string) and the Set of user-id strings the
 * viewer follows, return the Set of owner id strings whose story should be
 * visible to the viewer.
 *
 * - `public` stories are always visible.
 * - `friends` stories are visible only when the viewer follows the owner.
 */
function visibleOwners(stories, followingSet) {
  const following = followingSet || new Set();
  const result = new Set();
  for (const s of stories) {
    const owner = typeof s.user === 'string' ? s.user : s.user.toString();
    if (s.privacy === 'public' || following.has(owner)) {
      result.add(owner);
    }
  }
  return result;
}

/**
 * Returns Set<userIdString> of users (from userIds) who have >=1 active,
 * unexpired story VISIBLE to viewerId: privacy 'public' always; 'friends'
 * only when the viewer follows the owner (followingIds contains owner).
 * close_friends stories never light the ring for non-close viewers.
 *
 * Batched: exactly one query regardless of how many userIds are passed in
 * (callers stamp `hasActiveStory` on a whole page of users from a single
 * call — no N+1).
 */
async function usersWithVisibleActiveStory(userIds, viewerId, followingIds = []) {
  if (!userIds || !userIds.length) return new Set();
  const now = new Date();
  const following = new Set((followingIds || []).map(String));
  const stories = await Story.find({
    user: { $in: userIds },
    isActive: true,
    expiresAt: { $gt: now },
    privacy: { $in: VISIBLE_PRIVACIES },
  }).select('user privacy').lean();
  return visibleOwners(stories, following);
}

module.exports = { usersWithVisibleActiveStory, visibleOwners, VISIBLE_PRIVACIES };
