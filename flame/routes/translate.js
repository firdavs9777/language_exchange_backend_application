const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/translationController');

const router = express.Router();

// Every call is an outbound, metered request to a rate-limited provider.
//
// Keyed on the user rather than the IP: several users behind one carrier NAT
// share an address, and throttling them as one would make translation look
// broken for everyone on that network.
const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req.user ? req.user.id : req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many translations. Please slow down.' },
  },
});

// `text` matches Message.text's 2000-character cap: anything longer cannot be
// a message, so it is not worth an outbound call.
const translateSchema = z.object({
  text: z.string().min(1).max(2000),
  target_lang: z.string().min(2).max(8),
  source_lang: z.string().min(2).max(8).optional(),
});

// auth BEFORE the limiter, so the limiter can key on req.user.id.
router.post('/', auth, translateLimiter, validate.body(translateSchema),
  asyncHandler(ctrl.translate));

module.exports = router;
