const { test } = require('node:test');
const assert = require('node:assert/strict');
const Notification = require('../models/Notification');
const fcmService = require('../services/fcmService');

/**
 * Definitive list of notification types that actually reach
 * notificationService.send(userId, type, ...) in product code today.
 *
 * Derived by grepping every call site of notificationService.send(...) and
 * every internal send(...) call inside services/notificationService.js
 * (2026-07-14):
 *
 *   services/notificationService.js:157  send(recipientId, 'chat_message', ...)
 *   services/notificationService.js:227  send(momentOwnerId, 'moment_like', ...)
 *   services/notificationService.js:285  send(momentOwnerId, 'moment_comment', ...)
 *   services/notificationService.js:344  send(recipientId, 'friend_request', ...)
 *   services/notificationService.js:407  send(profileOwnerId, 'profile_visit', ...)
 *   services/notificationService.js:462  send(recipientId, 'wave', ...)
 *   services/notificationService.js:705  send(follower._id, 'follower_moment', ...)
 *   services/notificationService.js:762  send(parentAuthorId, 'comment_reply', ...)
 *   services/notificationService.js:796  send(commentAuthorId, 'comment_reaction', ...)
 *   services/notificationService.js:834  send(mentionedUserId, 'comment_mention', ...)
 *   services/notificationService.js:883  send(mentionedUserId, 'room_mention', ...)
 *   services/notificationService.js     send(recipientId, 'room_message', ...) (Task 15 follow-up — topic room new-message push)
 *   services/notificationService.js     send(ownerId, 'room_join', ...) (Task 15 follow-up — topic room join notify)
 *   services/notificationService.js:974  send(userId, 'vip_renewal_warning', ...)
 *   jobs/notificationJobs.js:198         notificationService.send(user._id, 'system', ...) (subscription reminder)
 *   jobs/learningJobs.js:309             notificationService.send(due._id, 'srs_review', ...) (Task 2 rewrite; was 'system')
 *   controllers/advancedMessages.js:135  notificationService.send(correctorId, 'system', ...) (correction accepted)
 *   controllers/users.js (follow trigger) notificationService.send(targetUserId, 'new_follower', ...) (Task 9)
 *
 * Plus Task 2's streak_reminder (sendStreakReminders rewritten to route
 * through notificationService.send instead of raw fcmService.sendToUser).
 *
 * Explicitly excluded (reviewer I3 — these never touch the enum because they
 * go via raw fcmService.sendToUser directly, bypassing notificationService.send
 * and therefore _saveToHistory):
 *   - scheduled_room_started (services/notificationService.js sendScheduledRoomStarted)
 *   - scheduled_room_reminder (services/notificationService.js sendScheduledRoomReminder)
 *   - voice_room_start (data.type on the scheduled-room-started push)
 *   - wave_daily_summary (jobs/waveDailySummaryJob.js — raw fcmService.sendToUser)
 */
const SENT_TYPES = [
  'chat_message',
  'moment_like',
  'moment_comment',
  'friend_request',
  'profile_visit',
  'wave',
  'follower_moment',
  'comment_reply',
  'comment_reaction',
  'comment_mention',
  'room_mention',
  'vip_renewal_warning',
  'system',
  'srs_review',
  'streak_reminder',
  'new_follower',
  'room_message',
  'room_join',
];

test('every type ever passed to notificationService.send() is in the Notification model enum', () => {
  const enumValues = Notification.schema.path('type').enumValues;
  for (const type of SENT_TYPES) {
    assert.ok(
      enumValues.includes(type),
      `Notification.type enum is missing "${type}" — history rows for this type will silently fail to save (ValidationError swallowed by _saveToHistory)`
    );
  }
});

test('every type ever passed to notificationService.send() is in fcmService.NOTIFICATION_TYPE_ENUM', () => {
  for (const type of SENT_TYPES) {
    assert.ok(
      fcmService.NOTIFICATION_TYPE_ENUM.has(type),
      `fcmService.NOTIFICATION_TYPE_ENUM is missing "${type}" — suppressed (quiet-hours/frequency-cap) audit rows for this type will collapse to 'system'`
    );
  }
});

test('excluded raw-fcmService types are NOT required in the enum (documents the boundary)', () => {
  // These are sent via fcmService.sendToUser directly and never touch
  // notificationService.send()/_saveToHistory, so they are out of scope for
  // this fix. Not asserting their absence (harmless if present) — just
  // documenting why they're excluded from SENT_TYPES above.
  const excluded = ['scheduled_room_started', 'scheduled_room_reminder', 'voice_room_start', 'wave_daily_summary'];
  assert.ok(Array.isArray(excluded));
});
