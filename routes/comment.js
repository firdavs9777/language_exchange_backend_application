const express = require('express');
const Comment = require('../models/Comment');
const {
  getComments, getComment, createComment,
  deleteComment
} = require('../controllers/comments');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize, authorizeComment} = require('../middleware/auth');
const { checkCommentLimit } = require('../middleware/checkLimitations');
const { uploadSingle } = require('../middleware/uploadToSpaces');
// const { getMoment, createMoment } = require('../controllers/moments');
const router = express.Router({mergeParams: true});
// const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(advancedResults(Comment, { path: 'moment', select:'name description'}), getComments)
  .post(protect, checkCommentLimit, uploadSingle('image', 'bananatalk/comments'), createComment);
router.route('/:id').get(getComment).delete(protect,authorizeComment('user'),deleteComment);
// .put(updateMoment).delete(deleteMoment);
module.exports = router;