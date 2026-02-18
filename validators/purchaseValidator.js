const { body } = require('express-validator');

/**
 * Validation rules for iOS purchase verification
 */
exports.verifyIOSPurchaseValidation = [
  body('receiptData')
    .notEmpty().withMessage('Receipt data is required')
    .isString().withMessage('Receipt data must be a string'),

  body('productId')
    .optional()
    .isString().withMessage('Product ID must be a string'),

  body('transactionId')
    .optional()
    .isString().withMessage('Transaction ID must be a string')
];

/**
 * Validation rules for subscription status check
 */
exports.verifySubscriptionStatusValidation = [
  body('receiptData')
    .notEmpty().withMessage('Receipt data is required')
    .isString().withMessage('Receipt data must be a string')
];

/**
 * Validation rules for Android purchase verification
 */
exports.verifyAndroidPurchaseValidation = [
  body('purchaseToken')
    .notEmpty().withMessage('Purchase token is required')
    .isString().withMessage('Purchase token must be a string'),

  body('productId')
    .notEmpty().withMessage('Product ID is required')
    .isString().withMessage('Product ID must be a string'),

  body('orderId')
    .optional()
    .isString().withMessage('Order ID must be a string'),

  body('packageName')
    .optional()
    .isString().withMessage('Package name must be a string')
];

/**
 * Validation rules for Android subscription status check
 */
exports.verifyAndroidSubscriptionStatusValidation = [
  body('purchaseToken')
    .notEmpty().withMessage('Purchase token is required')
    .isString().withMessage('Purchase token must be a string'),

  body('productId')
    .notEmpty().withMessage('Product ID is required')
    .isString().withMessage('Product ID must be a string'),

  body('packageName')
    .optional()
    .isString().withMessage('Package name must be a string')
];

