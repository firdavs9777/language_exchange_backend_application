const mongoose = require('mongoose');

const WebVisitSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    index: true
  },
  country: String,
  city: String,
  region: String,
  timezone: String,
  latitude: Number,
  longitude: Number,
  page: {
    type: String,
    default: '/'
  },
  referrer: String,
  userAgent: String,
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  browser: String,
  os: String,
  language: String,
  // Track if this is a unique visitor (first visit ever)
  isNewVisitor: {
    type: Boolean,
    default: false
  },
  // Optional: logged-in user
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Auto-delete after 90 days
WebVisitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Index for fast weekly queries
WebVisitSchema.index({ createdAt: -1 });
WebVisitSchema.index({ country: 1, createdAt: -1 });

/**
 * Get weekly stats for the report
 */
WebVisitSchema.statics.getWeeklyStats = async function () {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // This week's stats
  const thisWeekVisits = await this.countDocuments({ createdAt: { $gte: weekAgo } });
  const thisWeekUnique = await this.distinct('ip', { createdAt: { $gte: weekAgo } });

  // Last week's stats (for comparison)
  const lastWeekVisits = await this.countDocuments({
    createdAt: { $gte: twoWeeksAgo, $lt: weekAgo }
  });
  const lastWeekUnique = await this.distinct('ip', {
    createdAt: { $gte: twoWeeksAgo, $lt: weekAgo }
  });

  // Top countries
  const topCountries = await this.aggregate([
    { $match: { createdAt: { $gte: weekAgo }, country: { $ne: null } } },
    { $group: { _id: '$country', count: { $sum: 1 }, uniqueIPs: { $addToSet: '$ip' } } },
    { $project: { country: '$_id', visits: '$count', uniqueVisitors: { $size: '$uniqueIPs' } } },
    { $sort: { visits: -1 } },
    { $limit: 15 }
  ]);

  // Top cities
  const topCities = await this.aggregate([
    { $match: { createdAt: { $gte: weekAgo }, city: { $ne: null } } },
    { $group: { _id: { city: '$city', country: '$country' }, count: { $sum: 1 } } },
    { $project: { city: '$_id.city', country: '$_id.country', visits: '$count' } },
    { $sort: { visits: -1 } },
    { $limit: 15 }
  ]);

  // Top pages
  const topPages = await this.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    { $group: { _id: '$page', count: { $sum: 1 } } },
    { $project: { page: '$_id', visits: '$count' } },
    { $sort: { visits: -1 } },
    { $limit: 10 }
  ]);

  // Device breakdown
  const deviceBreakdown = await this.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    { $group: { _id: '$device', count: { $sum: 1 } } },
    { $project: { device: '$_id', count: '$count' } },
    { $sort: { count: -1 } }
  ]);

  // Top referrers
  const topReferrers = await this.aggregate([
    { $match: { createdAt: { $gte: weekAgo }, referrer: { $ne: null }, referrer: { $ne: '' } } },
    { $group: { _id: '$referrer', count: { $sum: 1 } } },
    { $project: { referrer: '$_id', visits: '$count' } },
    { $sort: { visits: -1 } },
    { $limit: 10 }
  ]);

  // Daily breakdown (visits per day this week, grouped by Korea time)
  const dailyBreakdown = await this.aggregate([
    { $match: { createdAt: { $gte: weekAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Seoul' } },
        visits: { $sum: 1 },
        uniqueIPs: { $addToSet: '$ip' }
      }
    },
    { $project: { date: '$_id', visits: 1, uniqueVisitors: { $size: '$uniqueIPs' } } },
    { $sort: { date: 1 } }
  ]);

  // Top browsers
  const topBrowsers = await this.aggregate([
    { $match: { createdAt: { $gte: weekAgo }, browser: { $ne: null } } },
    { $group: { _id: '$browser', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  // New vs returning visitors
  const newVisitors = await this.countDocuments({
    createdAt: { $gte: weekAgo },
    isNewVisitor: true
  });

  return {
    thisWeek: {
      totalVisits: thisWeekVisits,
      uniqueVisitors: thisWeekUnique.length,
      newVisitors
    },
    lastWeek: {
      totalVisits: lastWeekVisits,
      uniqueVisitors: lastWeekUnique.length
    },
    topCountries,
    topCities,
    topPages,
    deviceBreakdown,
    topReferrers,
    dailyBreakdown,
    topBrowsers,
    period: {
      from: weekAgo.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
      to: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
    }
  };
};

module.exports = mongoose.model('WebVisit', WebVisitSchema);
