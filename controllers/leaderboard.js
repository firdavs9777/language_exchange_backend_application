/**
 * Leaderboard Controller
 *
 * Gamification leaderboards for:
 * - XP (overall and by language)
 * - Streaks (current and longest)
 * - Weekly/Monthly/All-time
 */

const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const LearningProgress = require('../models/LearningProgress');
const cache = require('../services/redisService');
const mongoose = require('mongoose');

// Cache TTLs
const LEADERBOARD_CACHE_TTL = 300; // 5 minutes
const USER_RANK_CACHE_TTL = 60; // 1 minute

/**
 * @desc    Get XP leaderboard
 * @route   GET /api/v1/leaderboard/xp
 * @access  Private
 */
exports.getXPLeaderboard = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { period = 'all', language, limit = 50, offset = 0 } = req.query;

  const cacheKey = `xp:${period}:${language || 'all'}:${limit}:${offset}`;

  const result = await cache.get(cacheKey, async () => {
    // Build match criteria
    const matchCriteria = { isRegistrationComplete: true };

    if (language) {
      matchCriteria.$or = [
        { native_language: language },
        { language_to_learn: language }
      ];
    }

    // Date filter for period
    let dateFilter = {};
    const now = new Date();
    if (period === 'weekly') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { lastActive: { $gte: weekAgo } };
    } else if (period === 'monthly') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { lastActive: { $gte: monthAgo } };
    }

    // Aggregate leaderboard from LearningProgress
    const leaderboard = await LearningProgress.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $match: {
          'userInfo.isRegistrationComplete': true,
          ...dateFilter
        }
      },
      {
        $project: {
          user: '$user',
          name: '$userInfo.name',
          username: '$userInfo.username',
          avatar: { $arrayElemAt: ['$userInfo.images', 0] },
          country: '$userInfo.location.country',
          nativeLanguage: '$userInfo.native_language',
          learningLanguage: '$userInfo.language_to_learn',
          totalXP: 1,
          currentStreak: 1,
          level: {
            $floor: { $add: [1, { $divide: ['$totalXP', 1000] }] }
          }
        }
      },
      { $sort: { totalXP: -1 } },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) }
    ]);

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: parseInt(offset) + index + 1,
      ...entry
    }));

    // Get total count
    const totalCount = await LearningProgress.countDocuments();

    return {
      leaderboard: rankedLeaderboard,
      total: totalCount,
      period,
      language: language || 'all'
    };
  }, LEADERBOARD_CACHE_TTL);

  // Get current user's rank
  const userRank = await getUserRank(userId, 'xp');

  res.status(200).json({
    success: true,
    data: {
      ...result,
      myRank: userRank
    }
  });
});

/**
 * @desc    Get streak leaderboard
 * @route   GET /api/v1/leaderboard/streaks
 * @access  Private
 */
exports.getStreakLeaderboard = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { type = 'current', limit = 50, offset = 0 } = req.query;

  const cacheKey = `streaks:${type}:${limit}:${offset}`;
  const sortField = type === 'longest' ? 'longestStreak' : 'currentStreak';

  const result = await cache.get(cacheKey, async () => {
    const leaderboard = await LearningProgress.aggregate([
      {
        $match: {
          [sortField]: { $gt: 0 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $match: {
          'userInfo.isRegistrationComplete': true
        }
      },
      {
        $project: {
          user: '$user',
          name: '$userInfo.name',
          username: '$userInfo.username',
          avatar: { $arrayElemAt: ['$userInfo.images', 0] },
          country: '$userInfo.location.country',
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: 1
        }
      },
      { $sort: { [sortField]: -1 } },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) }
    ]);

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: parseInt(offset) + index + 1,
      streakDays: entry[sortField],
      ...entry
    }));

    const totalCount = await LearningProgress.countDocuments({
      [sortField]: { $gt: 0 }
    });

    return {
      leaderboard: rankedLeaderboard,
      total: totalCount,
      type
    };
  }, LEADERBOARD_CACHE_TTL);

  // Get current user's rank
  const userRank = await getUserRank(userId, `streak_${type}`);

  res.status(200).json({
    success: true,
    data: {
      ...result,
      myRank: userRank
    }
  });
});

/**
 * @desc    Get language-specific leaderboard
 * @route   GET /api/v1/leaderboard/language/:language
 * @access  Private
 */
exports.getLanguageLeaderboard = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const cacheKey = `lang:${language}:${limit}:${offset}`;

  const result = await cache.get(cacheKey, async () => {
    const leaderboard = await LearningProgress.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $match: {
          'userInfo.isRegistrationComplete': true,
          'userInfo.language_to_learn': language
        }
      },
      {
        $project: {
          user: '$user',
          name: '$userInfo.name',
          username: '$userInfo.username',
          avatar: { $arrayElemAt: ['$userInfo.images', 0] },
          nativeLanguage: '$userInfo.native_language',
          totalXP: 1,
          currentStreak: 1,
          level: {
            $floor: { $add: [1, { $divide: ['$totalXP', 1000] }] }
          }
        }
      },
      { $sort: { totalXP: -1 } },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) }
    ]);

    // Add rank
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      rank: parseInt(offset) + index + 1,
      ...entry
    }));

    return {
      leaderboard: rankedLeaderboard,
      language
    };
  }, LEADERBOARD_CACHE_TTL);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get user's position in various leaderboards
 * @route   GET /api/v1/leaderboard/me
 * @access  Private
 */
exports.getMyRanks = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const cacheKey = `myranks:${userId}`;

  const result = await cache.get(cacheKey, async () => {
    // Get user's learning progress
    const progress = await LearningProgress.findOne({ user: userId });

    if (!progress) {
      return {
        xp: { rank: null, total: 0 },
        streak: { rank: null, total: 0 },
        stats: { totalXP: 0, currentStreak: 0, longestStreak: 0, level: 1 }
      };
    }

    // Calculate XP rank
    const xpRank = await LearningProgress.countDocuments({
      totalXP: { $gt: progress.totalXP }
    }) + 1;

    const totalXPUsers = await LearningProgress.countDocuments({
      totalXP: { $gt: 0 }
    });

    // Calculate streak rank
    const streakRank = await LearningProgress.countDocuments({
      currentStreak: { $gt: progress.currentStreak }
    }) + 1;

    const totalStreakUsers = await LearningProgress.countDocuments({
      currentStreak: { $gt: 0 }
    });

    return {
      xp: { rank: xpRank, total: totalXPUsers, value: progress.totalXP },
      streak: { rank: streakRank, total: totalStreakUsers, value: progress.currentStreak },
      stats: {
        totalXP: progress.totalXP,
        currentStreak: progress.currentStreak,
        longestStreak: progress.longestStreak,
        level: Math.floor(1 + progress.totalXP / 1000),
        streakFreezes: progress.streakFreezes
      }
    };
  }, USER_RANK_CACHE_TTL);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get friends leaderboard
 * @route   GET /api/v1/leaderboard/friends
 * @access  Private
 */
exports.getFriendsLeaderboard = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { type = 'xp' } = req.query;

  // Get user's friends (followers + following)
  const user = await User.findById(userId).select('followers following');
  const friendIds = [
    ...new Set([
      ...(user.followers || []).map(f => f.toString()),
      ...(user.following || []).map(f => f.toString()),
      userId // Include self
    ])
  ];

  const sortField = type === 'streak' ? 'currentStreak' : 'totalXP';

  const leaderboard = await LearningProgress.aggregate([
    {
      $match: {
        user: { $in: friendIds.map(id => new mongoose.Types.ObjectId(id)) }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    { $unwind: '$userInfo' },
    {
      $project: {
        user: '$user',
        name: '$userInfo.name',
        username: '$userInfo.username',
        avatar: { $arrayElemAt: ['$userInfo.images', 0] },
        totalXP: 1,
        currentStreak: 1,
        level: {
          $floor: { $add: [1, { $divide: ['$totalXP', 1000] }] }
        },
        isMe: { $eq: ['$user', new mongoose.Types.ObjectId(userId)] }
      }
    },
    { $sort: { [sortField]: -1 } }
  ]);

  // Add rank
  const rankedLeaderboard = leaderboard.map((entry, index) => ({
    rank: index + 1,
    ...entry
  }));

  res.status(200).json({
    success: true,
    data: {
      leaderboard: rankedLeaderboard,
      type
    }
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get user's rank for a specific leaderboard type
 */
async function getUserRank(userId, type) {
  const cacheKey = `rank:${type}:${userId}`;

  return cache.get(cacheKey, async () => {
    const progress = await LearningProgress.findOne({ user: userId });
    if (!progress) return null;

    let rank;
    if (type === 'xp') {
      rank = await LearningProgress.countDocuments({
        totalXP: { $gt: progress.totalXP }
      }) + 1;
    } else if (type === 'streak_current') {
      rank = await LearningProgress.countDocuments({
        currentStreak: { $gt: progress.currentStreak }
      }) + 1;
    } else if (type === 'streak_longest') {
      rank = await LearningProgress.countDocuments({
        longestStreak: { $gt: progress.longestStreak }
      }) + 1;
    }

    return {
      rank,
      value: type === 'xp' ? progress.totalXP :
             type === 'streak_current' ? progress.currentStreak :
             progress.longestStreak
    };
  }, USER_RANK_CACHE_TTL);
}
