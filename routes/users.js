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
  getFollowers,
  deleteUserPhoto,
  updatePrivacySettings,
  getPrivacySettings
} = require('../controllers/users');
const express = require('express');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { updatePrivacySettingsValidation } = require('../validators/privacyValidator');
const router = express.Router({ mergeParams: true });
// router.use(protect);
// router.use(authorize('admin'));
router.route('/').get(getUsers).post(createUser);
router.route('/:userId/follow/:targetUserId').put(followUser);
router.route('/:userId/unfollow/:targetUserId').put(unfollowUser);
router.route('/:userId/followers').get(protect, getFollowers);
router.route('/:userId/following').get(protect, getFollowing);
router.route('/:id/photo').put(userPhotoUpload);
router
  .route('/:userId/photo/:index')
  .delete(deleteUserPhoto);

// Privacy settings routes
router
  .route('/:userId/privacy')
  .get(protect, getPrivacySettings)
  .put(protect, updatePrivacySettingsValidation, validate, updatePrivacySettings);

router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

module.exports = router;
