const express = require('express');
const router = express.Router();
const { sendContactEmail } = require('../controllers/contact');
const { validate } = require('../middleware/validation');
const { contactFormValidation } = require('../validators/contactValidator');
const { contactLimiter } = require('../middleware/rateLimiter');

/**
 * @route   POST /api/v1/contact/send
 * @desc    Send contact form email
 * @access  Public
 */
router.post(
  '/send',
  contactLimiter, // Rate limiting
  contactFormValidation, // Validation
  validate,
  sendContactEmail
);

module.exports = router;

