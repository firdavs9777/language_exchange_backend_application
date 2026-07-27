const User = require('../models/User');
const { NotFoundError } = require('../utils/errors');

function toToken(t) {
  return {
    token: t.token,
    platform: t.platform,
    device_id: t.deviceId,
    last_updated: t.lastUpdated ? t.lastUpdated.toISOString() : null,
    active: t.active,
  };
}

function toSettings(user) {
  const s = user.notificationSettings || {};
  return {
    enabled: s.enabled !== undefined ? s.enabled : true,
    chat_messages: s.chatMessages !== undefined ? s.chatMessages : true,
    matches: s.matches !== undefined ? s.matches : true,
  };
}

async function _findUser(userId) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new NotFoundError('user not found');
  return user;
}

// Upsert by deviceId: replaces the token, marks it active, and stamps
// lastUpdated. No duplicate entries are created for the same deviceId.
async function registerToken(userId, { token, platform, deviceId }) {
  const user = await _findUser(userId);
  const existing = user.fcmTokens.find((t) => t.deviceId === deviceId);
  const now = new Date();
  if (existing) {
    existing.token = token;
    existing.platform = platform;
    existing.lastUpdated = now;
    existing.active = true;
  } else {
    user.fcmTokens.push({ token, platform, deviceId, lastUpdated: now, active: true });
  }
  await user.save();
  return { tokens: user.fcmTokens.map(toToken) };
}

async function removeToken(userId, deviceId) {
  const user = await _findUser(userId);
  user.fcmTokens = user.fcmTokens.filter((t) => t.deviceId !== deviceId);
  await user.save();
  return { tokens: user.fcmTokens.map(toToken) };
}

async function getSettings(userId) {
  const user = await _findUser(userId);
  return toSettings(user);
}

// patch: optional { enabled, chatMessages, matches } — only provided keys change.
async function updateSettings(userId, patch) {
  const update = {};
  if (patch.enabled !== undefined) update['notificationSettings.enabled'] = patch.enabled;
  if (patch.chatMessages !== undefined) update['notificationSettings.chatMessages'] = patch.chatMessages;
  if (patch.matches !== undefined) update['notificationSettings.matches'] = patch.matches;

  const user = Object.keys(update).length
    ? await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true })
    : await _findUser(userId);
  if (!user || user.isDeleted) throw new NotFoundError('user not found');
  return toSettings(user);
}

module.exports = { registerToken, removeToken, getSettings, updateSettings };
