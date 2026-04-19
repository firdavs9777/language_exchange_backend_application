const { body } = require('express-validator');

/**
 * Validation rules for creating a delivery address
 */
exports.createAddressValidation = [
  body('address')
    .trim()
    .notEmpty().withMessage('Address is required'),

  body('label')
    .optional()
    .trim()
    .isString().withMessage('Label must be a string'),

  body('apartment')
    .optional()
    .trim()
    .isString().withMessage('Apartment must be a string'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid number between -90 and 90'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid number between -180 and 180'),

  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Instructions must not exceed 200 characters')
];

/**
 * Validation rules for updating a delivery address
 */
exports.updateAddressValidation = [
  body('address')
    .optional()
    .trim()
    .isString().withMessage('Address must be a string'),

  body('label')
    .optional()
    .trim()
    .isString().withMessage('Label must be a string'),

  body('apartment')
    .optional()
    .trim()
    .isString().withMessage('Apartment must be a string'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid number between -90 and 90'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid number between -180 and 180'),

  body('instructions')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Instructions must not exceed 200 characters')
];
