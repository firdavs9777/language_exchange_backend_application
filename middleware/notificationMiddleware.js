const { body, param, query } = require('express-validator');

/**
 * Notification Middleware
 * Validation rules for notification endpoints
 */

/**
 * Validate FCM token registration
 */
exports.validateTokenRegistration = [
  body('token')
    .trim()
    .notEmpty().withMessage('FCM token is required')
    .isLength({ min: 100 }).withMessage('Invalid FCM token format'),
  
  body('platform')
    .trim()
    .notEmpty().withMessage('Platform is required')
    .isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  
  body('deviceId')
    .trim()
    .notEmpty().withMessage('Device ID is required')
    .isLength({ min: 10, max: 200 }).withMessage('Invalid device ID')
];

/**
 * Validate notification settings update
 */
exports.validateNotificationSettings = [
  body('enabled')
    .optional()
    .isBoolean().withMessage('enabled must be a boolean'),
  
  body('chatMessages')
    .optional()
    .isBoolean().withMessage('chatMessages must be a boolean'),
  
  body('moments')
    .optional()
    .isBoolean().withMessage('moments must be a boolean'),
  
  body('friendRequests')
    .optional()
    .isBoolean().withMessage('friendRequests must be a boolean'),
  
  body('profileVisits')
    .optional()
    .isBoolean().withMessage('profileVisits must be a boolean'),
  
  body('marketing')
    .optional()
    .isBoolean().withMessage('marketing must be a boolean'),
  
  body('sound')
    .optional()
    .isBoolean().withMessage('sound must be a boolean'),
  
  body('vibration')
    .optional()
    .isBoolean().withMessage('vibration must be a boolean'),
  
  body('showPreview')
    .optional()
    .isBoolean().withMessage('showPreview must be a boolean')
];

/**
 * Validate conversation ID parameter
 */
exports.validateConversationId = [
  param('conversationId')
    .trim()
    .notEmpty().withMessage('Conversation ID is required')
    .isMongoId().withMessage('Invalid conversation ID')
];

/**
 * Validate notification ID parameter
 */
exports.validateNotificationId = [
  param('notificationId')
    .trim()
    .notEmpty().withMessage('Notification ID is required')
    .isMongoId().withMessage('Invalid notification ID')
];

/**
 * Validate device ID parameter
 */
exports.validateDeviceId = [
  param('deviceId')
    .trim()
    .notEmpty().withMessage('Device ID is required')
    .isLength({ min: 10, max: 200 }).withMessage('Invalid device ID')
];

/**
 * Validate pagination query
 */
exports.validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
];

/**
 * Validate badge reset
 */
exports.validateBadgeReset = [
  body('type')
    .trim()
    .notEmpty().withMessage('Badge type is required')
    .isIn(['messages', 'notifications']).withMessage('Type must be messages or notifications')
];

/**
 * Validate test notification
 */
exports.validateTestNotification = [
  body('userId')
    .optional()
    .trim()
    .isMongoId().withMessage('Invalid user ID'),
  
  body('type')
    .optional()
    .trim()
    .isIn(['chat_message', 'moment_like', 'moment_comment', 'friend_request', 'profile_visit', 'system'])
    .withMessage('Invalid notification type')
];

