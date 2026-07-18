const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'chat_message', 'moment_like', 'moment_comment', 'friend_request', 'profile_visit',
      'follower_moment', 'system',
      // Task 5 (Workstream E-core) — additive: these types were already being
      // sent via notificationService.send() but were missing from this enum,
      // so _saveToHistory's Mongoose ValidationError was silently swallowed
      // and no in-app history row was ever created (push fired, record never
      // persisted). See test/notificationTypeEnum.test.js.
      'wave', 'comment_reply', 'comment_reaction', 'comment_mention', 'room_mention',
      'vip_renewal_warning', 'srs_review', 'streak_reminder', 'new_follower',
      // Task 8 (Story Studio) — story @mention notification. Added here for
      // the same reason as the Task 5 batch above: notificationService.send()
      // routes every type through _saveToHistory, and an enum miss there is a
      // silently-swallowed ValidationError (push fires, history row + badge
      // increment never happen).
      'story_mention',
      // Task 15 follow-up (rooms notifications) — new-message push for
      // user-created topic rooms + join-notify for the room owner. Same
      // "add here or _saveToHistory silently drops the history row" reason
      // as the batches above.
      'room_message', 'room_join',
      // Task 16 (rooms moderation) — join-request/approval flow for
      // user-created topic rooms. Same enum-miss trap as above.
      'room_join_request', 'room_join_approved', 'room_join_denied',
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  clicked: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  clickedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: true
  },
  suppressedReason: {
    type: String,
    enum: ['quiet_hours', 'frequency_cap', null],
    default: null
  },
  bundleSize: { type: Number, default: 1 },
  bundleActors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, sentAt: -1 });

// TTL index for automatic cleanup
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', NotificationSchema);

