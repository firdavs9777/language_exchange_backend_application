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
    isOnline: user.isOnline,
    lastActive: user.lastActive,
  };
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('User not found');
  return toPublic(user);
}

async function getById(userId) {
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
  const key = `users/${userId}/photos/${id}.${ext}`;
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

module.exports = { getMe, getById, updateMe, uploadPhoto, deletePhoto };
