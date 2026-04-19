const { body } = require('express-validator');

/**
 * Validation rules for adding an item to cart
 */
exports.addToCartValidation = [
  body('menuItem')
    .notEmpty().withMessage('Menu item is required')
    .isMongoId().withMessage('Menu item must be a valid ID'),

  body('quantity')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('Quantity must be between 1 and 20'),

  body('size')
    .optional()
    .isIn(['small', 'medium', 'large']).withMessage('Size must be small, medium, or large'),

  body('customizations')
    .optional()
    .isArray().withMessage('Customizations must be an array')
];

/**
 * Validation rules for updating a cart item
 */
exports.updateCartItemValidation = [
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('Quantity must be between 1 and 20'),

  body('size')
    .optional()
    .isIn(['small', 'medium', 'large']).withMessage('Size must be small, medium, or large'),

  body('customizations')
    .optional()
    .isArray().withMessage('Customizations must be an array')
];

/**
 * Validation rules for applying a promo code
 */
exports.applyPromoValidation = [
  body('code')
    .trim()
    .notEmpty().withMessage('Promo code is required')
    .isString().withMessage('Promo code must be a string')
];
