const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;

// In-memory verification storage with automatic cleanup
const usersVerification = {};

// Clean expired verification codes every 15 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(usersVerification).forEach(email => {
    if (usersVerification[email].expiration < now) {
      delete usersVerification[email];
    }
  });
}, 15 * 60 * 1000);

/**
 * Configure Facebook Authentication Strategy
 */
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: '/api/v1/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'photos'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, name, photos } = profile;
        
        // Try to find existing user by Facebook ID
        let user = await User.findOne({ facebookId: id });
        
        if (!user) {
          // Create new user if not found
          user = await User.create({
            facebookId: id,
            email: emails && emails[0] ? emails[0].value : null,
            name: `${name.givenName || ''} ${name.familyName || ''}`.trim(),
            images: photos && photos[0] ? [photos[0].value] : [],
            // Other fields can be set to default values or collected later
          });
        }
        
        return done(null, user);
      } catch (err) {
        console.error('Facebook auth error:', err);
        return done(err, null);
      }
    }
  )
);

/**
 * @desc    Facebook login route
 * @route   GET /api/v1/auth/facebook
 * @access  Public
 */
exports.facebookLogin = (req, res, next) => {
  passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
};

/**
 * @desc    Facebook callback route
 * @route   GET /api/v1/auth/facebook/callback
 * @access  Public
 */
exports.facebookCallback = asyncHandler(async (req, res, next) => {
  passport.authenticate('facebook', { session: false }, async (err, user) => {
    if (err) {
      console.error('Facebook auth callback error:', err);
      return next(new ErrorResponse('Facebook authentication failed', 500));
    }
    
    if (!user) {
      return next(new ErrorResponse('Facebook login failed, no user returned', 400));
    }

    sendTokenResponse(user, 200, res);
  })(req, res, next);
});

/**
 * @desc    Register User
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { 
    name, 
    email, 
    gender, 
    password, 
    bio, 
    birth_year, 
    birth_month, 
    birth_day, 
    image, 
    native_language, 
    language_to_learn 
  } = req.body;
  
  // Create user with validated data
  const user = await User.create({
    name,
    email,
    bio,
    gender,
    password,
    birth_year,
    birth_month,
    birth_day,
    images: image ? [image] : [],
    native_language,
    language_to_learn
  });
  
  sendTokenResponse(user, 200, res);
});

/**
 * @desc    User Login
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  
  // Validate email and password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }
  
  // Check for user
  const user = await User.findOne({ email }).select('+password');
  
  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 400));
  }
  
  // Check if password matches
  const isMatch = await user.matchPassword(password);
  
  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }
  
  // Convert to object to safely modify without impacting schema
  const userObject = user.toObject();
  
  // Add image URLs
  if (userObject.images && Array.isArray(userObject.images)) {
    userObject.imageUrls = userObject.images.map(image => 
      `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
    );
  }
  
  // Use the original user for token generation, but return enhanced object
  const token = user.getSignedJwtToken();
  
  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  
  // Secure cookies in production
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }
  
  res.status(200)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: userObject
    });
});

/**
 * @desc    Logout user
 * @route   GET /api/v1/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true
  });
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res, next) => {
  try {
    // Find the user but don't modify the original document
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }
    
    // Convert user to plain object and add image URLs
    const userObject = user.toObject();
    
    // Add full URLs for all images
    if (userObject.images && Array.isArray(userObject.images)) {
      userObject.imageUrls = userObject.images.map(image => 
        `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
      );
    }
    
    res.status(200).json({
      success: true,
      data: userObject
    });
  } catch (err) {
    console.error('Get me error:', err);
    return next(new ErrorResponse('Failed to retrieve user data', 500));
  }
});

/**
 * @desc    Send Email Verification Code
 * @route   POST /api/v1/auth/sendCodeEmail
 * @access  Public
 */
exports.sendEmailCode = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(new ErrorResponse('Email is required', 400));
  }

  const user = await User.findOne({ email });
  
  if (!user) {
    return next(new ErrorResponse('No user found with this email', 404));
  }

  // Generate a secure random code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiration = Date.now() + 15 * 60 * 1000; // 15 minutes

  // Store verification data
  usersVerification[email] = { code, expiration };

  const message = `Your verification code is: ${code}`;
  
  try {
    await sendEmail({
      email,
      subject: 'Email Verification Code',
      message,
    });

    res.status(200).json({ 
      success: true, 
      message: 'Verification code sent',
      expiresIn: '15 minutes'
    });
  } catch (err) {
    console.error('Email sending error:', err);
    return next(new ErrorResponse('Email could not be sent', 500));
  }
});

/**
 * @desc    Verify Email Code
 * @route   POST /api/v1/auth/checkEmailCode
 * @access  Public
 */
exports.checkEmailCode = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return next(new ErrorResponse('Email and code are required', 400));
  }

  const verification = usersVerification[email];
  
  if (!verification) {
    return next(new ErrorResponse('No verification code found for this email', 400));
  }
  
  if (verification.code !== code) {
    return next(new ErrorResponse('Invalid verification code', 400));
  }

  if (verification.expiration < Date.now()) {
    // Remove expired code
    delete usersVerification[email];
    return next(new ErrorResponse('Verification code has expired', 400));
  }

  // Mark user as verified in DB
  const user = await User.findOne({ email });
  
  if (user) {
    user.isVerified = true;
    await user.save();
  }

  // Don't delete the verification yet if it might be needed for password reset

  res.status(200).json({ 
    success: true, 
    message: 'Email verified successfully' 
  });
});

/**
 * @desc    Reset Password after Email Verification
 * @route   POST /api/v1/auth/resetpassword
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { email, newPassword } = req.body;
  
  if (!email || !newPassword) {
    return next(new ErrorResponse('Email and new password are required', 400));
  }

  // Find the user by email
  const user = await User.findOne({ email });
  
  if (!user) {
    return next(new ErrorResponse('User not found with that email', 404));
  }

  // Check if there was a verification process (optional security check)
  const verification = usersVerification[email];
  if (!verification) {
    return next(new ErrorResponse('Email verification required before password reset', 400));
  }

  // Reset the user's password
  user.password = newPassword;

  // Clear verification data
  delete usersVerification[email];

  // Save the updated user
  await user.save();

  // Return new token
  sendTokenResponse(user, 200, res);
});

/**
 * @desc    Update User Info
 * @route   PUT /api/v1/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = asyncHandler(async (req, res, next) => {
  // Extract the fields to update
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

  // Remove undefined fields
  const fieldsToUpdate = Object.entries({
    name,
    email,
    gender,
    bio,
    birth_year,
    birth_month,
    birth_day,
    images,
    native_language,
    language_to_learn, 
    location
  }).reduce((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {});

  // Find and update the user
  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new ErrorResponse(`User not found`, 404));
  }
  
  // Convert to plain object and add image URLs
  const userObject = user.toObject();
  
  if (userObject.images && Array.isArray(userObject.images)) {
    userObject.imageUrls = userObject.images.map(image => 
      `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
    );
  }
    const token = user.getSignedJwtToken();

  // Send response
  res.status(200).json({
    success: true,
    token,
    user: userObject
  });
});

/**
 * @desc    Update Password
 * @route   PUT /api/v1/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('Current password and new password are required', 400));
  }
  
  // Check for user and include password
  const user = await User.findById(req.user.id).select('+password');
  
  if (!user) {
    return next(new ErrorResponse('User not found', 404));
  }

  // Check current password
  if (!(await user.matchPassword(currentPassword))) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }
  
  // Update password
  user.password = newPassword;
  await user.save();
  
  sendTokenResponse(user, 200, res);
});

/**
 * Helper function to process user images to include full URLs
 */
function processUserImages(user, req) {
  if (user.images && Array.isArray(user.images) && user.images.length > 0) {
    // Create a deep copy of the user object to avoid schema issues
    const userObject = user.toObject ? user.toObject() : { ...user };
    
    // Add fully qualified image URLs
    userObject.imageUrls = user.images.map(image => 
      `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
    );
    
    // For backward compatibility and direct access in templates
    if (userObject._doc) {
      userObject._doc.imageUrls = userObject.imageUrls;
    }
    
    return userObject;
  }
  return user;
}

/**
 * Helper function to generate and send JWT token response
 */
const sendTokenResponse = (user, statusCode, res) => {
  try {
    // Make sure we have a valid user with the getSignedJwtToken method
    if (!user || typeof user.getSignedJwtToken !== 'function') {
      console.error('Invalid user object or missing getSignedJwtToken method:', user);
      throw new Error('Invalid user object');
    }
    
    // Create token
    const token = user.getSignedJwtToken();
    
    const options = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true
    };
    
    // Secure cookies in production
    if (process.env.NODE_ENV === 'production') {
      options.secure = true;
    }
    
    // Convert user to plain object for response
    const userObject = user.toObject ? user.toObject() : { ...user };
    
    // Add image URLs
    if (userObject.images && Array.isArray(userObject.images)) {
      userObject.imageUrls = userObject.images.map(image => 
        `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(image)}`
      );
    }
    
    res.status(statusCode)
      .cookie('token', token, options)
      .json({
        success: true,
        token,
        user: userObject
      });
  } catch (error) {
    console.error('Error in sendTokenResponse:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};