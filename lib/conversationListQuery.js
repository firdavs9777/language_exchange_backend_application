/**
 * Pure builder for the Mongo query used by getConversations (DM/chat list).
 * Extracted so the hub-exclusion behavior (Workstream D) is unit-testable
 * without a database — this module has no Mongoose/DB dependency.
 *
 * @param {String|Object} userId - requesting user's id
 * @param {Object} [filters]
 * @param {String} [filters.archived] - 'true' | 'false'
 * @param {String} [filters.muted] - 'true' | 'false'
 * @param {String} [filters.pinned] - 'true' | 'false'
 * @returns {Object} Mongo query object
 */
function buildConversationListQuery(userId, filters = {}) {
  const { archived, muted, pinned } = filters;

  const query = {
    participants: userId,
    // Exclude conversations deleted by this user - optimized query
    deletedBy: { $ne: userId },
    // Rooms — both seeded hubs (Workstream D) and user-created topic rooms
    // (Task 15) — live only in the Rooms tab, never in the DM/chat list. A
    // topic room is a normal Conversation the caller is a `participants`
    // member of (owner or joiner), so without this exclusion it would
    // otherwise leak into the regular DM list right alongside hubs.
    roomType: { $nin: ['hub', 'topic'] }
  };

  if (archived === 'true') {
    query.archivedBy = userId;
  } else if (archived === 'false') {
    query.archivedBy = { $ne: userId };
  }

  if (muted === 'true') {
    query['mutedBy.user'] = userId;
  } else if (muted === 'false') {
    query['mutedBy.user'] = { $ne: userId };
  }

  if (pinned === 'true') {
    query['pinnedBy.user'] = userId;
  } else if (pinned === 'false') {
    query['pinnedBy.user'] = { $ne: userId };
  }

  return query;
}

module.exports = { buildConversationListQuery };
