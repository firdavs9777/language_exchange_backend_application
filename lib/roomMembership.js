/**
 * Pure decision logic for Workstream D language-room ("hub") membership.
 *
 * Extracted from controllers/rooms.js so the tricky bits — auto-join
 * idempotency, sticky-leave, admin gating, directory sort — are unit
 * testable without a database. Every function here is side-effect free:
 * callers (controllers/rooms.js) translate the returned decision into the
 * actual Mongo $addToSet/$pull/$inc writes.
 */

const { normalizeLanguage } = require('./normalizeLanguage');

function idsEqual(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return a.toString() === b.toString();
}

function includesId(list, id) {
  if (!Array.isArray(list)) return false;
  return list.some((item) => idsEqual(item, id));
}

/**
 * Decide whether autoJoinMatchingHub should add `user` to `hub`.
 *
 * @param {Object} user - must have `_id`, `language_to_learn`, `leftHubs` (array)
 * @param {Object|null} hub - the hub matching the user's normalized target
 *   language (or null if none exists yet). Must have `_id`, `participants`.
 * @returns {{ shouldJoin: boolean, reason: string, canonicalLanguage: string|null }}
 */
function decideAutoJoin(user, hub) {
  const canonicalLanguage = normalizeLanguage(user?.language_to_learn);

  if (!canonicalLanguage) {
    return { shouldJoin: false, reason: 'no-canonical-language', canonicalLanguage: null };
  }

  if (!hub) {
    return { shouldJoin: false, reason: 'no-matching-hub', canonicalLanguage };
  }

  if (includesId(user.leftHubs, hub._id)) {
    return { shouldJoin: false, reason: 'left-hub', canonicalLanguage };
  }

  if (includesId(hub.participants, user._id)) {
    return { shouldJoin: false, reason: 'already-member', canonicalLanguage };
  }

  return { shouldJoin: true, reason: 'matched', canonicalLanguage };
}

/**
 * Decide the effect of an explicit POST /rooms/:id/join.
 * @param {String|Object} userId
 * @param {Object} hub - must have `participants` (array)
 * @returns {{ isNewMember: boolean }}
 */
function decideJoin(userId, hub) {
  return { isNewMember: !includesId(hub?.participants, userId) };
}

/**
 * Decide the effect of an explicit POST /rooms/:id/leave.
 * @param {String|Object} userId
 * @param {Object} hub - must have `participants` (array)
 * @returns {{ wasMember: boolean }}
 */
function decideLeave(userId, hub) {
  return { wasMember: includesId(hub?.participants, userId) };
}

/**
 * Owner-or-admin gate used by removeMember/muteMember/updateRoom.
 * @param {String|Object} userId
 * @param {Object} hub - must have `owner`, `admins` (array)
 * @returns {boolean}
 */
function isRoomAdmin(userId, hub) {
  if (!hub) return false;
  if (idsEqual(hub.owner, userId)) return true;
  return includesId(hub.admins, userId);
}

/**
 * Sort hubs for the directory: the caller's own matching-language hub first
 * (if present among `rooms`), then the rest by memberCount desc. Does not
 * mutate the input array.
 *
 * @param {Array<Object>} rooms - each with `targetLanguage`, `memberCount`
 * @param {String|null} callerLanguage - normalized target language, or null
 * @returns {Array<Object>}
 */
function sortRoomsForCaller(rooms, callerLanguage) {
  const copy = [...(rooms || [])];
  copy.sort((a, b) => {
    if (callerLanguage) {
      const aMatch = a.targetLanguage === callerLanguage;
      const bMatch = b.targetLanguage === callerLanguage;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
    }
    return (b.memberCount || 0) - (a.memberCount || 0);
  });
  return copy;
}

/**
 * ROOMS_ENABLED kill switch — centralized in config/limitations.js (Task 7).
 * Re-requires that module fresh on every call (rather than destructuring it
 * once at the top of this file) so tests can toggle process.env.ROOMS_ENABLED
 * and observe the change by clearing require.cache for
 * config/limitations.js, the same pattern already used for
 * process.env.AI_QUOTA_ENABLED elsewhere in this codebase.
 *
 * @returns {boolean}
 */
function getRoomsEnabled() {
  return require('../config/limitations').ROOMS_ENABLED;
}

/**
 * Express middleware: short-circuits every /api/v1/rooms route to a 404
 * when ROOMS_ENABLED is false. Extracted as a plain (req, res, next)
 * function — rather than inlined in routes/rooms.js — so it's unit
 * testable with mock req/res objects without loading Express or the
 * auth/jsonwebtoken chain that routes/rooms.js pulls in transitively.
 *
 * @param {Object} req
 * @param {Object} res - must have `.status(code).json(body)`
 * @param {Function} next
 */
function roomsEnabledGuard(req, res, next) {
  if (!getRoomsEnabled()) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
}

module.exports = {
  decideAutoJoin,
  decideJoin,
  decideLeave,
  isRoomAdmin,
  sortRoomsForCaller,
  getRoomsEnabled,
  roomsEnabledGuard
};
