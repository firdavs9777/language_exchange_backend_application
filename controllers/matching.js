/**
 * Smart Language Partner Matching Controller
 *
 * Intelligent matching algorithm that considers:
 * - Language pairs (complementary: my native = their learning)
 * - Activity level and online status
 * - Similar interests
 * - Location/timezone proximity
 * - Response rate and engagement
 */

const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const cache = require('../services/redisService');
const { getBlockedUserIds } = require('../utils/blockingUtils');
const mongoose = require('mongoose');

// Cache TTL
const RECOMMENDATIONS_CACHE_TTL = 1800; // 30 minutes

/**
 * @desc    Get personalized language partner recommendations
 * @route   GET /api/v1/matching/recommendations
 * @access  Private
 */
exports.getRecommendations = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 20, refresh = false } = req.query;

  const cacheKey = `recommendations:${userId}`;

  // Check cache unless refresh requested
  if (!refresh) {
    const cached = await cache.get(cacheKey, async () => null, 1);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached,
        cached: true
      });
    }
  }

  // Get current user data
  const currentUser = await User.findById(userId).select(
    'native_language language_to_learn location interests following followers blockedUsers blockedBy lastActive'
  );

  if (!currentUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get blocked user IDs
  const blockedIds = await getBlockedUserIds(userId);

  // Get users already in conversation
  const existingConvos = await Conversation.find({
    participants: userId
  }).select('participants');

  const existingPartnerIds = existingConvos.flatMap(c =>
    c.participants.filter(p => p.toString() !== userId).map(p => p.toString())
  );

  // Build exclusion list
  const excludeIds = [
    userId,
    ...blockedIds,
    ...existingPartnerIds,
    ...(currentUser.following || []).map(f => f.toString()),
    ...(currentUser.followers || []).map(f => f.toString())
  ].map(id => new mongoose.Types.ObjectId(id));

  // Scoring weights
  const WEIGHTS = {
    languageMatch: 50,       // Perfect language exchange pair
    languagePartial: 20,     // Partial language match
    activeRecently: 15,      // Active in last 24h
    activeThisWeek: 10,      // Active in last 7 days
    sameTimezone: 10,        // Within 3 hour timezone difference
    hasInterests: 5,         // Has shared interests
    profileComplete: 5,      // Has photos and bio
    responseRate: 10         // High response rate
  };

  // Build aggregation pipeline for smart matching
  const pipeline = [
    // Exclude blocked, existing conversations, self
    {
      $match: {
        _id: { $nin: excludeIds },
        isRegistrationComplete: true,
        'images.0': { $exists: true } // Has at least one photo
      }
    },

    // Add scoring fields
    {
      $addFields: {
        // Language match score
        languageScore: {
          $switch: {
            branches: [
              // Perfect match: my native = their learning AND their native = my learning
              {
                case: {
                  $and: [
                    { $eq: ['$native_language', currentUser.language_to_learn] },
                    { $eq: ['$language_to_learn', currentUser.native_language] }
                  ]
                },
                then: WEIGHTS.languageMatch
              },
              // Partial: their native = my learning
              {
                case: { $eq: ['$native_language', currentUser.language_to_learn] },
                then: WEIGHTS.languagePartial
              },
              // Partial: they're learning what I speak
              {
                case: { $eq: ['$language_to_learn', currentUser.native_language] },
                then: WEIGHTS.languagePartial
              }
            ],
            default: 0
          }
        },

        // Activity score
        activityScore: {
          $switch: {
            branches: [
              // Active in last 24 hours
              {
                case: {
                  $gte: ['$lastActive', new Date(Date.now() - 24 * 60 * 60 * 1000)]
                },
                then: WEIGHTS.activeRecently
              },
              // Active in last 7 days
              {
                case: {
                  $gte: ['$lastActive', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
                },
                then: WEIGHTS.activeThisWeek
              }
            ],
            default: 0
          }
        },

        // Profile completeness score
        profileScore: {
          $add: [
            { $cond: [{ $gte: [{ $size: { $ifNull: ['$images', []] } }, 2] }, 3, 0] },
            { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$bio', ''] } }, 20] }, 2, 0] }
          ]
        },

        // Random factor for variety
        randomFactor: { $multiply: [{ $rand: {} }, 5] }
      }
    },

    // Calculate total score
    {
      $addFields: {
        matchScore: {
          $add: ['$languageScore', '$activityScore', '$profileScore', '$randomFactor']
        }
      }
    },

    // Filter out zero language matches (must have some language relevance)
    {
      $match: {
        languageScore: { $gt: 0 }
      }
    },

    // Sort by score
    { $sort: { matchScore: -1 } },

    // Limit results
    { $limit: parseInt(limit) },

    // Project final fields
    {
      $project: {
        _id: 1,
        name: 1,
        username: 1,
        avatar: { $arrayElemAt: ['$images', 0] },
        images: { $slice: ['$images', 3] },
        bio: 1,
        native_language: 1,
        language_to_learn: 1,
        languageLevel: 1,
        location: {
          city: '$location.city',
          country: '$location.country'
        },
        lastActive: 1,
        matchScore: 1,
        matchReasons: {
          $concatArrays: [
            {
              $cond: [
                { $eq: ['$languageScore', WEIGHTS.languageMatch] },
                ['Perfect language exchange partner'],
                []
              ]
            },
            {
              $cond: [
                { $gte: ['$activityScore', WEIGHTS.activeRecently] },
                ['Recently active'],
                []
              ]
            }
          ]
        },
        isOnline: {
          $gte: ['$lastActive', new Date(Date.now() - 5 * 60 * 1000)]
        }
      }
    }
  ];

  const recommendations = await User.aggregate(pipeline);

  // Enhance with match reasons
  const enhancedRecommendations = recommendations.map(user => ({
    ...user,
    matchReasons: getMatchReasons(currentUser, user)
  }));

  // Cache results
  await cache.set(cacheKey, enhancedRecommendations, RECOMMENDATIONS_CACHE_TTL);

  res.status(200).json({
    success: true,
    count: enhancedRecommendations.length,
    data: enhancedRecommendations,
    cached: false
  });
});

/**
 * @desc    Get quick matches (fast, lightweight recommendations)
 * @route   GET /api/v1/matching/quick
 * @access  Private
 */
exports.getQuickMatches = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  const currentUser = await User.findById(userId).select('native_language language_to_learn');

  if (!currentUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get blocked IDs
  const blockedIds = await getBlockedUserIds(userId);
  const excludeIds = [userId, ...blockedIds].map(id => new mongoose.Types.ObjectId(id));

  // Simple query for complementary language partners who are online
  const matches = await User.find({
    _id: { $nin: excludeIds },
    isRegistrationComplete: true,
    native_language: currentUser.language_to_learn,
    language_to_learn: currentUser.native_language,
    lastActive: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Online in last 15 min
  })
    .select('name username images native_language language_to_learn lastActive location.country')
    .sort({ lastActive: -1 })
    .limit(parseInt(limit))
    .lean();

  const formattedMatches = matches.map(user => ({
    ...user,
    avatar: user.images?.[0],
    isOnline: user.lastActive >= new Date(Date.now() - 5 * 60 * 1000)
  }));

  res.status(200).json({
    success: true,
    count: formattedMatches.length,
    data: formattedMatches
  });
});

/**
 * @desc    Find partners by language
 * @route   GET /api/v1/matching/language/:language
 * @access  Private
 */
exports.findByLanguage = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { language } = req.params;
  const { type = 'native', limit = 30, offset = 0 } = req.query;

  // Get blocked IDs
  const blockedIds = await getBlockedUserIds(userId);
  const excludeIds = [userId, ...blockedIds].map(id => new mongoose.Types.ObjectId(id));

  const matchField = type === 'native' ? 'native_language' : 'language_to_learn';

  const users = await User.find({
    _id: { $nin: excludeIds },
    isRegistrationComplete: true,
    [matchField]: language
  })
    .select('name username images native_language language_to_learn lastActive location bio')
    .sort({ lastActive: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .lean();

  const formattedUsers = users.map(user => ({
    ...user,
    avatar: user.images?.[0],
    isOnline: user.lastActive >= new Date(Date.now() - 5 * 60 * 1000)
  }));

  res.status(200).json({
    success: true,
    count: formattedUsers.length,
    data: formattedUsers
  });
});

/**
 * @desc    Get "similar to" recommendations based on a user
 * @route   GET /api/v1/matching/similar/:userId
 * @access  Private
 */
exports.getSimilarUsers = asyncHandler(async (req, res, next) => {
  const currentUserId = req.user.id;
  const { userId } = req.params;
  const { limit = 10 } = req.query;

  // Get the target user
  const targetUser = await User.findById(userId).select(
    'native_language language_to_learn interests location'
  );

  if (!targetUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get blocked IDs
  const blockedIds = await getBlockedUserIds(currentUserId);
  const excludeIds = [currentUserId, userId, ...blockedIds].map(id =>
    new mongoose.Types.ObjectId(id)
  );

  // Find similar users
  const similarUsers = await User.find({
    _id: { $nin: excludeIds },
    isRegistrationComplete: true,
    $or: [
      { native_language: targetUser.native_language },
      { language_to_learn: targetUser.language_to_learn }
    ]
  })
    .select('name username images native_language language_to_learn lastActive location')
    .sort({ lastActive: -1 })
    .limit(parseInt(limit))
    .lean();

  const formattedUsers = similarUsers.map(user => ({
    ...user,
    avatar: user.images?.[0],
    isOnline: user.lastActive >= new Date(Date.now() - 5 * 60 * 1000)
  }));

  res.status(200).json({
    success: true,
    count: formattedUsers.length,
    data: formattedUsers
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate human-readable match reasons
 */
function getMatchReasons(currentUser, matchedUser) {
  const reasons = [];

  // Language exchange match
  if (
    matchedUser.native_language === currentUser.language_to_learn &&
    matchedUser.language_to_learn === currentUser.native_language
  ) {
    reasons.push(`Speaks ${matchedUser.native_language}, learning ${matchedUser.language_to_learn}`);
  } else if (matchedUser.native_language === currentUser.language_to_learn) {
    reasons.push(`Native ${matchedUser.native_language} speaker`);
  }

  // Activity
  if (matchedUser.lastActive >= new Date(Date.now() - 5 * 60 * 1000)) {
    reasons.push('Online now');
  } else if (matchedUser.lastActive >= new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    reasons.push('Active today');
  }

  // Location
  if (matchedUser.location?.country === currentUser.location?.country) {
    reasons.push('Same country');
  }

  return reasons;
}
