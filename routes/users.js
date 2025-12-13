const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  updateProfilePicture,
  removeProfilePicture,
  userPhotoUpload,
  uploadMultiplePhotos, 
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  deleteUserPhoto,
  updatePrivacySettings,
  getPrivacySettings,
  activateVIPSubscription,
  deactivateVIPSubscription,
  getVIPStatus,
  upgradeVisitor,
  checkVisitorLimits,
  changeUserMode,
  getUserLimits
} = require('../controllers/users');
const express = require('express');
const advancedResults = require('../middleware/advancedResults');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { updatePrivacySettingsValidation } = require('../validators/privacyValidator');
const { uploadSingle, uploadMultiple } = require('../middleware/uploadToSpaces'); // ADD uploadMultiple
const router = express.Router({ mergeParams: true });

// router.use(protect);
// router.use(authorize('admin'));

router.route('/').get(getUsers).post(createUser);

// Follow/Unfollow routes
router.route('/:userId/follow/:targetUserId').put(followUser);
router.route('/:userId/unfollow/:targetUserId').put(unfollowUser);
router.route('/:userId/followers').get(protect, getFollowers);
router.route('/:userId/following').get(protect, getFollowing);

// Profile picture routes (dedicated endpoints for main profile picture)
router
  .route('/:id/profile-picture')
  .put(protect, uploadSingle('photo', 'bananatalk/profiles'), updateProfilePicture)
  .delete(protect, removeProfilePicture);

// Single photo upload route
router
  .route('/:id/photo')
  .put(protect, uploadSingle('photo', 'bananatalk/profiles'), userPhotoUpload);

// Multiple photos upload route (NEW)
router
  .route('/:id/photos')
  .post(protect, uploadMultiple('photos', 5, 'bananatalk/profiles'), uploadMultiplePhotos);

// Delete photo at specific index
router
  .route('/:userId/photo/:index')
  .delete(protect, deleteUserPhoto);

// Privacy settings routes
router
  .route('/:userId/privacy')
  .get(protect, getPrivacySettings)
  .put(protect, updatePrivacySettingsValidation, validate, updatePrivacySettings);

// VIP subscription routes (must be before /:id route)
router
  .route('/:userId/vip/activate')
  .post(protect, activateVIPSubscription);

router
  .route('/:userId/vip/deactivate')
  .post(protect, deactivateVIPSubscription);

router
  .route('/:userId/vip/status')
  .get(protect, getVIPStatus);

// Visitor routes
router
  .route('/:userId/upgrade-visitor')
  .post(protect, upgradeVisitor);

router
  .route('/:userId/visitor/limits')
  .get(protect, checkVisitorLimits);

// Admin route for changing user mode
router
  .route('/:userId/mode')
  .put(protect, authorize('admin'), changeUserMode);

// User limits route
router
  .route('/:userId/limits')
  .get(protect, getUserLimits);

// User CRUD routes (must be last to avoid conflicts)
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

module.exports = router;