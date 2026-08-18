const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/chatController');
const { LIMITS } = require('../services/mediaService');
const { ValidationError } = require('../utils/errors');

const router = express.Router();

// One multer instance PER KIND, ceilinged just above that kind's own cap in
// mediaService, rather than one shared 50MB instance.
//
// multer buffers the entire body into process memory before the controller —
// and therefore before the participant / block / ended-match checks — runs. A
// shared 50MB ceiling meant any authenticated user could pin N x 50MB of RAM
// with a handful of concurrent posts, whichever kind they claimed to be
// sending. A voice note now costs at most ~11MB of that.
//
// The headroom matters: with a ceiling EQUAL to the kind's cap (which is what
// video had) mediaService's own 422 can never fire, so the client only ever
// sees multer's generic "file is too large" instead of the message naming the
// real limit. Above the cap, mediaService answers first and multer is only the
// backstop for something far larger.
const CEILING_HEADROOM_BYTES = 1024 * 1024;
const uploadFor = (kind) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS[kind].maxBytes + CEILING_HEADROOM_BYTES },
});

// The flame sub-app is mounted at /flamebackend/v1, which the root server's
// generalLimiter (scoped to /api/v1/) never sees — so the upload routes had no
// rate limit whatsoever. Mounted here, in flame's own router, because the repo
// root serves live BananaTalk users and is not ours to touch.
//
// Keyed on the authenticated user (every media route runs `auth` first),
// mirroring middleware/rateLimiter.js's interactionLimiter, and scaled well
// down from it: 20 uploads/minute is far more than any human composer produces
// and still bounds the memory a single account can hold at once.
const mediaUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many uploads. Please slow down.',
    message: 'Too many uploads. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `flamemedia:${req.user.id}` : `flamemedia:${req.ip}`),
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
  // Only text and sticker. A sticker is an emoji carried in `text`, the same
  // model BananaTalk uses — no pack catalog, no hosted artwork.
  //
  // The media kinds are deliberately NOT accepted here: they have their own
  // upload routes with size and MIME checks, and letting this field name one
  // would be a way to fabricate a media message with no file behind it.
  message_type: z.enum(['text', 'sticker']).optional(),
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

// A `before` that is not an ObjectId makes Mongoose throw a CastError, which
// surfaces to the client as a 500. Rejecting it here makes a bad cursor what it
// actually is: a client error. Unknown keys pass through untouched, so this does
// not become a place that has to know every query param the route may grow.
const messagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  before: objectId.optional(),
}).passthrough();

router.get('/', auth, asyncHandler(ctrl.listConversations));
router.post('/', auth, validate.body(openSchema), asyncHandler(ctrl.openConversation));
router.get('/:id/messages', auth, validate.params(idParam), validate.query(messagesQuery), asyncHandler(ctrl.getMessages));
router.post('/:id/messages', auth, validate.params(idParam), validate.body(sendSchema), asyncHandler(ctrl.sendMessage));

// Paths and multipart field names are fixed by the shipped app
// (lib/services/chat_service.dart) — not negotiable independently of a
// coordinated app release.
router.post('/:id/messages/image', auth, mediaUploadLimiter, validate.params(idParam),
  withKind('image'), handleUpload(uploadFor('image').single('image')), asyncHandler(ctrl.sendMedia));

router.post('/:id/messages/voice', auth, mediaUploadLimiter, validate.params(idParam),
  withKind('voice'), handleUpload(uploadFor('voice').single('voice')), asyncHandler(ctrl.sendMedia));

router.post('/:id/messages/audio', auth, mediaUploadLimiter, validate.params(idParam),
  withKind('audio'), handleUpload(uploadFor('audio').single('audio')), asyncHandler(ctrl.sendMedia));

// .fields (not .single) because a later app release may attach a thumbnail
// alongside the video; today's shipped app sends none.
router.post('/:id/messages/video', auth, mediaUploadLimiter, validate.params(idParam),
  withKind('video'),
  handleUpload(uploadFor('video').fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }])),
  asyncHandler(ctrl.sendMedia));

router.put('/:id/read', auth, validate.params(idParam), asyncHandler(ctrl.markRead));

// Paths, the pin body's { message_id } and the mute body's optional
// { duration_hours } are fixed by the shipped app — not negotiable
// independently of a coordinated app release.
router.get('/:id/pins', auth, validate.params(idParam),
  asyncHandler(ctrl.listPinned));

router.post('/:id/archive', auth, validate.params(idParam),
  asyncHandler(ctrl.archiveConversation));
router.delete('/:id/archive', auth, validate.params(idParam),
  asyncHandler(ctrl.unarchiveConversation));

router.post('/:id/mute', auth, validate.params(idParam),
  validate.body(muteSchema), asyncHandler(ctrl.muteConversation));
router.delete('/:id/mute', auth, validate.params(idParam),
  asyncHandler(ctrl.unmuteConversation));
router.post('/:id/pin', auth, validate.params(idParam),
  validate.body(pinSchema), asyncHandler(ctrl.pinMessage));
router.delete('/:id/pin/:messageId', auth, validate.params(pinParams),
  asyncHandler(ctrl.unpinMessage));

module.exports = router;
