const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const cookieParser = require('cookie-parser');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const passport  = require('passport')
const FacebookStrategy = require('passport-facebook').Strategy
const path = require('path');
// Configure Passport to use Facebook
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: '/api/v1/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'photos'],
    },
    async (accessToken, refreshToken, profile, done) => {
      const { id, emails, name, photos } = profile;

      try {
        let user = await User.findOne({ facebookId: id });
        
        if (!user) {
          user = await User.create({
            facebookId: id,
            // email: emails[0]?.value,
            name: `${name.givenName} ${name.familyName}`,
            images: photos[0]?.value,
          });

          user = await User.create({
            facebookId: id,
            email:'test@gmail.com',
            bio,
            gender,
            password,
            birth_year,
            birth_month,
            birth_day,
            image,
            native_language,
            language_to_learn
          });
        }
        
        sendTokenResponse(user, 200, res);

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// Facebook login route
exports.facebookLogin = (req, res, next) => {
  passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
};

// Facebook callback route
exports.facebookCallback = (req, res, next) => {
  passport.authenticate('facebook', { session: false }, (err, user) => {
    console.log(res)


    if (err || !user) {
      return res.status(400).json({ success: false, error: 'Facebook login failed' });
    }

    // Send token response
    sendTokenResponse(user, 200, res);
  })(req, res, next);
};
//@desc Register User
//@route Post /api/v1/auth/register
//@access Public
exports.register = asyncHandler(async (req, res, next) => {
  // const file = req.file;
  const { name, email, gender, password, bio, birth_year, birth_month, birth_day, image, native_language, language_to_learn } = req.body;
  req.body;
  // const imageBase64 = fs.readFileSync(file.path, 'base64');
  
  const user = await User.create({
    name,
    email,
    bio,
    gender,
    password,
    birth_year,
    birth_month,
    birth_day,
    image,
    native_language,
    language_to_learn
  });
  sendTokenResponse(user, 200, res);
});
//@desc  User Login
//@route Post /api/v1/auth/login
//@access Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  // Validate email and password
  if (!email || !password) {
    return next(
      new ErrorResponse('Please provide and email and password', 400)
    );
  }
  // Check for user
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 400));
  }
  const imageUrls = (user.images || []).map(image =>
    `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
  );
  user.images = imageUrls
  // check if password matches
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }
  sendTokenResponse(user, 200, res);
});

//@desc  logout user
//@route Get /api/v1/auth/logout
//@access Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({
    success: true,
    data: {}
  });
});

//@desc  Get current logged in user
//@route Post /api/v1/auth/me
//@access Private
exports.getMe = asyncHandler(async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    console.log(user)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const userWithImageUrls = {
      ...user._doc,
      imageUrls: user.images.map(image => `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`)
    };
    res.status(200).json({
      success: true,
      data: userWithImageUrls
    });
    console.log(userWithImageUrls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

//@desc  Forgot Password
//@route Post /api/v1/auth/forgotpassword
//@access Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ErrorResponse('There is no user with that email', 404));
  }
  // Get reset token
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Create rest url
  const resetUrl = await `${req.protocol}://${req.get(
    'host'
  )}/api/v1/auth/resetpassword/${resetToken}`;
  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;
  try {
    await sendEmail({
      email: user.email,
      subject: 'Password reset token',
      message
    });
    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

//@desc  Reset Password
//@route PUT /api/v1/auth/resetpassword/:resettoken
//@access Public

exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });
  if (!user) {
    return next(new ErrorResponse('Invalid token', 400));
  }
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();
  sendTokenResponse(user, 200, res);
});

// @desc Update User Info
// @route Put /api/v1/auth/updatedetails
// @access Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  // Extract the fields to update from the request body
  const {
    name,
    email,
    gender,
    location,
    bio,
    birth_year,
    birth_month,
    birth_day,
    images,
    native_language,
    language_to_learn
  } = req.body;

  // Construct the fieldsToUpdate object with all the fields
  const fieldsToUpdate = {
    name,
    email,
    gender,
    bio,
    birth_year,
    birth_month,
    birth_day,
    images,
    native_language,
    language_to_learn, location
  };

  // Find and update the user
  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  // If user is not found
  if (!user) {
    return next(new ErrorResponse(`No user found with id of ${req.user.id}`, 404));
  }
  // Send response
  res.status(200).json({
    success: true,
    data: user
  });
});


//@desc  Update Password
//@route PUT /api/v1/auth/updatepassword
//@access Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  // Check for user
  const user = await User.findById(req.user.id).select('+password');
  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse('Password is incorrect', 401));
  }
  user.password = req.body.newPassword;
  await user.save();
  sendTokenResponse(user, 200, res);
});

// Get token from model, create cookie and send response
// Helper Function

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
