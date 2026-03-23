const { body, param, query } = require('express-validator');

/**
 * Validation rules for creating a message (POST /api/v1/messages)
 */
exports.createMessageValidation = [
  body('receiver')
    .notEmpty().withMessage('Receiver is required')
    .isMongoId().withMessage('Invalid receiver ID format'),

  body('message')
    .optional()
    .isString().withMessage('Message must be a string')
    .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters')
    .trim(),

  body('type')
    .optional()
    .isIn(['text', 'media', 'voice', 'sticker', 'poll', 'location', 'contact', 'system'])
    .withMessage('Invalid message type'),

  body('messageType')
    .optional()
    .isIn(['text', 'media', 'voice', 'sticker', 'poll', 'location', 'contact', 'system'])
    .withMessage('Invalid message type'),

  body('location')
    .optional()
    .custom((location) => {
      if (location) {
        if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
          throw new Error('Location must have numeric latitude and longitude');
        }
        if (location.latitude < -90 || location.latitude > 90) {
          throw new Error('Latitude must be between -90 and 90');
        }
        if (location.longitude < -180 || location.longitude > 180) {
          throw new Error('Longitude must be between -180 and 180');
        }
        if (location.address && typeof location.address !== 'string') {
          throw new Error('Address must be a string');
        }
        if (location.placeName && typeof location.placeName !== 'string') {
          throw new Error('Place name must be a string');
        }
      }
      return true;
    }),

  body('replyTo')
    .optional()
    .isMongoId().withMessage('Invalid replyTo message ID'),

  body('forwardedFrom.messageId')
    .optional()
    .isMongoId().withMessage('Invalid forwarded message ID'),
];

/**
 * Validation rules for replying to a message
 */
exports.replyMessageValidation = [
  param('id')
    .isMongoId().withMessage('Invalid message ID'),

  body('message')
    .notEmpty().withMessage('Message content is required')
    .isString().withMessage('Message must be a string')
    .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters')
    .trim(),

  body('receiver')
    .notEmpty().withMessage('Receiver is required')
    .isMongoId().withMessage('Invalid receiver ID format'),
];

/**
 * Validation rules for forwarding a message
 */
exports.forwardMessageValidation = [
  param('id')
    .isMongoId().withMessage('Invalid message ID'),

  body('receivers')
    .isArray({ min: 1, max: 10 }).withMessage('Receivers must be an array of 1-10 user IDs'),

  body('receivers.*')
    .isMongoId().withMessage('Each receiver must be a valid user ID'),
];

/**
 * Validation rules for editing a message
 */
exports.editMessageValidation = [
  param('id')
    .isMongoId().withMessage('Invalid message ID'),

  body('message')
    .notEmpty().withMessage('Message content is required')
    .isString().withMessage('Message must be a string')
    .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters')
    .trim(),
];

/**
 * Validation rules for conversation query
 */
exports.conversationValidation = [
  param('senderId')
    .isMongoId().withMessage('Invalid sender ID'),

  param('receiverId')
    .isMongoId().withMessage('Invalid receiver ID'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];
