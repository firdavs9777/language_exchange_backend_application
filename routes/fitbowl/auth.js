const express = require('express');
const {
  register,
  login,
  googleAuth,
  appleAuth,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  updateFcmToken
} = require('../../controllers/fitbowl/auth');

const router = express.Router();
const { protect } = require('../../middleware/fitbowl/auth');
const { validate } = require('../../middleware/fitbowl/validate');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation
} = require('../../validators/fitbowl/auth');

router
  .route('/')
  .post(registerValidation, validate, register);

router
  .route('/login')
  .post(loginValidation, validate, login);

router
  .route('/google')
  .post(googleAuth);

router
  .route('/apple')
  .post(appleAuth);

router
  .route('/me')
  .get(protect, getMe);

router
  .route('/profile')
  .put(protect, updateProfileValidation, validate, updateProfile);

router
  .route('/forgot-password')
  .post(forgotPassword);

router
  .route('/reset-password/:resettoken')
  .put(resetPassword);

router
  .route('/fcm-token')
  .put(protect, updateFcmToken);

module.exports = router;
