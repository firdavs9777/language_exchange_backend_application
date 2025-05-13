const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const path = require('path');
const fs = require('fs').promises;

// Utility function to delete image file
const deleteImageFile = async (filename) => {
  const filePath = path.join(__dirname, '../uploads', filename);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    console.error(`Error deleting file ${filename}:`, err);
    // Continue even if file deletion fails
  }
};

// @desc     Get all users
// @route    GET /api/v1/auth/users
// @access   Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const users = await User.find().skip(skip).limit(limit);
  const total = await User.countDocuments();

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const usersWithImages = users.map(user => ({
    ...user.toObject(),
    imageUrls: (user.images || []).map(image => 
      `${baseUrl}/uploads/${encodeURIComponent(image)}`
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

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const userWithImages = {
    ...user.toObject(),
    imageUrls: user.images.map(image => 
      `${baseUrl}/uploads/${encodeURIComponent(image)}`
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
    user.images.map(image => deleteImageFile(image))
  );

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc     Upload user photos
// @route    PUT /api/v1/auth/users/:id/photos
// @access   Private
exports.userPhotoUpload = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }

  if (!req.files?.file) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  const files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
  const remainingSlots = 10 - user.images.length;

  if (remainingSlots <= 0) {
    return next(new ErrorResponse('Maximum of 10 images already uploaded', 400));
  }

  const filesToUpload = files.slice(0, remainingSlots);
  const uploadedFiles = [];

  // Process each file sequentially
  for (const file of filesToUpload) {
    const filename = `${file.name}-${Date.now()}${path.extname(file.name)}`;
    
    try {
      await file.mv(`./uploads/${filename}`);
      uploadedFiles.push(filename);
    } catch (err) {
      console.error('Error moving file:', err);
      // Clean up any already moved files if one fails
      await Promise.all(
        uploadedFiles.map(f => deleteImageFile(f))
      );
      return next(new ErrorResponse('Problem with file upload', 500));
    }
  }

  user.images = [...user.images, ...uploadedFiles];
  await user.save();


  const imageUrls = (user.images || []).map(image =>
    `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
  );
  user.images = imageUrls

  sendTokenResponse(user, 200, res);
});

// @desc     Delete user photo
// @route    DELETE /api/v1/auth/users/:userId/photos/:index
// @access   Private
exports.deleteUserPhoto = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.userId);
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  const index = parseInt(req.params.index);
  if (isNaN(index) || index < 0 || index >= user.images.length) {
    return next(new ErrorResponse('Invalid image index', 400));
  }

  const filename = user.images[index];
  user.images.splice(index, 1);
  
  await Promise.all([
    user.save(),
    deleteImageFile(filename)
  ]);
  const imageUrls = (user.images || []).map(image =>
    `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
  );
  user.images = imageUrls
    sendTokenResponse(user, 200, res);
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

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const followers = user.followers.map(follower => ({
    ...follower.toObject(),
    imageUrls: follower.images.map(image => 
      `${baseUrl}/uploads/${encodeURIComponent(image)}`
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

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const following = user.following.map(followedUser => ({
    ...followedUser.toObject(),
    imageUrls: followedUser.images.map(image => 
      `${baseUrl}/uploads/${encodeURIComponent(image)}`
    )
  }));

  res.status(200).json({
    success: true,
    count: following.length,
    data: following
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
