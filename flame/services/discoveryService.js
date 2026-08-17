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
    // A user who has hidden their online status reads as offline everywhere the
    // server describes them. chatService.toConversation delegates to this
    // function, so the conversation list is covered by the same line — one
    // place answers the question, every caller asks it, the way
    // visibilityService works for blocks.
    is_online: (u.preferences && u.preferences.showOnlineStatus === false)
      ? false
      : u.isOnline,
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

  // An untouched preference window means "no preference", not "18-50".
  //
  // minAge/maxAge default to 18/50 in the schema, and those defaults were
  // written into every user document at insert — so treating them as a real
  // filter silently hides everyone over 50 from everyone, on existing data.
  // Only filter when the user has actually moved one of the bounds.
  const DEFAULT_MIN_AGE = 18;
  const DEFAULT_MAX_AGE = 50;
  const prefs = (me && me.preferences) || {};
  const minAge = prefs.minAge;
  const maxAge = prefs.maxAge;
  const usingDefaultWindow =
    (minAge == null || minAge === DEFAULT_MIN_AGE) &&
    (maxAge == null || maxAge === DEFAULT_MAX_AGE);

  if (!usingDefaultWindow) {
    filter.age = {};
    if (minAge != null) filter.age.$gte = minAge;
    if (maxAge != null) filter.age.$lte = maxAge;
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ lastActive: -1 })
    .skip(offset)
    .limit(limit);
  return { users: users.map(toDiscoverUser), total };
}

module.exports = { discover, toDiscoverUser };
