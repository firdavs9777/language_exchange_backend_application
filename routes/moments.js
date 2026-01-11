// routes/moments.js
const express = require('express');
const {
  getMoments,
  getMoment,
  createMoment,
  updateMoment,
  deleteMoment,
  momentPhotoUpload,
  momentVideoUpload,
  deleteVideo,
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
  getMomentTranslations
} = require('../controllers/moments');
const { validate } = require('../middleware/validation');
const { createMomentValidation, updateMomentValidation } = require('../validators/momentValidator');
const { checkMomentLimit } = require('../middleware/checkLimitations');
const { uploadMultiple } = require('../middleware/uploadToSpaces');
const { uploadSingleVideo, generateThumbnail } = require('../middleware/uploadVideoToSpaces');
const commentRouter = require('./comment');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');

// Comments routes
router.use('/:momentId/comments', commentRouter);

// ========== PUBLIC ROUTES (with optional auth for blocking) ==========
// Note: optionalAuth middleware attaches user if token exists but doesn't require it
router.route('/').get(optionalAuth, getMoments);
router.route('/trending').get(optionalAuth, getTrendingMoments);
router.route('/explore').get(optionalAuth, exploreMoments);
router.route('/user/:userId').get(optionalAuth, getUserMoments);
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
  uploadMultiple('file', 10, 'bananatalk/moments'),
  momentPhotoUpload
);

// Video upload (Instagram-style, max 3 minutes)
// Streams video to S3, validates duration, generates thumbnail
router.route('/:id/video')
  .put(
    protect,
    uploadSingleVideo('video', 'bananatalk/moments/videos'),
    generateThumbnail,
    momentVideoUpload
  )
  .delete(protect, deleteVideo);

// Interactions
router.route('/:id/like').post(protect, likeMoment);
router.route('/:id/dislike').post(protect, dislikeMoment);
router.route('/:id/save').post(protect, saveMoment).delete(protect, unsaveMoment);
router.route('/:id/share').post(protect, shareMoment);
router.route('/:id/report').post(protect, reportMoment);

// Translation
const { translateValidation } = require('../validators/translationValidator');
router.route('/:momentId/translate').post(protect, translateValidation, validate, translateMoment);
router.route('/:momentId/translations').get(protect, getMomentTranslations);

module.exports = router;