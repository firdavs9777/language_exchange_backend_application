const User = require('../models/User');
const visibility = require('./visibilityService');

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two [lng, lat] pairs, in kilometres.
 *
 * Plain arithmetic rather than a $geoNear aggregation: the number is this cheap
 * to derive, and $geoNear would force the result set into distance order,
 * overriding the deck's lastActive sort.
 */
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Kilometres between viewer and target, or null when it cannot or must not be
 * shown.
 *
 * Null rather than 0: the app rendered `distance` unconditionally, so a hardcoded
 * 0 became "0 km away" on every card in the deck. Null is the only value that
 * lets the client omit the label.
 *
 * Only the TARGET's showDistance is consulted. Turning your own off hides your
 * distance from others; it does not hide theirs from you — the same asymmetry
 * showOnlineStatus already has.
 */
function distanceBetween(target, viewer) {
  if (target.preferences && target.preferences.showDistance === false) return null;
  const t = target.locationGeo && target.locationGeo.coordinates;
  const v = viewer && viewer.locationGeo && viewer.locationGeo.coordinates;
  if (!t || !v) return null;
  return haversineKm(v, t);
}

// Public discovery shape — snake_case to match the Flutter User.fromJson parser.
function toDiscoverUser(u, viewer) {
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
    distance: distanceBetween(u, viewer),
    // A user who has hidden their online status reads as offline everywhere the
    // server describes them. chatService.toConversation delegates to this
    // function, so the conversation list is covered by the same line — one
    // place answers the question, every caller asks it, the way
    // visibilityService works for blocks.
    is_online: (u.preferences && u.preferences.showOnlineStatus === false)
      ? false
      : u.isOnline,
    is_verified: u.isVerified,
    // Same guard as is_online, two lines up: last_active is the other half of
    // the presence signal (the app derives one "last seen" string from
    // whichever of isOnline/lastActive it has — lib/models/user.dart's
    // lastActiveText), so leaving this unguarded turns hiding your status into
    // "Online now" -> "5m ago" instead of actually hiding anything. Strict
    // === false, fails open like the boolean above.
    last_active: (u.preferences && u.preferences.showOnlineStatus === false)
      ? null
      : u.lastActive,
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

  // An untouched preference window means "no preference", not "18-50" — UNLESS
  // the user has actually written to /me/preferences, recorded by
  // preferencesSet. (See models/User.js's preferencesSchema comment.)
  //
  // minAge/maxAge default to 18/50 in the schema, and those defaults were
  // written into every user document at insert — so treating them as a real
  // filter silently hides everyone over 50 from everyone, on existing data.
  // That reasoning breaks the moment a real PATCH can land exactly 18-50 on
  // purpose, which preferencesSet disambiguates: true means the value was
  // deliberately written (filter, even at the sentinel), false means it is
  // either untouched or predates this field (keep the old heuristic).
  const DEFAULT_MIN_AGE = 18;
  const DEFAULT_MAX_AGE = 50;
  const prefs = (me && me.preferences) || {};
  const minAge = prefs.minAge;
  const maxAge = prefs.maxAge;

  let applyAgeFilter;
  if (prefs.preferencesSet === true) {
    applyAgeFilter = true;
  } else {
    const usingDefaultWindow =
      (minAge == null || minAge === DEFAULT_MIN_AGE) &&
      (maxAge == null || maxAge === DEFAULT_MAX_AGE);
    applyAgeFilter = !usingDefaultWindow;
  }

  if (applyAgeFilter) {
    filter.age = {};
    if (minAge != null) filter.age.$gte = minAge;
    if (maxAge != null) filter.age.$lte = maxAge;
  }

  // Distance. Applied only when the user deliberately wrote preferences AND we
  // know where they are — you cannot measure from nowhere, and a viewer without
  // a location must get an unfiltered deck rather than an empty one.
  //
  // $geoWithin rather than $near for two reasons: $near cannot appear inside an
  // $or, so it could not express "within the radius OR location unknown"; and
  // $near forces distance ordering, silently overriding sort({ lastActive: -1 }).
  const KM_PER_RADIAN = 6378.1;
  const viewerCoords = me && me.locationGeo && me.locationGeo.coordinates;
  const maxDistance = prefs.maxDistance;

  if (prefs.preferencesSet === true && viewerCoords && maxDistance > 0) {
    // NOTE: if this filter ever needs a second $or, both must move under $and —
    // a bare second assignment would silently overwrite this one.
    filter.$or = [
      { locationGeo: { $geoWithin: { $centerSphere: [viewerCoords, maxDistance / KM_PER_RADIAN] } } },
      // Accounts predating mandatory location capture. Including them costs a
      // little precision; excluding them would erase them from the app.
      { locationGeo: null },
      { locationGeo: { $exists: false } },
    ];
  }

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ lastActive: -1 })
    .skip(offset)
    .limit(limit);
  return { users: users.map((u) => toDiscoverUser(u, me)), total };
}

module.exports = { discover, toDiscoverUser, haversineKm };
