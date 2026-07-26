const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/chatController');

const router = express.Router();

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const idParam = z.object({ id: objectId });
const openSchema = z.object({ user_id: objectId });
const sendSchema = z.object({
  text: z.string().min(1).max(2000),
  reply_to: objectId.optional(),
});

router.get('/', auth, asyncHandler(ctrl.listConversations));
router.post('/', auth, validate.body(openSchema), asyncHandler(ctrl.openConversation));
router.get('/:id/messages', auth, validate.params(idParam), asyncHandler(ctrl.getMessages));
router.post('/:id/messages', auth, validate.params(idParam), validate.body(sendSchema), asyncHandler(ctrl.sendMessage));
router.put('/:id/read', auth, validate.params(idParam), asyncHandler(ctrl.markRead));

module.exports = router;
