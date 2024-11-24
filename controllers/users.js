const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const advancedResults = require('../middleware/advancedResults');
const path = require('path');
//@desc Get All Users
//@route get /api/v1/auth/users
//@access Private/Admin
exports.getUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find();

  // Mapping users to include imageUrls if images are not empty
  const usersWithImages = users.map(user => {
    let imageUrls = [];
    if (Array.isArray(user.images) && user.images.length > 0) {
      imageUrls = user.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`);
    }
    return {
      ...user._doc,
      imageUrls: imageUrls
    };
  });

  res.status(200).json({
    success: true,
    count: usersWithImages.length,
    data: usersWithImages,
  });
});
//@desc Get single user
//@route get /api/v1/auth/users/:id
//@access Private/Admin
exports.getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  // res.status(200).json({
  //   success: true,
  //   data: user
  // });

  if (!user) {
    return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
  }
  const usersWithImages = {
    ...user._doc,
    imageUrls: user.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
  }
  res.status(200).json({
    success: true,
    data: usersWithImages
  });
});

//@desc Create user
//@route POST /api/v1/auth/users
//@access Private/Admin
exports.createUser = asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(200).json({
    success: true,
    data: user
  });



});
// @desc Update user
// @route PUT /api/v1/auth/users/:id
// @access Private/Admin
exports.updateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  console.log(req.body);
  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc Delete user
// @route Delete /api/v1/auth/users/:id
// @access Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.id);
  res.status(200).json({
    success: true,
    data: {}
  });
});


//@desc Upload photos for moment
//@route PUT /api/v1/auth/users/:id/photos
//@access Private

exports.userPhotoUpload = asyncHandler(async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }

    console.log('Request', req.files);
    
    // Ensure files were uploaded
    if (!req.files || !req.files.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }

    let files = req.files.file;

    // Check if the user already has 10 images
    if (user.images.length >= 10) {
      return next(new ErrorResponse('You can upload a maximum of 10 images', 400));
    }

    console.log(user.images.length);
    const imageFiles = [];
    if (!Array.isArray(files)) {
      files = [files]; // Convert single file to array
    }

    // Limit the number of files to upload
    const filesToUpload = files.slice(0, 10 - user.images.length); // Get only the remaining slots available
    if (filesToUpload.length === 0) {
      return next(new ErrorResponse('No space left to upload more images', 400));
    }

    filesToUpload.forEach(file => {
      const filename = `${file.name}-${Date.now()}${path.extname(file.name)}`;
      imageFiles.push(filename);
      // Move the file to the uploads directory
      file.mv(`./uploads/${filename}`, err => {
        if (err) {
          return next(new ErrorResponse('Problem with file upload', 500));
        }
      });
    });

    // Add uploaded image filenames to the user's images array
    user.images = user.images.concat(imageFiles);

    // Save the updated user
    await user.save();
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error: ${error.message}` });
  }
});



// Follow a user
exports.followUser = asyncHandler(async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;

    // Find both users
    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user is already following the target user
    if (user.following.includes(targetUserId)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Add targetUser to user's following list
    user.following.push(targetUserId);
    // Add user to targetUser's followers list
    targetUser.followers.push(userId);

    // Save both users
    await user.save();
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: `Now following ${targetUser.name}`
    });
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      success: false,
      errorMessage: error
    });
  }
});

// Unfollow a user
exports.unfollowUser = asyncHandler(async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;

    // Find both users
    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user is not following the target user
    if (!user.following.includes(targetUserId)) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // Remove targetUser from user's following list
    user.following = user.following.filter(id => id.toString() !== targetUserId);
    // Remove user from targetUser's followers list
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId);

    // Save both users
    await user.save();
    await targetUser.save();

    res.status(200).json({ message: `Unfollowed ${targetUser.name}` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// API to get list of followers of a user
exports.getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).populate('followers', 'name email bio image birth_day birth_month gender birth_year native_language images language_to_learn createdAt __v');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const usersWithImages = user.followers.map(user => {
    let imageUrls = [];
    if (Array.isArray(user.images) && user.images.length > 0) {
      imageUrls = user.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`);
    }
    return {
      ...user._doc,
      imageUrls: imageUrls
    };
  });

  res.status(200).json({
    message: 'Success',
    note: `Followers of ${user.name}`,
    count: user.followers.length,
    followers: usersWithImages,
  });
});

// API to get list of users a user is following
exports.getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).populate('following', 'name email bio image birth_day birth_month gender birth_year native_language images language_to_learn createdAt __v');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const usersWithImages = user.following.map(user => {
    let imageUrls = [];
    if (Array.isArray(user.images) && user.images.length > 0) {
      imageUrls = user.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`);
    }
    return {
      ...user._doc,
      imageUrls: imageUrls
    };
  });

  res.status(200).json({
    note: `Users followed by ${user.name}`,
    following: usersWithImages,
    message: 'Success',
    count: usersWithImages.length,
  });
});