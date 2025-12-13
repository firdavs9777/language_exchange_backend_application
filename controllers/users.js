const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { processUserImages } = require('../utils/imageUtils');
const path = require('path');
const fs = require('fs').promises;
const deleteFromSpaces = require('../utils/deleteFromSpaces');


// @desc     Get all users
// @route    GET /api/v1/auth/users
// @access   Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const users = await User.find().skip(skip).limit(limit);
  const total = await User.countDocuments();

  const usersWithImages = users.map(user => ({
    ...user.toObject(),
    imageUrls: user.images.map(image => 
      image
    )
  }));

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    pages: Math.ceil(total / limit),
    data: usersWithImages
  });
});

// @desc     Get single user
// @route    GET /api/v1/auth/users/:id
// @access   Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  const userWithImages = {
    ...user.toObject(),
    imageUrls: user.images.map(image => 
      image
    )
  };

  res.status(200).json({
    success: true,
    data: userWithImages
  });
});

// @desc     Create user
// @route    POST /api/v1/auth/users
// @access   Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: user
  });
});

// @desc     Update user
// @route    PUT /api/v1/auth/users/:id
// @access   Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

   sendTokenResponse(user, 200, res);
});

// @desc     Delete user
// @route    DELETE /api/v1/auth/users/:id
// @access   Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Delete all user images
  await Promise.all(
    user.images.map(image => deleteFromSpaces(image))
  );

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc     Update profile picture (first image only)
// @route    PUT /api/v1/auth/users/:id/profile-picture
// @access   Private
exports.updateProfilePicture = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Check authorization - user can only update their own profile picture
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to update this user\'s profile picture', 403));
  }

  if (!req.file || !req.file.location) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  const newImageUrl = req.file.location;
  let oldProfilePicture = null;
  
  if (user.images.length > 0) {
    // Replace existing profile picture
    oldProfilePicture = user.images[0];
    user.images[0] = newImageUrl;
  } else {
    // First time adding profile picture
    user.images.unshift(newImageUrl);
  }

  await user.save();

  // Delete old image from Spaces if it existed
  if (oldProfilePicture) {
    await deleteFromSpaces(oldProfilePicture);
  }

  return res.status(200).json({
    success: true,
    message: oldProfilePicture ? 'Profile picture updated successfully' : 'Profile picture added successfully',
    images: user.images,
    imageUrl: newImageUrl
  });
});

// @desc     Remove profile picture (first image only)
// @route    DELETE /api/v1/auth/users/:id/profile-picture
// @access   Private
exports.removeProfilePicture = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check authorization - user can only remove their own profile picture
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to remove this user\'s profile picture', 403));
  }

  if (user.images.length === 0) {
    return next(new ErrorResponse('No profile picture to remove', 400));
  }

  const profilePictureUrl = user.images[0];
  
  // Remove first image
  user.images.shift();
  
  await user.save();
  
  // Delete from Spaces
  await deleteFromSpaces(profilePictureUrl);

  return res.status(200).json({
    success: true,
    message: 'Profile picture removed successfully',
    images: user.images
  });
});

// @desc     Upload additional user photo (Spaces)
// @route    PUT /api/v1/auth/users/:id/photo
// @access   Private
exports.userPhotoUpload = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  // Check authorization - user can only upload to their own profile
  if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to upload photos for this user', 403));
  }

  if (!req.file || !req.file.location) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  // Check image limit (maximum 10 images)
  if (user.images.length >= 10) {
    return next(new ErrorResponse('Maximum of 10 images already uploaded', 400));
  }

  user.images.push(req.file.location);
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Image added successfully',
    images: user.images
  });
});

// @desc     Delete user photo at specific index (Spaces)
// @route    DELETE /api/v1/auth/users/:userId/photo/:index
// @access   Private
exports.deleteUserPhoto = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId);
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check authorization - user can only delete their own photos
  if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to delete this user\'s photos', 403));
  }

  const index = parseInt(req.params.index);
  
  if (isNaN(index) || index < 0 || index >= user.images.length) {
    return next(new ErrorResponse('Invalid image index', 400));
  }

  const url = user.images[index];
  user.images.splice(index, 1);
  
  await user.save();
  await deleteFromSpaces(url);

  return res.status(200).json({
    success: true,
    message: 'Image deleted successfully',
    images: user.images
  });
});

// @desc     Follow a user
// @route    POST /api/v1/auth/users/:userId/follow/:targetUserId
// @access   Private
exports.followUser = asyncHandler(async (req, res, next) => {
  const { userId, targetUserId } = req.params;

  if (userId === targetUserId) {
    return next(new ErrorResponse('Cannot follow yourself', 400));
  }

  const [user, targetUser] = await Promise.all([
    User.findById(userId),
    User.findById(targetUserId)
  ]);

  if (!user || !targetUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (user.following.includes(targetUserId)) {
    return next(new ErrorResponse('Already following this user', 400));
  }

  user.following.push(targetUserId);
  targetUser.followers.push(userId);

  await Promise.all([user.save(), targetUser.save()]);

  res.status(200).json({
    success: true,
    message: `Now following ${targetUser.name}`,
    data: {
      following: user.following,
      followers: targetUser.followers
    }
  });
});

// @desc     Unfollow a user
// @route    POST /api/v1/auth/users/:userId/unfollow/:targetUserId
// @access   Private
exports.unfollowUser = asyncHandler(async (req, res, next) => {
  const { userId, targetUserId } = req.params;

  const [user, targetUser] = await Promise.all([
    User.findById(userId),
    User.findById(targetUserId)
  ]);

  if (!user || !targetUser) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.following.includes(targetUserId)) {
    return next(new ErrorResponse('Not following this user', 400));
  }

  user.following = user.following.filter(id => id.toString() !== targetUserId);
  targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId);

  await Promise.all([user.save(), targetUser.save()]);

  res.status(200).json({
    success: true,
    message: `Unfollowed ${targetUser.name}`,
    data: {
      following: user.following,
      followers: targetUser.followers
    }
  });
});

// @desc     Get user followers
// @route    GET /api/v1/auth/users/:userId/followers
// @access   Private
exports.getFollowers = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId)
    .populate('followers', 'name images bio gender mbti location language_to_learn native_language');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const followers = user.followers.map(follower => ({
    ...follower.toObject(),
    imageUrls: follower.images.map(image => 
      image
    )
  }));

  res.status(200).json({
    success: true,
    count: followers.length,
    data: followers
  });
});

// @desc     Get user following
// @route    GET /api/v1/auth/users/:userId/following
// @access   Private
exports.getFollowing = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId)
     .populate('following', 'name images bio gender mbti location language_to_learn native_language');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const following = user.following.map(followedUser => ({
    ...followedUser.toObject(),
    imageUrls: followedUser.images.map(image => 
      image
    )
  }));

  res.status(200).json({
    success: true,
    count: following.length,
    data: following
  });
});

/**
 * @desc     Update user privacy settings
 * @route    PUT /api/v1/auth/users/:userId/privacy
 * @access   Private
 */
exports.updatePrivacySettings = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { privacySettings } = req.body;

  // Check if user is updating their own privacy settings
  if (req.user._id.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to update this user\'s privacy settings', 403));
  }

  // Find user
  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Validate privacy settings object
  if (!privacySettings || typeof privacySettings !== 'object') {
    return next(new ErrorResponse('Privacy settings must be an object', 400));
  }

  // Update privacy settings (merge with existing settings)
  user.privacySettings = {
    ...user.privacySettings,
    ...privacySettings
  };

  await user.save();

  // Process user images for response
  const userWithImages = processUserImages(user, req);

  res.status(200).json({
    success: true,
    message: 'Privacy settings updated successfully',
    data: {
      _id: user._id,
      privacySettings: user.privacySettings
    }
  });
});

/**
 * @desc     Get user privacy settings
 * @route    GET /api/v1/auth/users/:userId/privacy
 * @access   Private
 */
exports.getPrivacySettings = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can only view their own privacy settings
  if (req.user._id.toString() !== userId) {
    return next(new ErrorResponse('Not authorized to view this user\'s privacy settings', 403));
  }

  const user = await User.findById(userId).select('privacySettings');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      privacySettings: user.privacySettings || {}
    }
  });
});

// @desc     Activate VIP subscription for user
// @route    POST /api/v1/auth/users/:userId/vip/activate
// @access   Private
exports.activateVIPSubscription = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { plan, paymentMethod } = req.body;

  // Check if user is updating their own subscription or is admin
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to activate VIP for this user', 403));
  }

  // Validate plan
  if (!['monthly', 'quarterly', 'yearly'].includes(plan)) {
    return next(new ErrorResponse('Invalid subscription plan', 400));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Activate VIP
  await user.activateVIP(plan, paymentMethod);

  res.status(200).json({
    success: true,
    message: 'VIP subscription activated successfully',
    data: {
      userMode: user.userMode,
      vipSubscription: user.vipSubscription,
      vipFeatures: user.vipFeatures
    }
  });
});

// @desc     Deactivate VIP subscription for user
// @route    POST /api/v1/auth/users/:userId/vip/deactivate
// @access   Private
exports.deactivateVIPSubscription = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Check if user is updating their own subscription or is admin
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to deactivate VIP for this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.isVIP()) {
    return next(new ErrorResponse('User does not have an active VIP subscription', 400));
  }

  // Deactivate VIP
  await user.deactivateVIP();

  res.status(200).json({
    success: true,
    message: 'VIP subscription deactivated successfully',
    data: {
      userMode: user.userMode,
      vipSubscription: user.vipSubscription
    }
  });
});

// @desc     Get VIP subscription status
// @route    GET /api/v1/auth/users/:userId/vip/status
// @access   Private
exports.getVIPStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can view their own VIP status, or admins can view any user's status
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view VIP status for this user', 403));
  }

  const user = await User.findById(userId).select('userMode vipSubscription vipFeatures');

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      isVIP: user.isVIP(),
      userMode: user.userMode,
      vipSubscription: user.vipSubscription,
      vipFeatures: user.vipFeatures
    }
  });
});

// @desc     Upgrade visitor to regular user
// @route    POST /api/v1/auth/users/:userId/upgrade-visitor
// @access   Private
exports.upgradeVisitor = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can upgrade themselves, or admins can upgrade any user
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to upgrade this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.isVisitor()) {
    return next(new ErrorResponse('User is not in visitor mode', 400));
  }

  // Upgrade from visitor
  await user.upgradeFromVisitor();

  res.status(200).json({
    success: true,
    message: 'User upgraded from visitor to regular successfully',
    data: {
      userMode: user.userMode
    }
  });
});

// @desc     Check visitor limitations
// @route    GET /api/v1/auth/users/:userId/visitor/limits
// @access   Private
exports.checkVisitorLimits = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can check their own limits, or admins can check any user's limits
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view visitor limits for this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  if (!user.isVisitor()) {
    return next(new ErrorResponse('User is not in visitor mode', 400));
  }

  res.status(200).json({
    success: true,
    data: {
      canSendMessage: user.canSendMessage(),
      canViewProfile: user.canViewProfile(),
      visitorLimitations: user.visitorLimitations,
      limits: {
        messagesPerDay: 10,
        profileViewsPerDay: 20
      }
    }
  });
});

// @desc     Change user mode (admin only)
// @route    PUT /api/v1/auth/users/:userId/mode
// @access   Private/Admin
exports.changeUserMode = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { userMode } = req.body;

  // Validate userMode
  if (!['visitor', 'regular', 'vip'].includes(userMode)) {
    return next(new ErrorResponse('Invalid user mode', 400));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  user.userMode = userMode;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User mode changed to ${userMode} successfully`,
    data: {
      userMode: user.userMode
    }
  });
});

// @desc     Get user limitations status
// @route    GET /api/v1/auth/users/:userId/limits
// @access   Private
exports.getUserLimits = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  // Users can view their own limits, or admins can view any user's limits
  if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view limits for this user', 403));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Reset counters if new day
  const { resetDailyCounters, getUserLimits } = require('../utils/limitations');
  await resetDailyCounters(user);
  await user.save();

  // Get limit information
  const limitsInfo = getUserLimits(user);

  res.status(200).json({
    success: true,
    data: limitsInfo
  });
});

const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();
  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  // Securing Cookie in https
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }
  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token: token,
    option: options,
    user: user
  });
};
