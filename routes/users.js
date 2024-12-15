const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  userPhotoUpload,
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers
} = require('../controllers/users');
const express = require('express');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });
// router.use(protect);
// router.use(authorize('admin'));
router.route('/').get(getUsers).post(createUser);
router.route('/:userId/follow/:targetUserId').put(followUser);
router.route('/:userId/unfollow/:targetUserId').put(unfollowUser);
router.route('/:userId/followers').get(protect,getFollowers);
router.route('/:userId/following').get(protect,getFollowing);
router.route('/:id/photo').put(userPhotoUpload);
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

module.exports = router;
