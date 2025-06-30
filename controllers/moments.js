const path = require('path');
const asyncHandler = require('../middleware/async');
const Moment = require('../models/Moment');
const ErrorResponse = require('../utils/errorResponse');


exports.getMoments = asyncHandler(async (req, res, next) => {
  try {
    const moments = await Moment.find().populate('user', 'name email mbti bio bloodType image birth_day birth_month gender birth_year native_language images language_to_learn createdAt __v');

    const momentsWithImages = moments.map(moment => {
      const userWithImageUrls = {
        ...moment.user._doc,
        imageUrls: moment.user.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      };
      return {
        commentCount: moment.comments,
        ...moment._doc,
        user: userWithImageUrls,
        imageUrls: moment.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      };
    });


    res.status(200).json(momentsWithImages);
  } catch (err) {

    res.status(500).json({ error: 'Server error' });
  }
});

// @desc Get single moment
// @route Get /api/v1/moments/:id
// @access Public
exports.getMoment = asyncHandler(async (req, res, next) => {
  // Find the moment by ID and populate user details

  try {

    const moment = await Moment.findById(req.params.id)
      .populate('user', 'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v')
      .populate('comments', 'text user moment');

    // Check if moment exists
    if (!moment) {
      return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
    }
    // Construct image URLs
    const imageUrls = (moment.images || []).map(image =>
      `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
    );
    const userImages = (moment.user.images || []).map(image =>
      `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
    );

    // Create response object with image URLs
    const momentsWithImages = {
      ...moment._doc,
      imageUrls,
      user: {
        ...moment.user._doc,
        imageUrls: userImages
      }
    };
    // Send response
    res.status(200).json({
      success: true,
      data: momentsWithImages
    });
  }
  catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

//@desc POST create Moment
//@route POST /api/v1/moments
//@access Public

exports.createMoment = asyncHandler(async (req, res, next) => {
try {
  const moment = await Moment.create(req.body);
  // Populate the user field
  const populatedMoment = await moment.populate('user', 'name email bio image birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');


  const momentsWithImages = {
    ...moment._doc,
    imageUrls: populatedMoment.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
  }
  res.status(200).json({
    success: true,
    data: momentsWithImages
  });
}
catch (error) {
  res.status(500).json({ error: 'Server error', message: `Error ${error}` });
}
});



//@desc Delete Moment
//@route DELETE /api/v1/moments/:id
//@access Private

exports.deleteMoment = asyncHandler(async (req, res, next) => {
 try {
  const moment = await Moment.findByIdAndDelete(req.params.id);
  if (!moment) {
    return next(
      new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
    );
  }
  moment.remove();
  res.status(200).json({ success: true, data: {}, message: 'Moment Deleted' });
 }
 catch (error) {
  res.status(500).json({ error: 'Server error', message: `Error ${error}` });
}
});


//@desc Upload photos for moment
//@route PUT /api/v1/moments/:id/photos
//@access Private

exports.momentPhotoUpload = asyncHandler(async (req, res, next) => {
  try {
    const moment = await Moment.findById(req.params.id);
    if (!moment) {
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
    moment.images = moment.images.concat(imageFiles);
    await moment.save();
  
  
    res.status(200).json({
      success: true,
      data: moment
    });
  }
  catch(error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }

});



//@desc Get all moments for a single user
//@route Get /api/v1/moments/user/:userId
//@access Public

exports.getUserMoments = asyncHandler(async (req, res, next) => {
  try {
    const moments = await Moment.find({ user: req.params.userId }).populate(
      'user',
      'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v'
    );

    const momentsWithUserImages = moments.map((moment) => {
      const userWithImageUrls = {
        ...moment.user._doc,
        imageUrls: moment.user.images.map(
          (image) => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
        ),
      };

      return {
        ...moment._doc,
        user: userWithImageUrls, // Now the user object contains imageUrls
        imageUrls: moment.images.map(
          (image) => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
        ),
      };
    });

      // sendTokenResponse(req.params.userId, 200, res);

    res.status(200).json({
      success: true,
      count: momentsWithUserImages.length,
      data: momentsWithUserImages,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});


//@desc Update a specific moment for a user
//@route PUT /api/v1/moments/:momentId
//@access Private (assuming users should only update their own moments)
exports.updateMoment = asyncHandler(async (req, res, next) => {
  try {
    // Find the moment
    let moment = await Moment.findById(req.params.id);

    // If moment doesn't exist
    if (!moment) {
      return res.status(404).json({
        success: false,
        message: 'Moment not found'
      });
    }

    // Check if user owns the moment (assuming req.user.id comes from auth middleware)
    if (moment.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update this moment'
      });
    }

    // Process any uploaded images if they exist in the request
    if (req.files && req.files.length > 0) {
      // Add new images to the existing ones
      const newImages = req.files.map(file => file.filename);
      req.body.images = [...moment.images, ...newImages];
    }

    // Update the moment
    moment = await Moment.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true, // Return the updated document
        runValidators: true // Run schema validators on update
      }
    );

      if (!moment) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update moment'
      });
    }
      await moment.populate(
      'user',
      'name email bio images birth_day birth_month gender birth_year native_language language_to_learn createdAt __v'
    );
    // Format response with image URLs similar to GET method
    const userWithImageUrls = {
      ...moment.user._doc,
      imageUrls: moment.user.images.map(
        (image) => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
      ),
    };

    const updatedMoment = {
      ...moment._doc,
      user: userWithImageUrls,
      imageUrls: moment.images.map(
        (image) => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
      ),
    };

    res.status(200).json({
      success: true,
      data: updatedMoment
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Server error', 
      message: `Error ${error}` 
    });
  }
});



//@desc Like a moment
//@route POST /api/v1/moments/:id/like
//@access Private
exports.likeMoment = asyncHandler(async (req, res, next) => {
  try {
    const moment = await Moment.findById(req.params.id);

    if (!moment) {
      return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
    }

    const userId = req.body.userId; // Ensure this user ID is obtained from request body or session

    // Check if the user has already liked this moment
    if (moment.likedUsers.includes(userId)) {
      return res.status(400).json({ message: 'You have already liked this moment' });
    }

    // Add user to likedUsers and increment likeCount
    moment.likedUsers.push(userId);
    if (moment.likeCount < 0) {
      moment.likeCount = 0
    }
    else {
      moment.likeCount += 1;
      await moment.save();
    }
    res.status(200).json({
      success: true,
      data: moment
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});

//@desc Like a moment
//@route POST /api/v1/moments/:id/dislike
//@access Private
exports.dislikeMoment = asyncHandler(async (req, res, next) => {
  try {
    const moment = await Moment.findById(req.params.id);
    if (!moment) {
      return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
    }

    const userId = req.body.userId; // Ensure this user ID is obtained from request body or session

    // Check if the user has already liked this moment
    // if (moment.likedUsers.includes(userId)) {
    //   return res.status(400).json({ message: 'You have already disliked' });
    // }

    // remove the user from the list of array
    moment.likedUsers = moment.likedUsers.filter(user => user.toString() !== userId);
    if (moment.likeCount < 0) {
      moment.likeCount = 0
    }
    else {
      moment.likeCount -= 1;
      await moment.save();
    }
    res.status(200).json({
      success: true,
      data: moment
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error', message: `Error ${error}` });
  }
});