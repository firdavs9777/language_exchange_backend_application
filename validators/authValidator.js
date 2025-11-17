const { body } = require('express-validator');
const { isStrongPassword, isValidEmail } = require('../middleware/validation');

/**
 * Validation rules for registration
 */
exports.registerValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      if (!isStrongPassword(value)) {
        throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }
      return true;
    }),
  
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  
  body('gender')
    .notEmpty().withMessage('Gender is required')
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  
  body('bio')
    .trim()
    .notEmpty().withMessage('Bio is required')
    .isLength({ min: 10, max: 500 }).withMessage('Bio must be between 10 and 500 characters'),
  
  body('birth_year')
    .notEmpty().withMessage('Birth year is required')
    .isInt({ min: 1900, max: new Date().getFullYear() }).withMessage('Invalid birth year'),
  
  body('birth_month')
    .notEmpty().withMessage('Birth month is required')
    .isInt({ min: 1, max: 12 }).withMessage('Birth month must be between 1 and 12'),
  
  body('birth_day')
    .notEmpty().withMessage('Birth day is required')
    .isInt({ min: 1, max: 31 }).withMessage('Birth day must be between 1 and 31'),
  
  body('native_language')
    .trim()
    .notEmpty().withMessage('Native language is required'),
  
  body('language_to_learn')
    .trim()
    .notEmpty().withMessage('Language to learn is required'),
  
  body('location')
    .notEmpty().withMessage('Location is required')
    .custom((value) => {
      if (!value.coordinates || !Array.isArray(value.coordinates) || value.coordinates.length !== 2) {
        throw new Error('Location must have valid coordinates');
      }
      return true;
    }),
  
  body('images')
    .optional()
    .isArray().withMessage('Images must be an array'),
  
  body('mbti')
    .optional()
    .trim()
    .isLength({ max: 10 }).withMessage('MBTI must be 10 characters or less'),
  
  body('bloodType')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood type')
];

/**
 * Validation rules for login
 */
exports.loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
];

/**
 * Validation rules for email verification
 */
exports.emailVerificationValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail()
];

/**
 * Validation rules for code verification
 */
exports.verifyCodeValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('code')
    .trim()
    .notEmpty().withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits')
    .isNumeric().withMessage('Verification code must be numeric')
];

/**
 * Validation rules for password reset request
 */
exports.forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail()
];

/**
 * Validation rules for password reset code verification
 */
exports.verifyResetCodeValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('code')
    .trim()
    .notEmpty().withMessage('Reset code is required')
    .isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits')
    .isNumeric().withMessage('Reset code must be numeric')
];

/**
 * Validation rules for password reset
 */
exports.resetPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('code')
    .trim()
    .notEmpty().withMessage('Reset code is required')
    .isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits')
    .isNumeric().withMessage('Reset code must be numeric'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      if (!isStrongPassword(value)) {
        throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }
      return true;
    })
];

/**
 * Validation rules for update password
 */
exports.updatePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      if (!isStrongPassword(value)) {
        throw new Error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      }
      return true;
    })
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

/**
 * Validation rules for update details
 */
exports.updateDetailsValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 }).withMessage('Bio must be between 10 and 500 characters'),
  
  body('birth_year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() }).withMessage('Invalid birth year'),
  
  body('birth_month')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Birth month must be between 1 and 12'),
  
  body('birth_day')
    .optional()
    .isInt({ min: 1, max: 31 }).withMessage('Birth day must be between 1 and 31'),
  
  body('native_language')
    .optional()
    .trim()
    .notEmpty().withMessage('Native language cannot be empty'),
  
  body('language_to_learn')
    .optional()
    .trim()
    .notEmpty().withMessage('Language to learn cannot be empty')
];

/**
 * Validation rules for refresh token
 */
exports.refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required')
];

/**
 * Helper function to get device info from request
 */
exports.getDeviceInfo = (req) => {
  const userAgent = req.get('user-agent') || 'Unknown';
  const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
  
  // Simple device detection
  let device = 'Unknown';
  if (userAgent.includes('Mobile')) {
    device = 'Mobile';
  } else if (userAgent.includes('Tablet')) {
    device = 'Tablet';
  } else if (userAgent.includes('Desktop') || userAgent.includes('Windows') || userAgent.includes('Mac') || userAgent.includes('Linux')) {
    device = 'Desktop';
  }
  
  return {
    device,
    ipAddress,
    userAgent
  };
};

