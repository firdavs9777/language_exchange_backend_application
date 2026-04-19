const { body } = require('express-validator');

/**
 * Validation rules for placing an order
 */
exports.placeOrderValidation = [
  body('deliveryAddress')
    .notEmpty().withMessage('Delivery address is required')
    .isObject().withMessage('Delivery address must be an object'),

  body('deliveryAddress.address')
    .notEmpty().withMessage('Address is required'),

  body('deliveryAddress.latitude')
    .optional()
    .isFloat().withMessage('Latitude must be a valid number'),

  body('deliveryAddress.longitude')
    .optional()
    .isFloat().withMessage('Longitude must be a valid number'),

  body('paymentMethod')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash', 'card', 'click', 'payme']).withMessage('Payment method must be cash, card, click, or payme'),

  body('items')
    .optional()
    .isArray().withMessage('Items must be an array'),

  body('items.*.menuItem')
    .optional()
    .isMongoId().withMessage('Menu item must be a valid ID'),

  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),

  body('items.*.size')
    .optional()
    .isIn(['small', 'medium', 'large']).withMessage('Size must be small, medium, or large')
];

/**
 * Validation rules for rating an order
 */
exports.rateOrderValidation = [
  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Comment must not exceed 500 characters')
];
