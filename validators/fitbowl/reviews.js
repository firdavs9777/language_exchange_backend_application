const { body } = require('express-validator');

/**
 * Validation rules for creating a review
 */
exports.createReviewValidation = [
  body('menuItem')
    .notEmpty().withMessage('Menu item is required')
    .isMongoId().withMessage('Menu item must be a valid ID'),

  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Comment must not exceed 500 characters'),

  body('order')
    .optional()
    .isMongoId().withMessage('Order must be a valid ID')
];
