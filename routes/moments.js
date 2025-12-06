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
  dislikeMoment
} = require('../controllers/moments');
const { validate } = require('../middleware/validation');
const { createMomentValidation, updateMomentValidation } = require('../validators/momentValidator');
const { checkMomentLimit } = require('../middleware/checkLimitations');
const commentRouter = require('./comment');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Comments routes
router.use('/:momentId/comments', commentRouter);

// Public routes
router.route('/').get(getMoments);
router.route('/:id').get(getMoment);
router.route('/user/:userId').get(getUserMoments);

// Protected routes
router.route('/').post(protect, checkMomentLimit, createMomentValidation, validate, createMoment);
router.route('/:id').put(protect, updateMomentValidation, validate, updateMoment);
router.route('/:id').delete(protect, deleteMoment);
router.route('/:id/photo').put(protect, momentPhotoUpload);
router.route('/:id/like').post(protect, likeMoment);
router.route('/:id/dislike').post(protect, dislikeMoment);

module.exports = router;
