// routes/moments.js
const express = require('express');
const {
  getMoments,
  getMoment,
  getReelsFeed,
  getPromptOfDay,
  createMoment,
  updateMoment,
  deleteMoment,
  momentPhotoUpload,
  momentVideoUpload,
  momentAudioUpload,
  deleteVideo,
  getVideoConfig,
  getUserMoments,
  likeMoment,
  dislikeMoment,
  saveMoment,
  unsaveMoment,
  getSavedMoments,
  reportMoment,
  shareMoment,
  getTrendingMoments,
  exploreMoments,
  translateMoment,
  getMomentTranslations,
  reactToMoment,
  unreactToMoment
} = require('../controllers/moments');
const { validate } = require('../middleware/validation');
const { createMomentValidation, updateMomentValidation } = require('../validators/momentValidator');
const { checkMomentLimit } = require('../middleware/checkLimitations');
const { uploadMultipleCompressed, uploadSingle } = require('../middleware/uploadToSpaces');
const { uploadSingleVideo, generateThumbnail } = require('../middleware/uploadVideoToSpaces');
const commentRouter = require('./comment');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { interactionLimiter, reportLimiter } = require('../middleware/rateLimiter');
const { reelsEnabledGuard } = require('../lib/reelsFeed');

// Comments routes
router.use('/:momentId/comments', commentRouter);

// ========== PUBLIC ROUTES (with optional auth for blocking) ==========
// Note: optionalAuth middleware attaches user if token exists but doesn't require it
router.route('/').get(optionalAuth, getMoments);
router.route('/video-config').get(getVideoConfig); // Get video upload constraints
router.route('/trending').get(optionalAuth, getTrendingMoments);
router.route('/explore').get(optionalAuth, exploreMoments);
router.route('/user/:userId').get(optionalAuth, getUserMoments);
router.route('/prompt-of-day').get(optionalAuth, getPromptOfDay);

// Reels feed (Workstream G) — MUST be registered before '/:id' below, or
// Express would match 'reels' as an :id param and this route would never
// be reached. Gated by REELS_ENABLED (404 when off).
router.route('/reels').get(protect, reelsEnabledGuard, getReelsFeed);

router.route('/:id').get(optionalAuth, getMoment);

// ========== PROTECTED ROUTES ==========

// Saved/bookmarked moments
router.route('/saved').get(protect, getSavedMoments);

// Create moment
router.route('/').post(protect, checkMomentLimit, createMomentValidation, validate, createMoment);

// Update/delete moment
router.route('/:id').put(protect, updateMomentValidation, validate, updateMoment);
router.route('/:id').delete(protect, deleteMoment);

// Photo upload
router.route('/:id/photo').put(
  protect,
  uploadMultipleCompressed('file', 10, 'bananatalk/moments'),
  momentPhotoUpload
);

// Video upload (YouTube-style, max 10 minutes)
// Streams video to S3, validates duration, generates thumbnail
router.route('/:id/video')
  .put(
    protect,
    uploadSingleVideo('video', 'bananatalk/moments/videos'),
    generateThumbnail,
    momentVideoUpload
  )
  .delete(protect, deleteVideo);

// Audio upload (voice-note moments, max 60 seconds)
// Reuses the same Spaces upload helper as chat voice messages (uploadSingle)
router.route('/:id/audio').put(
  protect,
  uploadSingle('audio', 'bananatalk/moments/audio'),
  momentAudioUpload
);

// Interactions (rate limited to prevent spam)
router.route('/:id/like').post(protect, interactionLimiter, likeMoment);
router.route('/:id/dislike').post(protect, interactionLimiter, dislikeMoment);
router.route('/:id/save').post(protect, interactionLimiter, saveMoment).delete(protect, interactionLimiter, unsaveMoment);
router.route('/:id/share').post(protect, interactionLimiter, shareMoment);
router.route('/:id/react').post(protect, interactionLimiter, reactToMoment).delete(protect, unreactToMoment);
router.route('/:id/report').post(protect, reportLimiter, reportMoment);

// Translation
const { translateValidation } = require('../validators/translationValidator');
router.route('/:momentId/translate').post(protect, translateValidation, validate, translateMoment);
router.route('/:momentId/translations').get(protect, getMomentTranslations);

module.exports = router;