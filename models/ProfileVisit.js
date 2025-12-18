const mongoose = require('mongoose');

/**
 * ProfileVisit Model
 * Tracks profile visits for analytics and visitor display
 */
const ProfileVisitSchema = new mongoose.Schema({
  // Profile owner (whose profile was visited)
  profileOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Visitor (who visited the profile)
  visitor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Visit timestamp
  visitedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Visit duration (optional - can be updated if tracking session)
  duration: {
    type: Number, // in seconds
    default: 0
  },

  // Visit source (where they came from)
  source: {
    type: String,
    enum: ['search', 'moments', 'chat', 'followers', 'following', 'direct', 'other'],
    default: 'other'
  },

  // Device type
  deviceType: {
    type: String,
    enum: ['ios', 'android', 'web'],
    default: 'ios'
  },

  // Whether visitor is still anonymous (for future privacy features)
  isAnonymous: {
    type: Boolean,
    default: false
  }
});

// Compound indexes for efficient queries
ProfileVisitSchema.index({ profileOwner: 1, visitedAt: -1 });
ProfileVisitSchema.index({ profileOwner: 1, visitor: 1, visitedAt: -1 });
ProfileVisitSchema.index({ visitor: 1, visitedAt: -1 });

// TTL index - automatically delete visits older than 90 days
ProfileVisitSchema.index({ visitedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/**
 * Get recent visitors for a profile
 */
ProfileVisitSchema.statics.getRecentVisitors = async function(profileOwnerId, limit = 20) {
  return this.aggregate([
    {
      $match: {
        profileOwner: mongoose.Types.ObjectId(profileOwnerId),
        isAnonymous: false
      }
    },
    {
      $sort: { visitedAt: -1 }
    },
    {
      $group: {
        _id: '$visitor',
        lastVisit: { $first: '$visitedAt' },
        visitCount: { $sum: 1 },
        source: { $first: '$source' }
      }
    },
    {
      $sort: { lastVisit: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'visitorInfo'
      }
    },
    {
      $unwind: '$visitorInfo'
    },
    {
      $project: {
        _id: 1,
        lastVisit: 1,
        visitCount: 1,
        source: 1,
        'visitorInfo.name': 1,
        'visitorInfo.photo': 1,
        'visitorInfo.gender': 1,
        'visitorInfo.city': 1,
        'visitorInfo.country': 1,
        'visitorInfo.isVIP': 1,
        'visitorInfo.nativeLanguage': 1
      }
    }
  ]);
};

/**
 * Get total unique visitors count
 */
ProfileVisitSchema.statics.getUniqueVisitorCount = async function(profileOwnerId) {
  const result = await this.aggregate([
    {
      $match: {
        profileOwner: mongoose.Types.ObjectId(profileOwnerId),
        isAnonymous: false
      }
    },
    {
      $group: {
        _id: '$visitor'
      }
    },
    {
      $count: 'uniqueVisitors'
    }
  ]);

  return result.length > 0 ? result[0].uniqueVisitors : 0;
};

/**
 * Get visit statistics
 */
ProfileVisitSchema.statics.getVisitStats = async function(profileOwnerId) {
  const stats = await this.aggregate([
    {
      $match: {
        profileOwner: mongoose.Types.ObjectId(profileOwnerId)
      }
    },
    {
      $facet: {
        total: [
          { $count: 'count' }
        ],
        unique: [
          { $group: { _id: '$visitor' } },
          { $count: 'count' }
        ],
        today: [
          {
            $match: {
              visitedAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0))
              }
            }
          },
          { $count: 'count' }
        ],
        thisWeek: [
          {
            $match: {
              visitedAt: {
                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              }
            }
          },
          { $count: 'count' }
        ],
        bySource: [
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  return {
    totalVisits: stats[0].total[0]?.count || 0,
    uniqueVisitors: stats[0].unique[0]?.count || 0,
    visitsToday: stats[0].today[0]?.count || 0,
    visitsThisWeek: stats[0].thisWeek[0]?.count || 0,
    bySource: stats[0].bySource
  };
};

/**
 * Record a profile visit
 */
ProfileVisitSchema.statics.recordVisit = async function(profileOwnerId, visitorId, options = {}) {
  // Don't record if visiting own profile
  if (profileOwnerId.toString() === visitorId.toString()) {
    return null;
  }

  // Check if this visitor already visited in the last 5 minutes (prevent spam)
  const recentVisit = await this.findOne({
    profileOwner: profileOwnerId,
    visitor: visitorId,
    visitedAt: {
      $gte: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    }
  });

  if (recentVisit) {
    // Update the visit timestamp
    recentVisit.visitedAt = new Date();
    await recentVisit.save();
    return recentVisit;
  }

  // Create new visit record
  const visit = await this.create({
    profileOwner: profileOwnerId,
    visitor: visitorId,
    source: options.source || 'other',
    deviceType: options.deviceType || 'ios',
    isAnonymous: options.isAnonymous || false
  });

  return visit;
};

module.exports = mongoose.model('ProfileVisit', ProfileVisitSchema);

