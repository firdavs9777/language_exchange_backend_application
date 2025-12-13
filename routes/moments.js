// routes/moments.js
const express = require('express');
const {
  getMoments,
  getMoment,
  createMoment,
  updateMoment,
  deleteMoment,
  momentPhotoUpload,
  getUserMoments,
  likeMoment,
  dislikeMoment,
  saveMoment,
  unsaveMoment,
  getSavedMoments,
  reportMoment,
  shareMoment,
  getTrendingMoments,
  exploreMoments
} = require('../controllers/moments');
const { validate } = require('../middleware/validation');
const { createMomentValidation, updateMomentValidation } = require('../validators/momentValidator');
const { checkMomentLimit } = require('../middleware/checkLimitations');
const { uploadMultiple } = require('../middleware/uploadToSpaces');
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

// Interactions
router.route('/:id/like').post(protect, likeMoment);
router.route('/:id/dislike').post(protect, dislikeMoment);
router.route('/:id/save').post(protect, saveMoment).delete(protect, unsaveMoment);
router.route('/:id/share').post(protect, shareMoment);
router.route('/:id/report').post(protect, reportMoment);

module.exports = router;