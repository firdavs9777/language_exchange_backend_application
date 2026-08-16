const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/chatController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // Hard ceiling at the multer layer; per-kind limits are enforced in
  // mediaService so the error is a 422 with a useful message.
  limits: { fileSize: 50 * 1024 * 1024 },
});

const withKind = (kind) => (req, _res, next) => { req.mediaKind = kind; next(); };

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

// Paths and multipart field names are fixed by the shipped app
// (lib/services/chat_service.dart) — not negotiable independently of a
// coordinated app release.
router.post('/:id/messages/image', auth, validate.params(idParam),
  withKind('image'), upload.single('image'), asyncHandler(ctrl.sendMedia));

router.post('/:id/messages/voice', auth, validate.params(idParam),
  withKind('voice'), upload.single('voice'), asyncHandler(ctrl.sendMedia));

router.post('/:id/messages/audio', auth, validate.params(idParam),
  withKind('audio'), upload.single('audio'), asyncHandler(ctrl.sendMedia));

// .fields (not .single) because a later app release may attach a thumbnail
// alongside the video; today's shipped app sends none.
router.post('/:id/messages/video', auth, validate.params(idParam),
  withKind('video'),
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  asyncHandler(ctrl.sendMedia));

router.put('/:id/read', auth, validate.params(idParam), asyncHandler(ctrl.markRead));

module.exports = router;
