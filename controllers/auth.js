const asyncHandler = require('../middleware/async');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { logSecurityEvent } = require('../utils/securityLogger');
const { getDeviceInfo } = require('../validators/authValidator');

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
            isEmailVerified: true, // Facebook users are pre-verified
            isRegistrationComplete: true // Facebook users skip email verification
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
 * Configure Google Authentication Strategy
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/v1/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, emails, name, photos } = profile;
        const email = emails && emails[0] ? emails[0].value : null;
        
        // Try to find existing user by Google ID first
        let user = await User.findOne({ googleId: id });
        
        if (!user && email) {
          // If no Google user found, check if user exists by email
          user = await User.findOne({ email });
          
          if (user) {
            // Link Google account to existing user
            user.googleId = id;
            if (photos && photos[0] && photos[0].value && (!user.images || user.images.length === 0)) {
              user.images = [photos[0].value];
            }
            await user.save();
          }
        }
        
        if (!user) {
          // Create new user if not found
          user = await User.create({
            googleId: id,
            email,
            name: `${name.givenName || ''} ${name.familyName || ''}`.trim() || name.displayName || 'User',
            images: photos && photos[0] && photos[0].value ? [photos[0].value] : [],
            isEmailVerified: true, // Google users are pre-verified
            isRegistrationComplete: true // Google users skip email verification
          });
        }
        
        return done(null, user);
      } catch (err) {
        console.error('Google auth error:', err);
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
      logSecurityEvent('FACEBOOK_AUTH_FAILED', {
        error: err.message
      });
      return next(new ErrorResponse('Facebook authentication failed', 500));
    }
    
    if (!user) {
      return next(new ErrorResponse('Facebook login failed, no user returned', 400));
    }

    const deviceInfo = getDeviceInfo(req);
    logSecurityEvent('FACEBOOK_LOGIN_SUCCESS', {
      userId: user._id,
      email: user.email,
      ipAddress: deviceInfo.ipAddress
    });

    sendTokenResponse(user, 200, res, req, deviceInfo);
  })(req, res, next);
});

/**
 * @desc    Google login route
 * @route   GET /api/v1/auth/google
 * @access  Public
 */
exports.googleLogin = (req, res, next) => {
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })(req, res, next);
};

/**
 * @desc    Google callback route
 * @route   GET /api/v1/auth/google/callback
 * @access  Public
 */
exports.googleCallback = asyncHandler(async (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user) => {
    if (err) {
      console.error('Google auth callback error:', err);
      logSecurityEvent('GOOGLE_AUTH_FAILED', {
        error: err.message
      });
      return next(new ErrorResponse('Google authentication failed', 500));
    }
    
    if (!user) {
      return next(new ErrorResponse('Google login failed, no user returned', 400));
    }

    const deviceInfo = getDeviceInfo(req);
    logSecurityEvent('GOOGLE_LOGIN_SUCCESS', {
      userId: user._id,
      email: user.email,
      ipAddress: deviceInfo.ipAddress
    });

    sendTokenResponse(user, 200, res, req, deviceInfo);
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
    bloodType, 
    location
  } = req.body;

  // Validate required fields
  if (!email || !password || !name || !gender || !bio || !birth_year || !birth_month || !birth_day || !native_language || !language_to_learn || !location) {
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

  // Check if registration is already complete
  if (user.isRegistrationComplete) {
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
  user.images = images ;
  user.native_language = native_language;
  user.language_to_learn = language_to_learn;
  user.location = location;
  user.isRegistrationComplete = true;  // MARK AS COMPLETE
  
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
  const deviceInfo = getDeviceInfo(req);
  
  // Validate email and password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }
  
  // Check for user
  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');
  
  if (!user) {
    logSecurityEvent('LOGIN_FAILED', {
      email,
      reason: 'User not found',
      ipAddress: deviceInfo.ipAddress
    });
    return next(new ErrorResponse('Invalid credentials', 401));
  }
  
  // Check if account is locked
  if (user.isLocked) {
    const lockTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
    logSecurityEvent('LOGIN_BLOCKED', {
      email: user.email,
      userId: user._id,
      reason: 'Account locked',
      lockTimeMinutes: lockTime,
      ipAddress: deviceInfo.ipAddress
    });
    return next(new ErrorResponse(`Account is locked. Please try again in ${lockTime} minutes.`, 423));
  }
  
  // Check if user has completed registration
  if (!user.isRegistrationComplete) {
    return next(new ErrorResponse('Please complete your registration first', 400));
  }
  
  // Check if password matches
  const isMatch = await user.matchPassword(password);
  
  if (!isMatch) {
    // Increment login attempts
    await user.incLoginAttempts();
    
    // Log failed attempt
    user.loginHistory.push({
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      device: deviceInfo.device,
      success: false
    });
    await user.save({ validateBeforeSave: false });
    
    logSecurityEvent('LOGIN_FAILED', {
      email: user.email,
      userId: user._id,
      reason: 'Invalid password',
      attempts: user.loginAttempts + 1,
      ipAddress: deviceInfo.ipAddress
    });
    
    return next(new ErrorResponse('Invalid credentials', 401));
  }
  
  // Reset login attempts on successful login
  await user.resetLoginAttempts();
  
  // Log successful login
  user.loginHistory.push({
    ipAddress: deviceInfo.ipAddress,
    userAgent: deviceInfo.userAgent,
    device: deviceInfo.device,
    success: true
  });
  
  // Keep only last 20 login history entries
  if (user.loginHistory.length > 20) {
    user.loginHistory = user.loginHistory.slice(-20);
  }
  
  await user.save({ validateBeforeSave: false });
  
  logSecurityEvent('LOGIN_SUCCESS', {
    email: user.email,
    userId: user._id,
    ipAddress: deviceInfo.ipAddress,
    device: deviceInfo.device
  });
  
  sendTokenResponse(user, 200, res, req, deviceInfo);
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  
  // If refresh token provided, revoke it
  if (refreshToken) {
    const user = await User.findById(req.user.id);
    if (user) {
      await user.revokeRefreshToken(refreshToken);
      logSecurityEvent('REFRESH_TOKEN_REVOKED', {
        userId: user._id,
        email: user.email
      });
    }
  }
  
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true
  });
  
  logSecurityEvent('LOGOUT', {
    userId: req.user.id,
    email: req.user.email
  });
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: {}
  });
});

/**
 * @desc    Logout from all devices
 * @route   POST /api/v1/auth/logout-all
 * @access  Private
 */
exports.logoutAll = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (user) {
    await user.revokeAllRefreshTokens();
    logSecurityEvent('LOGOUT_ALL_DEVICES', {
      userId: user._id,
      email: user.email
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'Logged out from all devices successfully',
    data: {}
  });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return next(new ErrorResponse('Refresh token is required', 400));
  }
  
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '_refresh');
    
    if (decoded.type !== 'refresh') {
      return next(new ErrorResponse('Invalid token type', 401));
    }
    
    // Find user and check if refresh token is valid
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }
    
    // Check if refresh token exists in user's refresh tokens
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenExists = user.refreshTokens.some(rt => rt.token === hashedToken);
    
    if (!tokenExists) {
      logSecurityEvent('REFRESH_TOKEN_INVALID', {
        userId: user._id,
        email: user.email
      });
      return next(new ErrorResponse('Invalid refresh token', 401));
    }
    
    // Generate new access token
    const accessToken = user.getSignedJwtToken();
    
    logSecurityEvent('TOKEN_REFRESHED', {
      userId: user._id,
      email: user.email
    });
    
    res.status(200).json({
      success: true,
      token: accessToken
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ErrorResponse('Refresh token expired', 401));
    }
    return next(new ErrorResponse('Invalid refresh token', 401));
  }
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

  // Check if user already exists and is fully registered
  let user = await User.findOne({ email }).select('+emailVerificationCode +emailVerificationExpire');
  
  if (user && user.isEmailVerified && user.isRegistrationComplete) {
    return next(new ErrorResponse('A user with this email already exists. Please login instead.', 400));
  }

  // Create user if doesn't exist (for email verification flow)
  // Create with minimal fields and skip validation
  if (!user) {
    user = new User({
      email,
      isEmailVerified: false,
      isRegistrationComplete: false,
      // Set temporary values for required fields (will be updated during registration)
      name: 'Temporary User',
      gender: 'other',
      bio: 'Temporary bio',
      birth_year: '2000',
      birth_month: '1',
      birth_day: '1',
      native_language: 'en',
      language_to_learn: 'en',
      images: [],
      password: crypto.randomBytes(20).toString('hex') // Temporary password, will be set during registration
    });
    // Save without validation
    await user.save({ validateBeforeSave: false });
  }

  // Generate verification code
  const code = user.generateEmailVerificationCode();
  await user.save({ validateBeforeSave: false });
  
  // Log security event
  logSecurityEvent('EMAIL_VERIFICATION_SENT', {
    email: user.email,
    userId: user._id
  });

  // Email content (same as before)
  const message = `Your verification code for BanaTalk is: ${code}. This code will expire in 5 minutes.`;
  
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
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Welcome to BanaTalk! 🎉</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
                Thank you for signing up! To complete your registration, please use the verification code below:
              </p>
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
                      ⏰ <strong>Important:</strong> This code will expire in <strong>5 minutes</strong>. Please complete your registration soon!
                    </p>
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #999999; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                If you didn't request this code, please ignore this email and no account will be created.
              </p>
            </td>
          </tr>
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
        expiresIn: '5 minutes'
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

// In controllers/auth.js

/**
 * @desc    Send Password Reset Code
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next(new ErrorResponse('Please provide an email address', 400));
  }

  // Email validation
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!emailRegex.test(email)) {
    return next(new ErrorResponse('Please provide a valid email address', 400));
  }

  // Find user by email
  const user = await User.findOne({ email }).select('+passwordResetCode +passwordResetExpire');
  
  if (!user) {
    return next(new ErrorResponse('No account found with that email address', 404));
  }

  // Check if user has completed registration
  if (!user.isRegistrationComplete) {
    return next(new ErrorResponse('Please complete your registration first', 400));
  }

  // Generate password reset code
  const code = user.generatePasswordResetCode();
  await user.save({ validateBeforeSave: false });

  // Email content
  const message = `Your password reset code for BanaTalk is: ${code}. This code will expire in 15 minutes.`;
  
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
          <tr>
            <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">Password Reset Request 🔒</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 25px 0;">
                We received a request to reset your password. Use the code below to reset it:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" style="background-color: #fff5f5; border: 3px solid #f5576c; border-radius: 12px; padding: 25px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center; text-transform: uppercase; letter-spacing: 1px;">
                            Your Reset Code
                          </p>
                          <p style="margin: 0; font-size: 42px; font-weight: bold; color: #f5576c; letter-spacing: 10px; font-family: 'Courier New', monospace; text-align: center;">
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
                      ⏰ <strong>Important:</strong> This code will expire in <strong>15 minutes</strong>. If you didn't request this, please ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #999999; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                If you didn't request a password reset, your account is still secure. You can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                Need help? Contact us at <a href="mailto:support@banatalk.com" style="color: #f5576c; text-decoration: none;">support@banatalk.com</a>
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
      subject: 'BanaTalk - Password Reset Code',
      message,
      html
    });

    res.status(200).json({ 
      success: true, 
      message: 'Password reset code sent to your email',
      data: {
        email: user.email,
        expiresIn: '5 minutes'
      }
    });
  } catch (err) {
    console.error('❌ Email sending error:', err);
    
    // Clear reset fields on error
    user.passwordResetCode = undefined;
    user.passwordResetExpire = undefined;
    await user.save({ validateBeforeSave: false });
    
    return next(new ErrorResponse('Email could not be sent. Please try again later.', 500));
  }
});

/**
 * @desc    Verify Password Reset Code
 * @route   POST /api/v1/auth/verify-reset-code
 * @access  Public
 */
exports.verifyResetCode = asyncHandler(async (req, res, next) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return next(new ErrorResponse('Please provide both email and reset code', 400));
  }

  // Hash the provided code
  const hashedCode = crypto
    .createHash('sha256')
    .update(code.toString())
    .digest('hex');

  // Find user with matching email, code, and non-expired reset code
  const user = await User.findOne({
    email,
    passwordResetCode: hashedCode,
    passwordResetExpire: { $gt: Date.now() }
  }).select('+passwordResetCode +passwordResetExpire');

  if (!user) {
    return next(new ErrorResponse('Invalid or expired reset code', 400));
  }

  res.status(200).json({ 
    success: true, 
    message: 'Code verified! You can now reset your password.',
    data: {
      email: user.email,
      verified: true
    }
  });
});

/**
 * @desc    Reset Password (after code verification)
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { email, code, newPassword } = req.body;
  
  if (!email || !code || !newPassword) {
    return next(new ErrorResponse('Please provide email, code, and new password', 400));
  }

  // Validate password strength
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  if (!strongPasswordRegex.test(newPassword)) {
    return next(new ErrorResponse('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number', 400));
  }

  // Hash the provided code
  const hashedCode = crypto
    .createHash('sha256')
    .update(code.toString())
    .digest('hex');

  // Find user with matching email, code, and non-expired reset code
  const user = await User.findOne({
    email,
    passwordResetCode: hashedCode,
    passwordResetExpire: { $gt: Date.now() }
  }).select('+passwordResetCode +passwordResetExpire +password');

  if (!user) {
    return next(new ErrorResponse('Invalid or expired reset code', 400));
  }

  // Set new password (will be hashed by pre-save middleware)
  user.password = newPassword;
  user.passwordResetCode = undefined;
  user.passwordResetExpire = undefined;
  await user.save();

  // Send token response (log user in automatically)
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
    logSecurityEvent('PASSWORD_UPDATE_FAILED', {
      userId: user._id,
      email: user.email,
      reason: 'Incorrect current password'
    });
    return next(new ErrorResponse('Current password is incorrect', 401));
  }
  
  // Validate new password strength
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  if (!strongPasswordRegex.test(newPassword)) {
    return next(new ErrorResponse('New password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number', 400));
  }
  
  // Update password
  user.password = newPassword;
  await user.save();
  
  logSecurityEvent('PASSWORD_UPDATED', {
    userId: user._id,
    email: user.email
  });
  
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
const sendTokenResponse = (user, statusCode, res, req = null, deviceInfo = null) => {
  try {
    // Make sure we have a valid user with the getSignedJwtToken method
    if (!user || typeof user.getSignedJwtToken !== 'function') {
      console.error('Invalid user object or missing getSignedJwtToken method:', user);
      throw new Error('Invalid user object');
    }
    
    // Create access token
    const token = user.getSignedJwtToken();
    
    // Generate refresh token if device info provided
    let refreshToken = null;
    if (deviceInfo) {
      refreshToken = user.generateRefreshToken(deviceInfo);
      user.save({ validateBeforeSave: false });
    }
    
    const options = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true
    };
    
    // Secure cookies in production
    if (process.env.NODE_ENV === 'production') {
      options.secure = true;
      options.sameSite = 'strict';
    }
    
    // Convert user to plain object for response and add image URLs if req is available
    const userObject = req ? processUserImages(user, req) : (user.toObject ? user.toObject() : { ...user });
    
    const response = {
      success: true,
      token,
      user: userObject
    };
    
    // Include refresh token in response if generated
    if (refreshToken) {
      response.refreshToken = refreshToken;
    }
    
    res.status(statusCode)
      .cookie('token', token, options)
      .json(response);
  } catch (error) {
    console.error('Error in sendTokenResponse:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * @desc    Google login for mobile (ID token verification)
 * @route   POST /api/v1/auth/google/mobile
 * @access  Public
 */

exports.googleMobileLogin = asyncHandler(async (req, res, next) => {
  const { idToken } = req.body;
  
  if (!idToken) {
    return next(new ErrorResponse('ID token is required', 400));
  }
  
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID,
        '810869785173-6jl1i1b32lghpsdq6lp92a7b1vuedoh4.apps.googleusercontent.com'
      ]
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;
    
    console.log('✅ Google token verified:', { googleId, email, name });
    
    // Try to find existing user by Google ID
    let user = await User.findOne({ googleId });
    
    // If not found by Google ID, try by email
    if (!user && email) {
      user = await User.findOne({ email });
      
      // If user exists with this email, link Google account
      if (user) {
        user.googleId = googleId;
        if (picture && (!user.images || user.images.length === 0)) {
          user.images = [picture];
        }
        await user.save();
      }
    }
    
    // If still no user, create new one
    if (!user) {
      user = await User.create({
        googleId,
        email,
        name: name || 'User',
        images: picture ? [picture] : [],
        isEmailVerified: true,
        isRegistrationComplete: true,
        // Default values for required fields (only for new OAuth users)
        gender: 'other',
        bio: 'Hello! I joined using Google. 👋',
        birth_year: '2000',
        birth_month: '1',
        birth_day: '1',
        native_language: 'en',
        language_to_learn: 'en',
        location: {
          type: 'Point',
          coordinates: [0, 0],
          formattedAddress: 'Not specified',
          city: 'Not specified',
          country: 'Not specified'
        }
      });
      
      console.log('✅ New Google user created:', user._id);
    } else {
      console.log('✅ Existing user logged in:', user._id);
    }
    
    const deviceInfo = getDeviceInfo(req);
    logSecurityEvent('GOOGLE_MOBILE_LOGIN_SUCCESS', {
      userId: user._id,
      email: user.email,
      ipAddress: deviceInfo.ipAddress
    });
    
    sendTokenResponse(user, 200, res, req, deviceInfo);
    
  } catch (error) {
    console.error('❌ Google mobile auth error:', error);
    return next(new ErrorResponse('Invalid Google token', 401));
  }
});