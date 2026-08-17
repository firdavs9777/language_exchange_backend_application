const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/chatController');

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const idParam = z.object({ id: objectId });
const reactSchema = z.object({ emoji: z.string().min(1).max(16) });
const editSchema = z.object({ text: z.string().min(1).max(2000) });
const deleteQuerySchema = z.object({ scope: z.enum(['me', 'everyone']).optional() });

// Keyed on the user rather than the IP: several users behind one carrier NAT
// share an address, and throttling them as one would make search look broken
// for a whole network.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req.user ? req.user.id : req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many searches. Please slow down.' },
  },
});

const searchQuery = z.object({
  q: z.string().min(1).max(200),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

// Mounted BEFORE the /:id routes so 'search' is never read as a message id.
// auth comes before the limiter so the limiter can key on req.user.id.
router.get('/search', auth, searchLimiter, validate.query(searchQuery),
  asyncHandler(ctrl.searchMessages));

router.post('/:id/reactions', auth, validate.params(idParam), validate.body(reactSchema), asyncHandler(ctrl.addReaction));
router.delete('/:id/reactions', auth, validate.params(idParam), asyncHandler(ctrl.removeReaction));

router.patch('/:id', auth, validate.params(idParam), validate.body(editSchema), asyncHandler(ctrl.editMessage));
router.delete('/:id', auth, validate.params(idParam), validate.query(deleteQuerySchema), asyncHandler(ctrl.deleteMessage));

module.exports = router;
