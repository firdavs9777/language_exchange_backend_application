const rateLimit = require('express-rate-limit');

/**
 * General rate limiter (more lenient for normal app usage)
 * Increased limit to accommodate app startup sequences and normal usage
 */
exports.generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased from 100)
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use custom key generator to separate authenticated vs unauthenticated users
  keyGenerator: (req) => {
    // Check if request has auth token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // For authenticated requests, use a combination of IP and token
      // This allows higher limits for authenticated users
      const token = authHeader.split(' ')[1];
      return `auth:${req.ip}:${token.substring(0, 10)}`; // Use first 10 chars of token
    }
    // For unauthenticated requests, use IP only
    return req.ip;
  }
});

/**
 * Strict rate limiter for authentication endpoints
 */
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Rate limiter for email verification/password reset
 */
exports.emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 3 email requests per hour
  message: {
    success: false,
    error: 'Too many email requests, please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for login attempts
 */
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for contact form submissions
 */
exports.contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 contact form submissions per 15 minutes
  message: {
    success: false,
    error: 'Too many contact requests, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

/**
 * Rate limiter for authenticated users (more lenient)
 */
exports.authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit authenticated users to 1000 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID instead of IP for authenticated users
    return req.user ? req.user.id : req.ip;
  }
});

