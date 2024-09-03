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
  console.log(req,res);
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(
      new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
    );
  }
  // Ensure files were uploaded
  if (!req.files || !req.files.file) {
    return next(new ErrorResponse('Please upload a file', 400));
  }
  let files = req.files.file;
  const imageFiles = [];
  if (!Array.isArray(files)) {
    files = [files]; // Convert single file to array
  }
  files.forEach(file => {
    const filename = `${file.name}-${Date.now()}${path.extname(file.name)}`;
    imageFiles.push(filename);
    // Move the file to the uploads directory
    file.mv(`./uploads/${filename}`, err => {
      if (err) {
        return next(new ErrorResponse('Problem with file upload', 500));
      }
    });
  });
  // Add uploaded image filenames to the moment's images array
  user.images = user.images.concat(imageFiles);

  // Save the updated moment
  await user.save();
  res.status(200).json({
    success: true,
    data: user
  });
});