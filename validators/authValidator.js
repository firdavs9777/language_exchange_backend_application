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
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bio must be 500 characters or less'),
  
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
    .optional()
    .custom((value) => {
      if (value && value.coordinates) {
        if (!Array.isArray(value.coordinates) || value.coordinates.length !== 2) {
          throw new Error('Location must have valid coordinates');
        }
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
    .notEmpty().withMessage('Language to learn cannot be empty'),
  
  body('privacySettings')
    .optional()
    .isObject().withMessage('Privacy settings must be an object'),
  
  body('privacySettings.showCountryRegion')
    .optional()
    .isBoolean().withMessage('showCountryRegion must be a boolean'),
  
  body('privacySettings.showCity')
    .optional()
    .isBoolean().withMessage('showCity must be a boolean'),
  
  body('privacySettings.showAge')
    .optional()
    .isBoolean().withMessage('showAge must be a boolean'),
  
  body('privacySettings.showZodiac')
    .optional()
    .isBoolean().withMessage('showZodiac must be a boolean'),
  
  body('privacySettings.showOnlineStatus')
    .optional()
    .isBoolean().withMessage('showOnlineStatus must be a boolean'),
  
  body('privacySettings.showGiftingLevel')
    .optional()
    .isBoolean().withMessage('showGiftingLevel must be a boolean'),
  
  body('privacySettings.birthdayNotification')
    .optional()
    .isBoolean().withMessage('birthdayNotification must be a boolean'),
  
  body('privacySettings.personalizedAds')
    .optional()
    .isBoolean().withMessage('personalizedAds must be a boolean')
];

/**
 * Validation rules for refresh token
 */
exports.refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required')
];

/**
 * Validation rules for accept terms
 */
exports.acceptTermsValidation = [
  body('termsAcceptedDate')
    .optional()
    .isISO8601().withMessage('termsAcceptedDate must be a valid ISO 8601 date')
    .toDate()
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

// Best-effort OS detection from the User-Agent header. Mobile HTTP clients
// (CFNetwork on iOS, okhttp on Android) leak enough fingerprints to classify
// most native/RN signups without any client cooperation. Returns one of
// 'ios' | 'android' | 'web' | 'unknown'. Treat as a hint, not a source of
// truth — the authoritative value is fcmTokens[].platform once the device
// registers for push.
exports.detectPlatform = (req) => {
  const ua = (req.get('user-agent') || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/(iphone|ipad|ipod|cfnetwork|darwin|ios)/.test(ua)) return 'ios';
  if (/(android|okhttp|dalvik)/.test(ua)) return 'android';
  if (/(mozilla|chrome|safari|firefox|edge|webkit)/.test(ua)) return 'web';
  return 'unknown';
};

// Authoritative client info — the Flutter app sends device_info_plus /
// package_info_plus values in `req.body.clientInfo` on /auth/register and
// /auth/updatedetails (Dart's default User-Agent matches none of the
// detectPlatform regex tokens, so UA-only attribution buckets every native
// signup as 'unknown'). Returns a sanitized object plus a `platform` value
// that prefers the body field and falls back to the UA sniff.
const ALLOWED_PLATFORMS = new Set(['ios', 'android', 'web', 'unknown']);
const truncate = (v, max = 120) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

exports.pickClientInfo = (req) => {
  const raw = (req.body && typeof req.body.clientInfo === 'object' && req.body.clientInfo) || {};
  const bodyPlatform = typeof raw.platform === 'string' ? raw.platform.toLowerCase() : '';
  const platform = ALLOWED_PLATFORMS.has(bodyPlatform) ? bodyPlatform : exports.detectPlatform(req);

  return {
    platform,
    deviceModel: truncate(raw.deviceModel),
    osVersion: truncate(raw.osVersion),
    appVersion: truncate(raw.appVersion, 40),
    appBuild: truncate(raw.appBuild, 40),
  };
};

