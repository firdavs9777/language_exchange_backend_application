const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/chatController');

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const idParam = z.object({ id: objectId });
const reactSchema = z.object({ emoji: z.string().min(1).max(16) });

router.post('/:id/reactions', auth, validate.params(idParam), validate.body(reactSchema), asyncHandler(ctrl.addReaction));
router.delete('/:id/reactions', auth, validate.params(idParam), asyncHandler(ctrl.removeReaction));

module.exports = router;
