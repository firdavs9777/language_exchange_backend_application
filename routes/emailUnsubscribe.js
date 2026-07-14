const express = require('express');
const router = express.Router();
const { unsubscribe } = require('../controllers/emailUnsubscribe');

/**
 * @route   GET /api/v1/email/unsubscribe
 * @desc    Unsubscribe from promotional/digest emails via signed token link
 * @access  Public (token is the auth)
 */
router.get('/unsubscribe', unsubscribe);

module.exports = router;
