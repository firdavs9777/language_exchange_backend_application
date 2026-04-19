const express = require('express');
const Comment = require('../models/Comment');
const {
  getComments, getComment, createComment,
  updateComment, deleteComment,
  likeComment, getReplies,
  translateComment, getCommentTranslations,
  reactToComment, unreactToComment, uploadCommentImage
} = require('../controllers/comments');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize, authorizeComment} = require('../middleware/auth');
const { checkCommentLimit } = require('../middleware/checkLimitations');
const { uploadSingleCompressed } = require('../middleware/uploadToSpaces');
const router = express.Router({mergeParams: true});

router
  .route('/')
  .get(advancedResults(Comment, { path: 'moment', select:'name description'}), getComments)
  .post(protect, checkCommentLimit, uploadSingleCompressed('image', 'bananatalk/comments'), createComment);

router.route('/:id')
  .get(getComment)
  .put(protect, updateComment)
  .delete(protect, authorizeComment('user'), deleteComment);

// Like/unlike a comment
router.route('/:id/like').post(protect, likeComment);

// React/unreact to a comment
router.route('/:id/react')
  .post(protect, reactToComment)
  .delete(protect, unreactToComment);

// Upload image to comment
router.route('/:id/image')
  .put(protect, uploadSingleCompressed('image', 'bananatalk/comments'), uploadCommentImage);

// Replies to a comment
router.route('/:id/replies').get(getReplies);

// Translation
const { translateValidation } = require('../validators/translationValidator');
const { validate } = require('../middleware/validation');
router.route('/:id/translate').post(protect, translateValidation, validate, translateComment);
router.route('/:id/translations').get(protect, getCommentTranslations);

module.exports = router;