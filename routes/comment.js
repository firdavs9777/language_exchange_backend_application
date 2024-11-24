const express = require('express');
const Comment = require('../models/Comment');
const {
  getComments, getComment, createComment,
  deleteComment
} = require('../controllers/comments');
const advancedResults = require('../middleware/advancedResults');
const { protect } = require('../middleware/auth');
// const { getMoment, createMoment } = require('../controllers/moments');
const router = express.Router({mergeParams: true});
// const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(advancedResults(Comment, { path: 'moment', select:'name description'}), getComments)
  .post(protect,createComment);
router.route('/:id').get(getComment).delete(deleteComment);
// .put(updateMoment).delete(deleteMoment);
module.exports = router;