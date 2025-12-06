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

