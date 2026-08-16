const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/chatController');
const { ValidationError } = require('../utils/errors');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // Hard backstop at the multer layer, above every per-kind cap in
  // mediaService (the largest of which is video at 50MB). Wrapped below in
  // handleUpload so hitting it still surfaces as a 422, not the generic
  // handler's 500.
  limits: { fileSize: 50 * 1024 * 1024 },
});

// multer signals its own limits with a MulterError, which is not a FlameError,
// so the generic error handler (flame/middleware/error.js) would turn a
// too-large upload into an unhelpful 500. Map it to the same 422 the per-kind
// caps in mediaService return, so a client sees one consistent answer to
// "your file is too big" regardless of which limit caught it.
const handleUpload = (mw) => (req, res, next) => {
  mw(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new ValidationError(
        err.code === 'LIMIT_FILE_SIZE' ? 'file is too large' : `upload rejected: ${err.code}`,
      ));
    }
    next(err);
  });
};

const withKind = (kind) => (req, _res, next) => { req.mediaKind = kind; next(); };

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'must be a valid ObjectId');
const idParam = z.object({ id: objectId });
const openSchema = z.object({ user_id: objectId });
const sendSchema = z.object({
  text: z.string().min(1).max(2000),
  reply_to: objectId.optional(),
});
// The shipped app posts { duration_hours: n } (chat_service.dart) and
// validate.js replaces req.body with the parsed result, so a schema that only
// knew about `duration` STRIPPED the field and turned every timed mute into an
// indefinite one. `duration_hours` is therefore the field that has to work;
// `duration` (milliseconds, the service's own unit) stays accepted because it
// costs nothing and is what a non-app caller would reach for.
//
// nullable(): the shipped app sends `{ duration_hours: null }` for an
// indefinite mute — an explicit null, which `.optional()` alone rejects.
// duration_hours: 0 is the shipped app's UNMUTE (see chatController), so 0 has
// to be inside the accepted range rather than rejected by `.positive()`.
const muteSchema = z.object({
  duration_hours: z.number().min(0).nullable().optional(),
  duration: z.number().int().positive().optional(),
});
const pinSchema = z.object({ message_id: objectId });
const pinParams = z.object({ id: objectId, messageId: objectId });

router.get('/', auth, asyncHandler(ctrl.listConversations));
router.post('/', auth, validate.body(openSchema), asyncHandler(ctrl.openConversation));
router.get('/:id/messages', auth, validate.params(idParam), asyncHandler(ctrl.getMessages));
router.post('/:id/messages', auth, validate.params(idParam), validate.body(sendSchema), asyncHandler(ctrl.sendMessage));

// Paths and multipart field names are fixed by the shipped app
// (lib/services/chat_service.dart) — not negotiable independently of a
// coordinated app release.
router.post('/:id/messages/image', auth, validate.params(idParam),
  withKind('image'), handleUpload(upload.single('image')), asyncHandler(ctrl.sendMedia));

router.post('/:id/messages/voice', auth, validate.params(idParam),
  withKind('voice'), handleUpload(upload.single('voice')), asyncHandler(ctrl.sendMedia));

router.post('/:id/messages/audio', auth, validate.params(idParam),
  withKind('audio'), handleUpload(upload.single('audio')), asyncHandler(ctrl.sendMedia));

// .fields (not .single) because a later app release may attach a thumbnail
// alongside the video; today's shipped app sends none.
router.post('/:id/messages/video', auth, validate.params(idParam),
  withKind('video'),
  handleUpload(upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }])),
  asyncHandler(ctrl.sendMedia));

router.put('/:id/read', auth, validate.params(idParam), asyncHandler(ctrl.markRead));

// Paths, the pin body's { message_id } and the mute body's optional
// { duration_hours } are fixed by the shipped app — not negotiable
// independently of a coordinated app release.
router.post('/:id/mute', auth, validate.params(idParam),
  validate.body(muteSchema), asyncHandler(ctrl.muteConversation));
router.delete('/:id/mute', auth, validate.params(idParam),
  asyncHandler(ctrl.unmuteConversation));
router.post('/:id/pin', auth, validate.params(idParam),
  validate.body(pinSchema), asyncHandler(ctrl.pinMessage));
router.delete('/:id/pin/:messageId', auth, validate.params(pinParams),
  asyncHandler(ctrl.unpinMessage));

module.exports = router;
