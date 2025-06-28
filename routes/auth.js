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
  registerEmailCode
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
router.post('/resetpassword', resetPassword);
router.post('/sendCodeEmail', sendEmailCode);
router.post('/registerCodeEmail', registerEmailCode);
router.post('/checkEmailCode', checkEmailCode);

module.exports = router;
