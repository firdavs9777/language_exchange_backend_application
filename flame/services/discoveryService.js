const User = require('../models/User');

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
 * Basic discovery: other active users, most-recently-active first.
 * (No distance/preference filtering yet — added when matching lands.)
 */
async function discover(viewerId, { limit, offset }) {
  const filter = { _id: { $ne: viewerId }, isDeleted: { $ne: true } };
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ lastActive: -1 })
    .skip(offset)
    .limit(limit);
  return { users: users.map(toDiscoverUser), total };
}

module.exports = { discover, toDiscoverUser };
