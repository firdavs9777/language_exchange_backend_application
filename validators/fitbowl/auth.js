const { body } = require('express-validator');

/**
 * Validation rules for user registration
 */
exports.registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  body('phone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('dietaryPreferences')
    .optional()
    .isArray().withMessage('Dietary preferences must be an array'),

  body('allergies')
    .optional()
    .isArray().withMessage('Allergies must be an array')
];

/**
 * Validation rules for user login
 */
exports.loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),

  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * Validation rules for updating user profile
 */
exports.updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),

  body('phone')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid phone number'),

  body('dietaryPreferences')
    .optional()
    .isArray().withMessage('Dietary preferences must be an array'),

  body('allergies')
    .optional()
    .isArray().withMessage('Allergies must be an array'),

  body('calorieTarget')
    .optional()
    .isInt({ min: 500, max: 5000 }).withMessage('Calorie target must be between 500 and 5000'),

  body('proteinTarget')
    .optional()
    .isInt({ min: 0, max: 1000 }).withMessage('Protein target must be between 0 and 1000'),

  body('carbTarget')
    .optional()
    .isInt({ min: 0, max: 1000 }).withMessage('Carb target must be between 0 and 1000'),

  body('fatTarget')
    .optional()
    .isInt({ min: 0, max: 1000 }).withMessage('Fat target must be between 0 and 1000')
];
