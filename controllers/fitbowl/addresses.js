const asyncHandler = require('../../middleware/async');
const Address = require('../../models/fitbowl/Address');
const ErrorResponse = require('../../utils/errorResponse');

// @desc    Get user's addresses
// @route   GET /api/v1/fitbowl/addresses
// @access  Private
exports.getAddresses = asyncHandler(async (req, res, next) => {
  const addresses = await Address.find({ user: req.user.id })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    count: addresses.length,
    data: addresses
  });
});

// @desc    Create address
// @route   POST /api/v1/fitbowl/addresses
// @access  Private
exports.createAddress = asyncHandler(async (req, res, next) => {
  req.body.user = req.user.id;

  // If setting as default, unset other defaults first
  if (req.body.isDefault) {
    await Address.updateMany(
      { user: req.user.id, isDefault: true },
      { isDefault: false }
    );
  }

  const address = await Address.create(req.body);

  res.status(201).json({
    success: true,
    data: address
  });
});

// @desc    Update address
// @route   PUT /api/v1/fitbowl/addresses/:id
// @access  Private
exports.updateAddress = asyncHandler(async (req, res, next) => {
  let address = await Address.findById(req.params.id);

  if (!address) {
    return next(new ErrorResponse(`Address not found with id of ${req.params.id}`, 404));
  }

  // Verify belongs to user
  if (address.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to update this address', 403));
  }

  // If setting as default, unset other defaults first
  if (req.body.isDefault) {
    await Address.updateMany(
      { user: req.user.id, isDefault: true, _id: { $ne: req.params.id } },
      { isDefault: false }
    );
  }

  address = await Address.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: address
  });
});

// @desc    Delete address
// @route   DELETE /api/v1/fitbowl/addresses/:id
// @access  Private
exports.deleteAddress = asyncHandler(async (req, res, next) => {
  const address = await Address.findById(req.params.id);

  if (!address) {
    return next(new ErrorResponse(`Address not found with id of ${req.params.id}`, 404));
  }

  // Verify belongs to user
  if (address.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to delete this address', 403));
  }

  await Address.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Set address as default
// @route   PUT /api/v1/fitbowl/addresses/:id/default
// @access  Private
exports.setDefault = asyncHandler(async (req, res, next) => {
  const address = await Address.findById(req.params.id);

  if (!address) {
    return next(new ErrorResponse(`Address not found with id of ${req.params.id}`, 404));
  }

  // Verify belongs to user
  if (address.user.toString() !== req.user.id) {
    return next(new ErrorResponse('Not authorized to update this address', 403));
  }

  // Unset all other defaults for this user
  await Address.updateMany(
    { user: req.user.id, isDefault: true },
    { isDefault: false }
  );

  // Set this one as default
  address.isDefault = true;
  await address.save();

  res.status(200).json({
    success: true,
    data: address
  });
});
