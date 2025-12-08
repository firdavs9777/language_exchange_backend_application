const express = require('express');
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  logout,
  logoutAll,
  refreshToken,
  facebookLogin,
  facebookCallback,
  googleLogin,
  googleCallback,
  sendVerificationCode,
  verifyCode,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  googleMobileLogin,
  appleMobileLogin,
  deleteAccount,
  makeAdmin
} = require('../controllers/auth');

const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  authLimiter,
  loginLimiter,
  emailLimiter
} = require('../middleware/rateLimiter');
const {
  registerValidation,
  loginValidation,
  emailVerificationValidation,
  verifyCodeValidation,
  forgotPasswordValidation,
  verifyResetCodeValidation,
  resetPasswordValidation,
  updatePasswordValidation,
  updateDetailsValidation,
  refreshTokenValidation
} = require('../validators/authValidator');

// Public routes - OAuth
router.get('/facebook', facebookLogin);
router.get('/facebook/callback', facebookCallback);
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);

// Email verification (rate limited)
router.post(
  '/send-verification-code',
  emailLimiter,
  emailVerificationValidation,
  validate,
  sendVerificationCode
);

router.post(
  '/verify-code',
  authLimiter,
  verifyCodeValidation,
  validate,
  verifyCode
);

// Registration (rate limited)
router.post(
  '/register',
  authLimiter,
  registerValidation,
  validate,
  register
);

// Login (rate limited)
router.post(
  '/login',
  loginLimiter,
  loginValidation,
  validate,
  login
);

// Password reset (rate limited)
router.post(
  '/forgot-password',
  emailLimiter,
  forgotPasswordValidation,
  validate,
  forgotPassword
);

router.post(
  '/verify-reset-code',
  authLimiter,
  verifyResetCodeValidation,
  validate,
  verifyResetCode
);

router.post(
  '/reset-password',
  authLimiter,
  resetPasswordValidation,
  validate,
  resetPassword
);

// Refresh token
router.post(
  '/refresh-token',
  refreshTokenValidation,
  validate,
  refreshToken
);

// Protected routes
router.get('/me', protect, getMe);
router.delete('/me', protect, deleteAccount);
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);

router.put(
  '/updatedetails',
  protect,
  updateDetailsValidation,
  validate,
  updateDetails
);

router.put(
  '/updatepassword',
  protect,
  updatePasswordValidation,
  validate,
  updatePassword
);

// Legacy routes (for backward compatibility)
router.post('/sendCodeEmail', emailLimiter, emailVerificationValidation, validate, sendVerificationCode);
router.post('/verifyEmailCode', authLimiter, verifyCodeValidation, validate, verifyCode);
router.post('/google/mobile', authLimiter, googleMobileLogin);
router.post('/apple/mobile', authLimiter, appleMobileLogin); 
router.put('/make-admin/:userId', makeAdmin);


module.exports = router;
