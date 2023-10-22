const path = require('path');
const asyncHandler = require('../middleware/async');
const Moment = require('../models/Moment');
const ErrorResponse = require('../utils/errorResponse');
const uploadFile = require('../middleware/upload');

//@desc Get all moments
//@route Get /api/v1/moments
//@access Public

exports.getMoments = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

//@desc Get single moments
//@route Get /api/v1/moments/:id
//@access Public

exports.getMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.findById(req.params.id);
  if (!moment) {
    return next(
      new ErrorResponse(`Moment not found with id of ${req.params.id}`, 404)
    );
  }
  res.status(200).json({ success: true, data: moment });
});

//@desc POST create Moment
//@route POST /api/v1/moments
//@access Public

exports.createMoment = asyncHandler(async (req, res, next) => {
  const moment = await Moment.create(req.body);
  res.status(200).json({
    success: true,
    data: moment
  });
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
