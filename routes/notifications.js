const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  validateTokenRegistration,
  validateNotificationSettings,
  validateConversationId,
  validateNotificationId,
  validateDeviceId,
  validatePagination,
  validateBadgeReset,
  validateTestNotification
} = require('../middleware/notificationMiddleware');

const {
  registerToken,
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
  sendTestNotification
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

// Testing
router.post(
  '/test',
  validateTestNotification,
  validate,
  sendTestNotification
);

module.exports = router;

