const { body } = require('express-validator');

/**
 * Validation rules for creating a category
 */
exports.createCategoryValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required')
    .isLength({ max: 50 }).withMessage('Category name must not exceed 50 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Description must not exceed 200 characters'),

  body('displayOrder')
    .optional()
    .isInt().withMessage('Display order must be an integer')
];

/**
 * Validation rules for updating a category
 */
exports.updateCategoryValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Category name must not exceed 50 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Description must not exceed 200 characters'),

  body('displayOrder')
    .optional()
    .isInt().withMessage('Display order must be an integer')
];
