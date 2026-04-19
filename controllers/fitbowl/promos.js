const asyncHandler = require('../../middleware/async');
const PromoCode = require('../../models/fitbowl/PromoCode');
const ErrorResponse = require('../../utils/errorResponse');

// @desc    Get all promo codes
// @route   GET /api/v1/fitbowl/promos
// @access  Private (admin)
exports.getPromoCodes = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const [total, promoCodes] = await Promise.all([
    PromoCode.countDocuments(),
    PromoCode.find()
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  res.status(200).json({
    success: true,
    count: promoCodes.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: promoCodes
  });
});

// @desc    Create promo code
// @route   POST /api/v1/fitbowl/promos
// @access  Private (admin)
exports.createPromoCode = asyncHandler(async (req, res, next) => {
  const promoCode = await PromoCode.create(req.body);

  res.status(201).json({
    success: true,
    data: promoCode
  });
});

// @desc    Update promo code
// @route   PUT /api/v1/fitbowl/promos/:id
// @access  Private (admin)
exports.updatePromoCode = asyncHandler(async (req, res, next) => {
  const promoCode = await PromoCode.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!promoCode) {
    return next(new ErrorResponse(`Promo code not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: promoCode
  });
});

// @desc    Delete promo code
// @route   DELETE /api/v1/fitbowl/promos/:id
// @access  Private (admin)
exports.deletePromoCode = asyncHandler(async (req, res, next) => {
  const promoCode = await PromoCode.findByIdAndDelete(req.params.id);

  if (!promoCode) {
    return next(new ErrorResponse(`Promo code not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Validate a promo code (check without applying)
// @route   POST /api/v1/fitbowl/promos/validate
// @access  Private
exports.validatePromoCode = asyncHandler(async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return next(new ErrorResponse('Please provide a promo code', 400));
  }

  const promo = await PromoCode.findOne({ code: code.toUpperCase() });

  if (!promo) {
    return next(new ErrorResponse('Invalid promo code', 404));
  }

  // Check if active
  if (!promo.isActive) {
    return next(new ErrorResponse('This promo code is no longer active', 400));
  }

  // Check date range
  const now = new Date();
  if (promo.startDate && now < promo.startDate) {
    return next(new ErrorResponse('This promo code is not yet active', 400));
  }

  if (promo.endDate && now > promo.endDate) {
    return next(new ErrorResponse('This promo code has expired', 400));
  }

  // Check usage limit
  if (promo.maxUses && promo.currentUses >= promo.maxUses) {
    return next(new ErrorResponse('This promo code has reached its usage limit', 400));
  }

  // Check if user already used it
  if (promo.usedBy && promo.usedBy.includes(req.user.id)) {
    return next(new ErrorResponse('You have already used this promo code', 400));
  }

  res.status(200).json({
    success: true,
    data: {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maxDiscount: promo.maxDiscount,
      minOrderAmount: promo.minOrderAmount,
      description: promo.description
    }
  });
});
