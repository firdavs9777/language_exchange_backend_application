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
const SEEN_SET_TTL = 24 * 60 * 60;      // 24h — keep the "recently shown" decay window in sync with this
const SEEN_SET_MAX = 200;               // cap the seen-set so we don't grow it unbounded per user
const CONVO_RECENCY_DAYS = 14;          // only exclude conversation partners with messages in the last N days

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
    'native_language language_to_learn location blockedUsers blockedBy lastActive'
  );

  if (!currentUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get blocked user IDs
  const blockedIds = await getBlockedUserIds(userId);

  // Only exclude conversation partners we've actually been talking to in the
  // last N days — old one-off chats shouldn't bury someone from recommendations
  // forever. Uses the existing {participants:1, lastMessageAt:-1} compound index.
  const convoRecencyCutoff = new Date(Date.now() - CONVO_RECENCY_DAYS * 24 * 60 * 60 * 1000);
  const recentConvos = await Conversation.find({
    participants: userId,
    lastMessageAt: { $gte: convoRecencyCutoff }
  }).select('participants');

  const recentPartnerIds = recentConvos.flatMap(c =>
    c.participants.filter(p => p.toString() !== userId).map(p => p.toString())
  );

  // Follows/followers are intentionally NOT excluded — mutuals are usually
  // *better* candidates, not worse. The seen-set penalty below keeps them from
  // dominating consecutive loads.
  const excludeIds = [
    userId,
    ...blockedIds,
    ...recentPartnerIds
  ].map(id => new mongoose.Types.ObjectId(id));

  // Recently-shown decay: users surfaced in the last 24h get a penalty so the
  // same handful of profiles don't dominate every refresh. Best-effort — if the
  // cache read fails or the entry is missing, no penalty applies.
  const seenKey = `seen:${userId}`;
  const seenList = (await cache.get(seenKey, async () => null, 1)) || [];
  const seenIdsObj = seenList
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  // Scoring weights. languageMatch (50) stays the single dominant signal —
  // sum of everything else maxes around ~40, so a perfect-language partner
  // with zero bonuses still beats a partial-language match maxed on extras.
  const WEIGHTS = {
    languageMatch: 50,       // Perfect language exchange pair
    languagePartial: 20,     // Partial language match
    activeRecently: 15,      // Active in last 24h
    activeThisWeek: 10,      // Active in last 7 days
    sameCity: 8,             // Same city as me
    sameCountry: 4,          // Same country (fallback when city doesn't match)
    levelComplement: 6,      // Their CEFR level in my native is B1+ (can chat fluently)
    profileComplete: 5,      // Has photos and bio
    recentlyShown: -10       // Penalty for users surfaced in the last 24h
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

        // Location proximity — same city is much stronger signal than same country,
        // so they're tiered, not additive. Falsy values on either side never match.
        locationScore: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $ne: ['$location.city', null] },
                    { $ne: ['$location.city', ''] },
                    { $eq: ['$location.city', currentUser.location?.city || null] }
                  ]
                },
                then: WEIGHTS.sameCity
              },
              {
                case: {
                  $and: [
                    { $ne: ['$location.country', null] },
                    { $ne: ['$location.country', ''] },
                    { $eq: ['$location.country', currentUser.location?.country || null] }
                  ]
                },
                then: WEIGHTS.sameCountry
              }
            ],
            default: 0
          }
        },

        // CEFR-complement bonus — a partner whose level in MY native language is
        // B1+ can actually hold a conversation with me. Only credited when their
        // language_to_learn matches my native_language (otherwise the level field
        // describes proficiency in a language I don't speak).
        levelComplementScore: {
          $cond: [
            {
              $and: [
                { $eq: ['$language_to_learn', currentUser.native_language] },
                { $in: ['$languageLevel', ['B1', 'B2', 'C1', 'C2']] }
              ]
            },
            WEIGHTS.levelComplement,
            0
          ]
        },

        // Recently-shown decay — penalize profiles surfaced in the last 24h
        // so the same handful of users don't dominate every refresh.
        seenPenalty: {
          $cond: [
            { $in: ['$_id', seenIdsObj] },
            WEIGHTS.recentlyShown,
            0
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
          $add: [
            '$languageScore',
            '$activityScore',
            '$profileScore',
            '$locationScore',
            '$levelComplementScore',
            '$seenPenalty',
            '$randomFactor'
          ]
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

  // Record the surfaced IDs into the seen-set so the next call applies the
  // recently-shown penalty. Cap to SEEN_SET_MAX (FIFO) to avoid unbounded
  // growth — at the cap, the penalty effectively rotates off the oldest IDs.
  if (enhancedRecommendations.length > 0) {
    const newIds = enhancedRecommendations.map(u => u._id.toString());
    const merged = [...newIds, ...seenList.filter(id => !newIds.includes(id))]
      .slice(0, SEEN_SET_MAX);
    await cache.set(seenKey, merged, SEEN_SET_TTL);
  }

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
 * @query   {number} limit - Max results (default: 10)
 * @query   {string} timeframe - 'online' (5min), 'recent' (1hr), 'today' (24hr) - default: 'recent'
 */
exports.getQuickMatches = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 10, timeframe = 'recent' } = req.query;

  const currentUser = await User.findById(userId).select('native_language language_to_learn');

  if (!currentUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Get blocked IDs
  const blockedIds = await getBlockedUserIds(userId);
  const excludeIds = [userId, ...blockedIds].map(id => new mongoose.Types.ObjectId(id));

  // Timeframe options
  const timeframes = {
    online: 5 * 60 * 1000,      // 5 minutes
    recent: 60 * 60 * 1000,     // 1 hour
    today: 24 * 60 * 60 * 1000  // 24 hours
  };
  const activeWindow = timeframes[timeframe] || timeframes.recent;

  // First try: Perfect language match (complementary partners)
  let matches = await User.find({
    _id: { $nin: excludeIds },
    isRegistrationComplete: true,
    native_language: currentUser.language_to_learn,
    language_to_learn: currentUser.native_language,
    lastActive: { $gte: new Date(Date.now() - activeWindow) }
  })
    .select('name username images native_language language_to_learn lastActive location.country bio')
    .sort({ lastActive: -1 })
    .limit(parseInt(limit))
    .lean();

  // Fallback: If no perfect matches, find users who speak the language user wants to learn
  if (matches.length < parseInt(limit)) {
    const remainingLimit = parseInt(limit) - matches.length;
    const matchedIds = matches.map(m => m._id);

    const fallbackMatches = await User.find({
      _id: { $nin: [...excludeIds, ...matchedIds] },
      isRegistrationComplete: true,
      native_language: currentUser.language_to_learn,
      lastActive: { $gte: new Date(Date.now() - activeWindow) }
    })
      .select('name username images native_language language_to_learn lastActive location.country bio')
      .sort({ lastActive: -1 })
      .limit(remainingLimit)
      .lean();

    matches = [...matches, ...fallbackMatches];
  }

  // Second fallback: Any recently active users (for new apps with small user base)
  if (matches.length === 0) {
    matches = await User.find({
      _id: { $nin: excludeIds },
      isRegistrationComplete: true,
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Active in last 24 hours
    })
      .select('name username images native_language language_to_learn lastActive location.country bio')
      .sort({ lastActive: -1 })
      .limit(parseInt(limit))
      .lean();
  }

  const formattedMatches = matches.map(user => ({
    ...user,
    avatar: user.images?.[0],
    isOnline: user.lastActive >= new Date(Date.now() - 5 * 60 * 1000),
    matchType: user.native_language === currentUser.language_to_learn &&
               user.language_to_learn === currentUser.native_language
               ? 'perfect' : 'partial'
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
