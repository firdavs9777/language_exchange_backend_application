const crypto = require('crypto');
const User = require('../models/User');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { toPublic } = require('./authService');
const s3 = require('../utils/s3');

// Fields the owner is allowed to update via PATCH /users/me
const MUTABLE_FIELDS = new Set([
  'name', 'age', 'bio', 'interests', 'gender', 'lookingFor',
  'preferences', 'notificationSettings', 'settings', 'location', 'locationGeo',
]);

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_PHOTOS_PER_USER = 9;

// Public view (other users see this — no email, no auth fields)
function toPublicMinimal(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    age: user.age,
    gender: user.gender,
    lookingFor: user.lookingFor,
    bio: user.bio,
    interests: user.interests,
    photos: user.photos,
    // A user who has hidden their online status reads as offline everywhere
    // this shape goes out: the profile view (getById), the matches list
    // (matchService.list) and the "it's a match!" swipe payload
    // (swipeService.toMatchPayload) all share this one function rather than
    // each carrying its own check. Strict === false, like
    // discoveryService.toDiscoverUser's guard, so a missing `preferences`
    // sub-document fails OPEN to visible — the schema's own default.
    //
    // No self-exception: a viewer fetching their own id through this same
    // path reads as offline to themselves too if they hid it. This function
    // is documented as the "other users see this" view, and threading a
    // viewer id through three call sites to fix a cosmetic self-view isn't
    // worth it.
    isOnline: (user.preferences && user.preferences.showOnlineStatus === false)
      ? false
      : user.isOnline,
    // Same guard as isOnline, two lines up, and the same reasoning as
    // discoveryService.toDiscoverUser's last_active: it is the other half of
    // the presence signal the app derives "last seen" text from, so it leaks
    // exactly what isOnline was just guarded against.
    lastActive: (user.preferences && user.preferences.showOnlineStatus === false)
      ? null
      : user.lastActive,
  };
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return toPublic(user);
}

// Takes the VIEWER first: a profile read is a surface that returns another
// user, so it has to be filtered by the same block rules as discover and chat.
async function getById(viewerId, userId) {
  // Required lazily: visibilityService is only needed on this path, and a
  // top-level require here would drag the block machinery into every module
  // that only wants toPublicMinimal (matchService, swipeService).
  const visibility = require('./visibilityService');
  // 404 rather than 403: a blocked user should be indistinguishable from one
  // who does not exist, so nobody can probe who blocked them.
  if (viewerId && (await visibility.areBlocked(viewerId, userId))) {
    throw new NotFoundError('User not found');
  }
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return toPublicMinimal(user);
}

async function updateMe(userId, patch) {
  const update = {};
  for (const [k, v] of Object.entries(patch)) {
    if (MUTABLE_FIELDS.has(k)) update[k] = v;
  }
  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true });
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return toPublic(user);
}

const PREFERENCE_FIELDS = new Set([
  'minAge', 'maxAge', 'maxDistance', 'showDistance', 'showOnlineStatus',
]);

/**
 * Updates the caller's discovery preferences.
 *
 * `preferences` is a Mongoose sub-document, so this writes DOTTED paths
 * (`preferences.minAge`). Assigning the object wholesale would replace the
 * sub-document and reset every field the caller did not send — silently turning
 * the privacy flags back on, which is the worst possible direction for that
 * mistake.
 */
async function updatePreferences(userId, patch) {
  const update = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PREFERENCE_FIELDS.has(k) && v !== undefined) update[`preferences.${k}`] = v;
  }
  if (Object.keys(update).length === 0) {
    throw new ValidationError('no preference fields to update');
  }

  // Records that this user has deliberately written preferences at least once
  // — see the preferencesSet comment in models/User.js. Set on every
  // successful write, not just ones that touch minAge/maxAge, so a document
  // that e.g. only ever toggled showOnlineStatus still counts as "touched" the
  // next time an age bound lands on it.
  update['preferences.preferencesSet'] = true;

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true },
  );
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return user.preferences;
}

/**
 * Updates the caller's location.
 *
 * Writes BOTH `location` (human-readable, what the profile shows) and
 * `locationGeo` (the 2dsphere-indexed GeoJSON point Discover queries), in the
 * same save, so the two can never diverge. Writing only the first stores the
 * coordinates and leaves Discover ranking on the old position, which presents
 * as broken distance filtering rather than a failed save.
 *
 * `location` defaults to `null` (see models/User.js), so a dotted `$set` path
 * into it (`'location.coordinates.latitude'`) fails at the Mongo level —
 * "Cannot create field ... in element {location: null}", since Mongo will not
 * auto-vivify through an explicit null. A whole-object `$set` on `location`
 * avoids that, but overwriting it wholesale would silently clear
 * `city`/`state`/`country` on every coordinate update — nothing writes those
 * fields today, but the first geocoding path that does would have its data
 * zeroed out with no test to catch it. So: load the document, mutate the
 * sub-document in place (preserving its other fields), save once.
 */
async function updateLocation(userId, { latitude, longitude }) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');

  const existing = user.location ? user.location.toObject() : {};
  user.location = { ...existing, coordinates: { latitude, longitude } };
  user.locationGeo = {
    type: 'Point',
    // GeoJSON is [longitude, latitude]. Reversed, this is a different
    // continent.
    coordinates: [longitude, latitude],
  };
  await user.save();
  return user.location;
}

async function uploadPhoto(userId, file) {
  if (!file) throw new ValidationError('photo file is required');
  if (!ALLOWED_PHOTO_TYPES.has(file.mimetype)) {
    throw new ValidationError('Only JPEG, PNG, and WebP images are allowed');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new ValidationError('Photo must be under 10MB');
  }
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  if (user.photos.length >= MAX_PHOTOS_PER_USER) {
    throw new ValidationError(`At most ${MAX_PHOTOS_PER_USER} photos allowed`);
  }
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
  const id = crypto.randomUUID();
  // Shared bucket — see the note in mediaService.storeMessageMedia.
  const key = `flame/users/${userId}/photos/${id}.${ext}`;
  const url = await s3.uploadBuffer(file.buffer, key, file.mimetype);

  const photo = {
    id,
    url,
    isPrimary: user.photos.length === 0,  // first photo becomes primary
    order: user.photos.length,
  };
  user.photos.push(photo);
  await user.save();
  return photo;
}

async function deletePhoto(userId, photoId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  const photo = user.photos.find(p => p.id === photoId);
  if (!photo) throw new NotFoundError('Photo not found');
  // Best-effort delete from storage — don't block if it fails
  try {
    const key = photo.url.split('/').slice(3).join('/');  // crude: extract path from URL
    await s3.deleteObject(key);
  } catch (_) { /* ignore */ }
  user.photos = user.photos.filter(p => p.id !== photoId);
  if (photo.isPrimary && user.photos.length > 0) user.photos[0].isPrimary = true;
  await user.save();
}

module.exports = {
  getMe, getById, updateMe, updatePreferences, updateLocation, uploadPhoto, deletePhoto, toPublicMinimal,
};
