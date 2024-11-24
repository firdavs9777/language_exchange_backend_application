const express = require('express');
const Moment = require('../models/Moment');
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
const advancedResults = require('../middleware/advancedResults');
const commentRouter = require('./comment')
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

router.use('/:momentId/comments',commentRouter)
router
  .route('/')
  .get(advancedResults(Moment, ''), getMoments)
  .post(protect,createMoment);
router.route('/:id').get(getMoment).put(protect,authorize,updateMoment).delete(protect,deleteMoment);
router.route('/:id/photo').put(momentPhotoUpload);
router.route('/user/:userId').get(advancedResults(Moment, ''), getUserMoments)
router
  .route('/:id/like')
  .post(likeMoment);
  router
  .route('/:id/dislike')
  .post(dislikeMoment);
module.exports = router;
