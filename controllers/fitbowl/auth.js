const asyncHandler = require('../../middleware/async');
const FitBowlUser = require('../../models/fitbowl/FitBowlUser');
const ErrorResponse = require('../../utils/errorResponse');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/v1/fitbowl/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const {
    name,
    email,
    password,
    phone,
    dietaryPreferences,
    allergies,
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget
  } = req.body;

  const user = await FitBowlUser.create({
    name,
    email,
    password,
    phone,
    dietaryPreferences,
    allergies,
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget
  });

  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/v1/fitbowl/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  const user = await FitBowlUser.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Google authentication (verify ID token server-side)
// @route   POST /api/v1/fitbowl/auth/google
// @access  Public
exports.googleAuth = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;

  if (!idToken) {
    return next(new ErrorResponse('ID token is required', 400));
  }

  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify the ID token with Google - reuse same client IDs as Bananatalk
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID,
        '810869785173-6jl1i1b32lghpsdq6lp92a7b1vuedoh4.apps.googleusercontent.com',
        '28446912403-2ba6tssqm95r6iu6cov7c6riv00gposo.apps.googleusercontent.com'
      ]
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Try to find existing user by Google ID
    let user = await FitBowlUser.findOne({ googleId });

    if (!user && email) {
      user = await FitBowlUser.findOne({ email });

      if (user) {
        user.googleId = googleId;
        if (picture && !user.avatar) {
          user.avatar = picture;
        }
        await user.save();
      }
    }

    if (!user) {
      user = await FitBowlUser.create({
        googleId,
        email,
        name: name || 'User',
        avatar: picture || ''
      });
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('FitBowl Google auth error:', error.message);
    return next(new ErrorResponse('Invalid Google token', 401));
  }
});

// @desc    Apple authentication (verify identity token server-side)
// @route   POST /api/v1/fitbowl/auth/apple
// @access  Public
exports.appleAuth = asyncHandler(async (req, res, next) => {
  const { identityToken, user: appleUser } = req.body;

  if (!identityToken) {
    return next(new ErrorResponse('Identity token is required', 400));
  }

  try {
    const appleSignin = require('apple-signin-auth');

    // Verify the identity token with Apple - reuse same bundle ID as Bananatalk
    const appleResponse = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_BUNDLE_ID || 'com.banatalk.app',
      ignoreExpiration: false
    });

    const { sub: appleId, email } = appleResponse;

    // Try to find existing user by Apple ID
    let user = await FitBowlUser.findOne({ appleId });

    if (!user && email) {
      user = await FitBowlUser.findOne({ email });

      if (user) {
        user.appleId = appleId;
        await user.save();
      }
    }

    if (!user) {
      const fullName = appleUser?.fullName;
      const userName = fullName
        ? `${fullName.givenName || ''} ${fullName.familyName || ''}`.trim()
        : 'User';

      user = await FitBowlUser.create({
        appleId,
        email: email || `${appleId}@privaterelay.appleid.com`,
        name: userName || 'User'
      });
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('FitBowl Apple auth error:', error.message);
    return next(new ErrorResponse('Invalid Apple token', 401));
  }
});

// @desc    Get current logged in user
// @route   GET /api/v1/fitbowl/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await FitBowlUser.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user profile
// @route   PUT /api/v1/fitbowl/auth/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const allowedFields = [
    'name',
    'phone',
    'avatar',
    'dietaryPreferences',
    'allergies',
    'calorieTarget',
    'proteinTarget',
    'carbTarget',
    'fatTarget'
  ];

  const fieldsToUpdate = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      fieldsToUpdate[field] = req.body[field];
    }
  });

  const user = await FitBowlUser.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Forgot password
// @route   POST /api/v1/fitbowl/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await FitBowlUser.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  // Email sending is Phase 2
  res.status(200).json({
    success: true,
    message: 'Password reset token generated. Email sending is Phase 2.',
    resetToken
  });
});

// @desc    Reset password
// @route   PUT /api/v1/fitbowl/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await FitBowlUser.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired reset token', 400));
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Update FCM token
// @route   PUT /api/v1/fitbowl/auth/fcmtoken
// @access  Private
exports.updateFcmToken = asyncHandler(async (req, res, next) => {
  const { fcmToken } = req.body;

  if (!fcmToken) {
    return next(new ErrorResponse('Please provide an FCM token', 400));
  }

  const user = await FitBowlUser.findByIdAndUpdate(
    req.user.id,
    { fcmToken },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: user
  });
});

/**
 * Helper function to generate and send JWT token response
 */
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    data: user
  });
};
