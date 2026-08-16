const User = require('../models/User');
const visibility = require('./visibilityService');

// Public discovery shape — snake_case to match the Flutter User.fromJson parser.
function toDiscoverUser(u) {
  const location = u.location
    ? [u.location.city, u.location.state].filter(Boolean).join(', ') || null
    : null;
  return {
    id: u._id.toString(),
    name: u.name,
    age: u.age,
    gender: u.gender,
    looking_for: u.lookingFor,
    bio: u.bio,
    interests: u.interests,
    photos: (u.photos || []).map((p) => p.url),
    location,
    distance: 0,
    is_online: u.isOnline,
    is_verified: u.isVerified,
    last_active: u.lastActive,
    created_at: u.createdAt,
  };
}

/**
 * Discovery: other active users, most-recently-active first, excluding
 * anyone already swiped or blocked (either direction), filtered by gender
 * preference and age range.
 * (No distance filtering yet — most users lack `locationGeo`.)
 */
async function discover(viewerId, { limit, offset }) {
  const me = await User.findById(viewerId).lean();

  // Everyone this user has already judged, plus anyone either side blocked.
  const excluded = await visibility.excludedIdsFor(viewerId, { includeSwiped: true });

  const filter = {
    _id: { $ne: viewerId, $nin: excluded },
    isDeleted: { $ne: true },
  };

  // Gender preference, when the viewer expressed one other than 'other'.
  if (me && me.lookingFor && me.lookingFor !== 'other') {
    filter.gender = me.lookingFor;
  }

  // Age range from the viewer's preferences, when present.
  const prefs = (me && me.preferences) || {};
  if (prefs.minAge || prefs.maxAge) {
    filter.age = {};
    if (prefs.minAge) filter.age.$gte = prefs.minAge;
    if (prefs.maxAge) filter.age.$lte = prefs.maxAge;
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ lastActive: -1 })
    .skip(offset)
    .limit(limit);
  return { users: users.map(toDiscoverUser), total };
}

module.exports = { discover, toDiscoverUser };
