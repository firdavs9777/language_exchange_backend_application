/**
 * Blocking Utility Functions
 *
 * Centralizes blocking logic for use across the application.
 * Ensures blocked users can't see each other's content.
 */

const User = require('../models/User');
const cache = require('../services/cacheService');

// Cache TTL for blocked users (2 minutes - short to catch new blocks quickly)
const BLOCKED_CACHE_TTL = 120;

/**
 * Get all blocked user IDs for a user (both directions)
 * Uses caching to reduce database queries
 * @param {string} userId - Current user's ID
 * @returns {Promise<string[]>} - Array of user IDs to exclude
 */
const getBlockedUserIds = async (userId) => {
  if (!userId) return [];

  const cacheKey = `blocked:${userId}`;

  return cache.get(cacheKey, async () => {
    try {
      const user = await User.findById(userId)
        .select('blockedUsers blockedBy')
        .lean();

      if (!user) return [];

      // Users this user has blocked
      const blockedByMe = (user.blockedUsers || []).map(b =>
        b.userId ? b.userId.toString() : b.toString()
      );

      // Users who have blocked this user
      const blockedMe = (user.blockedBy || []).map(b =>
        b.userId ? b.userId.toString() : b.toString()
      );

      // Combine and remove duplicates
      return [...new Set([...blockedByMe, ...blockedMe])];
    } catch (error) {
      console.error('Error getting blocked user IDs:', error);
      return [];
    }
  }, BLOCKED_CACHE_TTL);
};

/**
 * Invalidate blocked user cache when blocking status changes
 * @param {string} userId - User whose cache should be invalidated
 * @param {string} otherUserId - Optional other user to invalidate block status cache
 */
const invalidateBlockedCache = (userId, otherUserId = null) => {
  if (userId) {
    cache.invalidate(`blocked:${userId}`);
    // Also invalidate block status cache between these users
    if (otherUserId) {
      const sortedIds = [userId.toString(), otherUserId.toString()].sort();
      cache.invalidate(`blockStatus:${sortedIds[0]}:${sortedIds[1]}`);
    }
  }
};

/**
 * Check if two users are blocking each other
 * Uses caching to reduce database queries (30 second TTL)
 * @param {string} userId1 - First user's ID
 * @param {string} userId2 - Second user's ID
 * @returns {Promise<{isBlocked: boolean, blockedBy: string|null}>}
 */
const checkBlockStatus = async (userId1, userId2) => {
  // Sort IDs to create consistent cache key regardless of order
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  const cacheKey = `blockStatus:${sortedIds[0]}:${sortedIds[1]}`;

  return cache.get(cacheKey, async () => {
    try {
      const [user1, user2] = await Promise.all([
        User.findById(userId1).select('blockedUsers').lean(),
        User.findById(userId2).select('blockedUsers').lean()
      ]);

      const user1BlockedUser2 = (user1?.blockedUsers || []).some(
        b => (b.userId || b).toString() === userId2.toString()
      );

      const user2BlockedUser1 = (user2?.blockedUsers || []).some(
        b => (b.userId || b).toString() === userId1.toString()
      );

      return {
        isBlocked: user1BlockedUser2 || user2BlockedUser1,
        blockedBy: user1BlockedUser2 ? userId1 : (user2BlockedUser1 ? userId2 : null),
        iBlockedThem: user1BlockedUser2,
        theyBlockedMe: user2BlockedUser1
      };
    } catch (error) {
      console.error('Error checking block status:', error);
      return { isBlocked: false, blockedBy: null, iBlockedThem: false, theyBlockedMe: false };
    }
  }, 30); // 30 second TTL - short for responsiveness
};

/**
 * Build a MongoDB query that excludes blocked users
 * @param {object} baseQuery - The base query object
 * @param {string} userField - The field name containing user ID (e.g., 'user', 'sender')
 * @param {string[]} blockedIds - Array of blocked user IDs
 * @returns {object} - Modified query with blocking filter
 */
const addBlockingFilter = (baseQuery, userField, blockedIds) => {
  if (!blockedIds || blockedIds.length === 0) {
    return baseQuery;
  }
  
  // If query already has conditions, combine with $and
  if (Object.keys(baseQuery).length > 0) {
    return {
      $and: [
        baseQuery,
        { [userField]: { $nin: blockedIds } }
      ]
    };
  }
  
  return {
    ...baseQuery,
    [userField]: { $nin: blockedIds }
  };
};

/**
 * Filter an array of items to exclude blocked users
 * @param {Array} items - Array of items with user field
 * @param {string} userField - The field containing user ID or user object
 * @param {string[]} blockedIds - Array of blocked user IDs
 * @returns {Array} - Filtered array
 */
const filterBlockedItems = (items, userField, blockedIds) => {
  if (!blockedIds || blockedIds.length === 0) {
    return items;
  }
  
  return items.filter(item => {
    const userId = typeof item[userField] === 'object' 
      ? item[userField]._id?.toString() || item[userField].toString()
      : item[userField]?.toString();
    
    return !blockedIds.includes(userId);
  });
};

/**
 * Middleware to attach blocked IDs to request
 * Use this in routes to pre-fetch blocked IDs
 */
const attachBlockedIds = async (req, res, next) => {
  if (req.user && req.user._id) {
    req.blockedUserIds = await getBlockedUserIds(req.user._id);
  } else {
    req.blockedUserIds = [];
  }
  next();
};

module.exports = {
  getBlockedUserIds,
  checkBlockStatus,
  addBlockingFilter,
  filterBlockedItems,
  attachBlockedIds,
  invalidateBlockedCache
};

