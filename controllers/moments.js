const path = require('path');
const asyncHandler = require('../middleware/async');
const Moment = require('../models/Moment');
const ErrorResponse = require('../utils/errorResponse');
const uploadFile = require('../middleware/upload');

//@desc Get all moments
//@route Get /api/v1/moments
//@access Public

// exports.getMoments = asyncHandler(async (req, res, next) => {
//   res.status(200).json(res.advancedResults);
// });

exports.getMoments = asyncHandler(async (req, res, next) => {
  try {
    const moments = await Moment.find().populate('user', 'name email bio image birth_day birth_month gender birth_year native_language images language_to_learn createdAt __v');
    const momentsWithImages = moments.map(moment => {
      const userWithImageUrls = {
        ...moment.user._doc,
        imageUrls: moment.user.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      };
      return {
        ...moment._doc,
        user: userWithImageUrls,
        imageUrls: moment.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
      };
    });

    res.status(200).json(momentsWithImages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

//@desc Get single moments
//@route Get /api/v1/moments/:id
//@access Public

exports.getMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findById(req.params.id)
    .populate('user', 'name email bio image birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');

  if (!moment) {
    return next(new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404));
  }
  const momentsWithImages = {
    ...moment._doc,
    imageUrls: moment.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
  }  
  res.status(200).json({
    success: true,
    data: momentsWithImages
  });
});

//@desc POST create Moment
//@route POST /api/v1/moments
//@access Public

exports.createMoment = asyncHandler(async (req, res, next) => {
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
  // res.status(201).json({
  //   success: true,
  //   data: populatedMoment
  // });
});

//@desc Update Moment
//@route PUT /api/v1/moments/:id
//@access Private

exports.updateMoment = asyncHandler(async (req, res, next) => {
  let moment = await Moment.findById(req.params.id);
  if (!moment) {
    return next(
      new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
    );
  }
  moment = await Moment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  res.status(200).json({ success: true, data: moment });
});

//@desc Delete Moment
//@route DELETE /api/v1/moments/:id
//@access Private

exports.deleteMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findByIdAndDelete(req.params.id);
  if (!moment) {
    return next(
      new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
    );
  }
  moment.remove();
  res.status(200).json({ success: true, data: {}, message: 'Moment Deleted' });
});


//@desc Upload photos for moment
//@route PUT /api/v1/moments/:id/photos
//@access Private

exports.momentPhotoUpload = asyncHandler(async (req, res, next) => {
  console.log(req,res);
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

  // Save the updated moment
  await moment.save();
  console.log(res);

  res.status(200).json({
    success: true,
    data: moment
  });
});



//@desc Get all moments for a single user
//@route Get /api/v1/moments/user/:userId
//@access Public

exports.getUserMoments = asyncHandler(async (req, res, next) => {
  try {
    const moments = await Moment.find({ user: req.params.userId }).populate('user', 'name email bio image birth_day birth_month gender birth_year native_language language_to_learn createdAt __v');
    res.status(200).json({
      success: true,
      count:moments.length,
      data: moments,
   
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});