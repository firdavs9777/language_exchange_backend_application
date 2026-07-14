const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _shouldSendNotification } = require('../services/notificationService');

/**
 * Gate tests for services/notificationService.js's _shouldSendNotification
 * (the switch at :477-579, NOT the small shouldNotify(user, type) helper at
 * :22 — reviewer I1 caught that these are two different functions with two
 * different purposes: shouldNotify reads notificationPreferences.<key>,
 * _shouldSendNotification is the top-level per-type gate switch called from
 * send()).
 */

const baseUser = (overrides = {}) => ({
  notificationSettings: {
    enabled: true,
    marketing: true,
    vocabularyReviewReminders: true,
    streakReminders: true,
    profileVisits: true,
    ...overrides.notificationSettings,
  },
  notificationPreferences: {
    newFollower: true,
    ...overrides.notificationPreferences,
  },
});

// --- Task 2: srs_review must gate on vocabularyReviewReminders, NOT marketing ---

test('srs_review: vocabularyReviewReminders true + marketing false -> allowed', async () => {
  const user = baseUser({
    notificationSettings: { vocabularyReviewReminders: true, marketing: false },
  });
  assert.equal(await _shouldSendNotification(user, 'srs_review'), true);
});

test('srs_review: vocabularyReviewReminders false -> blocked', async () => {
  const user = baseUser({
    notificationSettings: { vocabularyReviewReminders: false, marketing: true },
  });
  assert.equal(await _shouldSendNotification(user, 'srs_review'), false);
});

// --- 'system' behavior must remain unchanged (still marketing-gated) ---

test('system: marketing true -> allowed', async () => {
  const user = baseUser({ notificationSettings: { marketing: true } });
  assert.equal(await _shouldSendNotification(user, 'system'), true);
});

test('system: marketing false -> blocked', async () => {
  const user = baseUser({ notificationSettings: { marketing: false } });
  assert.equal(await _shouldSendNotification(user, 'system'), false);
});

// --- Task 2/3: streak_reminder gates on notificationSettings.streakReminders ---

test('streak_reminder: streakReminders true -> allowed', async () => {
  const user = baseUser({ notificationSettings: { streakReminders: true } });
  assert.equal(await _shouldSendNotification(user, 'streak_reminder'), true);
});

test('streak_reminder: streakReminders false -> blocked', async () => {
  const user = baseUser({ notificationSettings: { streakReminders: false } });
  assert.equal(await _shouldSendNotification(user, 'streak_reminder'), false);
});

// --- Global kill switch still applies regardless of type ---

test('notificationSettings.enabled=false blocks every type regardless of per-type prefs', async () => {
  const user = baseUser({
    notificationSettings: { enabled: false, vocabularyReviewReminders: true, streakReminders: true },
  });
  assert.equal(await _shouldSendNotification(user, 'srs_review'), false);
  assert.equal(await _shouldSendNotification(user, 'streak_reminder'), false);
});

// --- Task 9: new_follower gates on notificationPreferences.newFollower,
// independent of friend_request's notificationSettings.friendRequests ---

test('new_follower: notificationPreferences.newFollower true -> allowed', async () => {
  const user = baseUser({ notificationPreferences: { newFollower: true } });
  assert.equal(await _shouldSendNotification(user, 'new_follower'), true);
});

test('new_follower: notificationPreferences.newFollower false -> blocked', async () => {
  const user = baseUser({ notificationPreferences: { newFollower: false } });
  assert.equal(await _shouldSendNotification(user, 'new_follower'), false);
});

// --- Task 10: profile_visit gate sanity (re-enable case) ---

test('profile_visit: notificationSettings.profileVisits false -> blocked', async () => {
  const user = baseUser({ notificationSettings: { profileVisits: false } });
  assert.equal(await _shouldSendNotification(user, 'profile_visit'), false);
});

test('profile_visit: notificationSettings.profileVisits true -> allowed', async () => {
  const user = baseUser({ notificationSettings: { profileVisits: true } });
  assert.equal(await _shouldSendNotification(user, 'profile_visit'), true);
});
