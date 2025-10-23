const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;

// In-memory verification storage with automatic cleanup
const usersVerification = {};

// Clean expired verification codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(usersVerification).forEach(email => {
    if (usersVerification[email].expiration < now) {
      delete usersVerification[email];
    }
  });
},5 * 60 * 1000);

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
        const email = emails && emails[0] ? emails[0].value : null;
        
        // Try to find existing user by Facebook ID first
        let user = await User.findOne({ facebookId: id });
        
        if (!user && email) {
          // If no Facebook user found, check if user exists by email
          user = await User.findOne({ email });
          
          if (user) {
            // Link Facebook account to existing user
            user.facebookId = id;
            if (photos && photos[0] && (!user.images || user.images.length === 0)) {
              user.images = [photos[0].value];
            }
            await user.save();
          }
        }
        
        if (!user) {
          // Create new user if not found
          user = await User.create({
            facebookId: id,
            email,
            name: `${name.givenName || ''} ${name.familyName || ''}`.trim(),
            images: photos && photos[0] ? [photos[0].value] : [],
            isVerified: true, // Facebook users are pre-verified
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

    sendTokenResponse(user, 200, res, req);
  })(req, res, next);
});

/**
 * @desc    Register User
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { 
    email, 
    password, 
    name, 
    gender, 
    bio, 
    birth_year, 
    birth_month, 
    birth_day,
    images,
    native_language,
    language_to_learn,
    mbti,
    bloodType
  } = req.body;

  // Validate required fields
  if (!email || !password || !name || !gender || !bio || !birth_year || !birth_month || !birth_day  || !native_language || !language_to_learn) {
    return next(new ErrorResponse('Please provide all required fields', 400));
  }

  // Find user by email
  const user = await User.findOne({ email });

  if (!user) {
    return next(new ErrorResponse('Please verify your email first', 400));
  }

  if (!user.isEmailVerified) {
    return next(new ErrorResponse('Please verify your email before completing registration', 400));
  }

  // Check if user already completed registration
  if (user.name && !user.name.startsWith('TempUser_')) {
    return next(new ErrorResponse('User already registered. Please login instead.', 400));
  }

  // Update user with actual data
  user.name = name;
  user.gender = gender;
  user.password = password; // Will be hashed by pre-save middleware
  user.bio = bio;
  user.birth_year = birth_year;
  user.birth_month = birth_month;
  user.birth_day = birth_day;
  user.native_language = native_language;
  user.language_to_learn = language_to_learn;
  
  // Optional fields
  if (mbti) user.mbti = mbti;
  if (bloodType) user.bloodType = bloodType;

  await user.save();

  // Send token response
  sendTokenResponse(user, 201, res);
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
  
  sendTokenResponse(user, 200, res, req);
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
    const userObject = processUserImages(user, req);
    
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
 * @route   POST /api/v1/auth/send-verification-code
 * @access  Public
 */
exports.sendVerificationCode = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(new ErrorResponse('Please provide an email address', 400));
  }

  // Email validation
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!emailRegex.test(email)) {
    return next(new ErrorResponse('Please provide a valid email address', 400));
  }

  // Check if user already exists and is verified
  let user = await User.findOne({ email }).select('+emailVerificationCode +emailVerificationExpire');
  
  if (user && user.isEmailVerified) {
    return next(new ErrorResponse('A user with this email already exists', 400));
  }

  // If user exists but not verified, regenerate code
  // If user doesn't exist, create temporary user
  if (!user) {
    user = await User.create({
      email,
      name: 'TempUser_' + Date.now(),
      gender: 'not_set',
      password: crypto.randomBytes(32).toString('hex'),
      bio: 'User bio not set yet',
      birth_year: '2000',
      birth_month: '01',
      birth_day: '01',
      images: ['default.jpg'],
      native_language: 'English',
      language_to_learn: 'Korean',
      isEmailVerified: false
    });
  }

  // Generate verification code
  const code = user.generateEmailVerificationCode();
  await user.save({ validateBeforeSave: false });

  // Email content
  const message = `Your verification code for BanaTalk is: ${code}. This code will expire in 15 minutes.`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f6f6f6; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f6f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Welcome to BanaTalk! 🎉</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
                Thank you for signing up! To complete your registration, please use the verification code below:
              </p>
              
              <!-- Verification Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border: 3px solid #667eea; border-radius: 12px; padding: 25px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                            Your Verification Code
                          </p>
                          <p style="margin: 0; font-size: 42px; font-weight: bold; color: #667eea; letter-spacing: 10px; font-family: 'Courier New', monospace; text-align: center;">
                            ${code}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                      ⏰ <strong>Important:</strong> This code will expire in <strong>15 minutes</strong>. Please complete your registration soon!
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #999999; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                If you didn't request this code, please ignore this email and no account will be created.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                Need help? Contact us at <a href="mailto:support@banatalk.com" style="color: #667eea; text-decoration: none;">support@banatalk.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                © ${new Date().getFullYear()} BanaTalk. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  
  try {
    await sendEmail({
      email: user.email,
      subject: 'BanaTalk - Email Verification Code',
      message,
      html
    });

    res.status(200).json({ 
      success: true, 
      message: 'Verification code sent to your email',
      data: {
        email: user.email,
        expiresIn: '15 minutes'
      }
    });
  } catch (err) {
    console.error('❌ Email sending error:', err);
    
    // Clear verification fields on error
    user.emailVerificationCode = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });
    
    return next(new ErrorResponse('Email could not be sent. Please try again later.', 500));
  }
});

/**
 * @desc    Verify Email Code
 * @route   POST /api/v1/auth/verify-code
 * @access  Public
 */
exports.verifyCode = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return next(new ErrorResponse('Please provide both email and verification code', 400));
  }

  // Hash the provided code
  const hashedCode = crypto
    .createHash('sha256')
    .update(code.toString())
    .digest('hex');

  // Find user with matching email, code, and non-expired verification
  const user = await User.findOne({
    email,
    emailVerificationCode: hashedCode,
    emailVerificationExpire: { $gt: Date.now() }
  }).select('+emailVerificationCode +emailVerificationExpire');

  if (!user) {
    return next(new ErrorResponse('Invalid or expired verification code', 400));
  }

  // Mark email as verified and clear verification fields
  user.isEmailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpire = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ 
    success: true, 
    message: 'Email verified successfully! You can now complete your registration.',
    data: {
      email: user.email,
      verified: true
    }
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
  sendTokenResponse(user, 200, res, req);
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
  
  sendTokenResponse(user, 200, res, req);
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
  
  sendTokenResponse(user, 200, res, req);
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
    
    return userObject;
  }
  return user.toObject ? user.toObject() : { ...user };
}

/**
 * Helper function to generate and send JWT token response
 */
const sendTokenResponse = (user, statusCode, res, req = null) => {
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
    
    // Convert user to plain object for response and add image URLs if req is available
    const userObject = req ? processUserImages(user, req) : (user.toObject ? user.toObject() : { ...user });
    
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