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

/**
 * AI Rate Limiter Configuration
 * Different limits based on feature and user tier
 */
const AI_RATE_LIMITS = {
  conversation: {
    free: { windowMs: 60 * 60 * 1000, max: 20 },      // 20 per hour
    regular: { windowMs: 60 * 60 * 1000, max: 50 },   // 50 per hour
    vip: { windowMs: 60 * 60 * 1000, max: 200 }       // 200 per hour
  },
  grammar: {
    free: { windowMs: 60 * 60 * 1000, max: 30 },
    regular: { windowMs: 60 * 60 * 1000, max: 100 },
    vip: { windowMs: 60 * 60 * 1000, max: 500 }
  },
  tts: {
    free: { windowMs: 60 * 60 * 1000, max: 50 },
    regular: { windowMs: 60 * 60 * 1000, max: 200 },
    vip: { windowMs: 60 * 60 * 1000, max: 1000 }
  },
  stt: {
    free: { windowMs: 60 * 60 * 1000, max: 20 },
    regular: { windowMs: 60 * 60 * 1000, max: 100 },
    vip: { windowMs: 60 * 60 * 1000, max: 500 }
  },
  pronunciation: {
    free: { windowMs: 60 * 60 * 1000, max: 30 },
    regular: { windowMs: 60 * 60 * 1000, max: 150 },
    vip: { windowMs: 60 * 60 * 1000, max: 500 }
  },
  translation: {
    free: { windowMs: 60 * 60 * 1000, max: 50 },
    regular: { windowMs: 60 * 60 * 1000, max: 200 },
    vip: { windowMs: 60 * 60 * 1000, max: 1000 }
  },
  quiz: {
    free: { windowMs: 60 * 60 * 1000, max: 10 },
    regular: { windowMs: 60 * 60 * 1000, max: 30 },
    vip: { windowMs: 60 * 60 * 1000, max: 100 }
  },
  lessonBuilder: {
    free: { windowMs: 60 * 60 * 1000, max: 5 },       // 5 lessons per hour (expensive operation)
    regular: { windowMs: 60 * 60 * 1000, max: 15 },   // 15 per hour
    vip: { windowMs: 60 * 60 * 1000, max: 50 }        // 50 per hour
  }
};

/**
 * Create AI rate limiter for a specific feature
 * @param {String} feature - Feature name (conversation, grammar, tts, stt, pronunciation, translation, quiz)
 * @returns {Function} Express middleware
 */
exports.aiRateLimiter = (feature) => {
  const limits = AI_RATE_LIMITS[feature] || AI_RATE_LIMITS.conversation;

  return rateLimit({
    windowMs: limits.free.windowMs,
    max: (req) => {
      // Get user tier from request
      const tier = req.user?.subscription?.tier || 'free';
      return limits[tier]?.max || limits.free.max;
    },
    message: {
      success: false,
      error: `Too many ${feature} requests. Please try again later or upgrade your plan for higher limits.`
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID for authenticated users
      return req.user ? `ai:${feature}:${req.user.id}` : `ai:${feature}:${req.ip}`;
    },
    skip: (req) => {
      // Skip for admin users
      return req.user?.role === 'admin';
    }
  });
};

/**
 * Rate limiter for social interactions (likes, shares, reports, follows)
 * Prevents spam while allowing normal usage
 */
exports.interactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 interactions per minute
  message: {
    success: false,
    error: 'Too many interactions. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `interaction:${req.user.id}` : `interaction:${req.ip}`;
  }
});

/**
 * Rate limiter for report submissions (stricter)
 */
exports.reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reports per hour
  message: {
    success: false,
    error: 'Too many reports submitted. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `report:${req.user.id}` : `report:${req.ip}`;
  }
});

/**
 * Rate limiter for search operations
 */
exports.searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 searches per minute
  message: {
    success: false,
    error: 'Too many search requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user ? `search:${req.user.id}` : `search:${req.ip}`;
  }
});

