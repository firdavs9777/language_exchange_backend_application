const express = require('express');
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  logout,
  facebookLogin,
  facebookCallback,
  sendEmailCode,
  checkEmailCode,
  resetPassword,
  verifyCode,
  sendVerificationCode,
  forgotPassword,
  verifyResetCode
} = require('../controllers/auth');

const router = express.Router();
const { protect } = require('../middleware/auth');

router.get('/facebook', facebookLogin)
router.get('/facebook/callback', facebookCallback)
router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);

router.post('/sendEmailCode', sendVerificationCode);
router.post('/verifyEmailCode', verifyCode);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);
// router.post('/checkEmailCode', checkEmailCode);

module.exports = router;
