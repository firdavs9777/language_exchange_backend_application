const { body } = require('express-validator');

/**
 * Validation rules for creating a moment
 */
exports.createMomentValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Description must be between 1 and 2000 characters'),
  
  body('mood')
    .optional()
    .isIn(['happy', 'excited', 'grateful', 'motivated', 'relaxed', 'curious', '']).withMessage('Invalid mood'),
  
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags && tags.length > 5) {
        throw new Error('Cannot have more than 5 tags');
      }
      return true;
    }),
  
  body('category')
    .optional()
    .isIn(['general', 'language-learning', 'culture', 'food', 'travel', 'music', 'books', 'hobbies']).withMessage('Invalid category'),
  
  body('language')
    .optional()
    .isLength({ max: 2 }).withMessage('Language code must be 2 characters (ISO639-1)'),
  
  body('privacy')
    .optional()
    .isIn(['public', 'friends', 'private']).withMessage('Privacy must be public, friends, or private'),
  
  body('location')
    .optional()
    .custom((location) => {
      if (location && location.coordinates) {
        if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
          throw new Error('Location coordinates must be an array of [longitude, latitude]');
        }
        const [lng, lat] = location.coordinates;
        if (typeof lng !== 'number' || typeof lat !== 'number') {
          throw new Error('Coordinates must be numbers');
        }
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          throw new Error('Invalid coordinate values');
        }
      }
      return true;
    }),
  
  body('scheduledFor')
    .optional()
    .isISO8601().withMessage('Scheduled date must be a valid ISO 8601 date')
    .custom((date) => {
      if (new Date(date) < new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    })
];

/**
 * Validation rules for updating a moment
 */
exports.updateMomentValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 }).withMessage('Description must be between 1 and 2000 characters'),
  
  body('mood')
    .optional()
    .isIn(['happy', 'excited', 'grateful', 'motivated', 'relaxed', 'curious', '']).withMessage('Invalid mood'),
  
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array')
    .custom((tags) => {
      if (tags && tags.length > 5) {
        throw new Error('Cannot have more than 5 tags');
      }
      return true;
    }),
  
  body('category')
    .optional()
    .isIn(['general', 'language-learning', 'culture', 'food', 'travel', 'music', 'books', 'hobbies']).withMessage('Invalid category'),
  
  body('privacy')
    .optional()
    .isIn(['public', 'friends', 'private']).withMessage('Privacy must be public, friends, or private')
];

