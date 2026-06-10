const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  validateTokenRegistration,
  validateNotificationSettings,
  validateConversationId,
  validateNotificationId,
  validateDeviceId,
  validatePagination,
  validateBadgeReset,
  validateTestNotification,
  validateBroadcastNotification
} = require('../middleware/notificationMiddleware');

const {
  registerToken,
  registerVoipToken,
  removeToken,
  getSettings,
  updateSettings,
  muteChat,
  unmuteChat,
  getHistory,
  markAsRead,
  markAllAsRead,
  clearAll,
  getBadgeCount,
  resetBadge,
  syncBadges,
  sendTestNotification,
  broadcastNotification
} = require('../controllers/notifications');

// Token removal doesn't require authentication (can be called during/after logout)
router.delete(
  '/remove-token/:deviceId',
  validateDeviceId,
  validate,
  removeToken
);

// All other routes require authentication
router.use(protect);

// Token Management
router.post(
  '/register-token',
  validateTokenRegistration,
  validate,
  registerToken
);

// iOS-only PushKit VoIP token registration. Validation is intentionally
// lightweight — the controller checks presence and the token shape is
// platform-supplied (Apple) hex.
router.post('/register-voip-token', registerVoipToken);

// Settings Management
router.get('/settings', getSettings);

router.put(
  '/settings',
  validateNotificationSettings,
  validate,
  updateSettings
);

router.post(
  '/mute-chat/:conversationId',
  validateConversationId,
  validate,
  muteChat
);

router.post(
  '/unmute-chat/:conversationId',
  validateConversationId,
  validate,
  unmuteChat
);

// Notification History
router.get(
  '/history',
  validatePagination,
  validate,
  getHistory
);

router.post(
  '/mark-read/:notificationId',
  validateNotificationId,
  validate,
  markAsRead
);

router.post('/mark-all-read', markAllAsRead);

router.delete('/clear-all', clearAll);

// Badge Management
router.get('/badge-count', getBadgeCount);

router.post(
  '/reset-badge',
  validateBadgeReset,
  validate,
  resetBadge
);

router.post('/sync-badges', syncBadges);

// Testing
router.post(
  '/test',
  validateTestNotification,
  validate,
  sendTestNotification
);

// Admin only - Broadcast notification to all users
router.post(
  '/broadcast',
  authorize('admin'),
  validateBroadcastNotification,
  validate,
  broadcastNotification
);

module.exports = router;

