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
const editSchema = z.object({ text: z.string().min(1).max(2000) });
const deleteQuerySchema = z.object({ scope: z.enum(['me', 'everyone']).optional() });

router.post('/:id/reactions', auth, validate.params(idParam), validate.body(reactSchema), asyncHandler(ctrl.addReaction));
router.delete('/:id/reactions', auth, validate.params(idParam), asyncHandler(ctrl.removeReaction));

router.patch('/:id', auth, validate.params(idParam), validate.body(editSchema), asyncHandler(ctrl.editMessage));
router.delete('/:id', auth, validate.params(idParam), validate.query(deleteQuerySchema), asyncHandler(ctrl.deleteMessage));

module.exports = router;
