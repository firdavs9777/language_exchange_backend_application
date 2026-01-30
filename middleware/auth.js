const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Moment = require('../models/Moment');
const Comment = require('../models/Comment');
const Story = require('../models/Story');

// Protect routes - require authentication
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  //   else if(req.cookies.token){
  //  token =req.cookies.token;
  //   }
  // Check token exists
  if (!token) {
    return next(new ErrorResponse('Not authorize to access this route', 401));
  }
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorize to access this route', 401));
  }
});

// Optional authentication - attach user if token exists, but don't require it
// Useful for routes that work for both authenticated and unauthenticated users
// but provide enhanced functionality when authenticated (e.g., blocking filter)
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // If no token, continue without user (anonymous access)
  if (!token) {
    req.user = null;
    return next();
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    // Invalid token, but still allow access (as anonymous)
    req.user = null;
    next();
  }
});

// Role-based authorization (e.g., authorize('admin'))
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role '${req.user.role || 'user'}' is not authorized to access this route`,
          403
        )
      );
    }

    next();
  };
};

// Resource ownership authorization (e.g., authorizeOwner('user', 'moment'))
exports.authorizeOwner = (resourceOwnerField, modelType) => {
  return asyncHandler(async (req, res, next) => {
    if (req.params.id) {
      const resourceId = req.params.id;
      let Model;
      if (modelType === 'moment') {
        Model = Moment;
      } else if (modelType === 'comment') {
        Model = Comment;
      } else {
        Model = Story;
      }

      const resource = await Model.findById(resourceId);

      if (!resource) {
        return next(new ErrorResponse('Resource not found', 404));
      }

      if (resource[resourceOwnerField].toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorized', 403));
      }

      next();
    } else {
      return next(new ErrorResponse('Missing resource ID', 400));
    }
  });
};

// Legacy alias for backward compatibility
exports.authorizeRole = exports.authorize;

// Comment-specific authorization
exports.authorizeComment = (resourceOwnerField) => {
  return asyncHandler(async (req, res, next) => {
    if (req.params.id) {
      const resourceId = req.params.id;
      const resource = await Comment.findById(resourceId);

      if (!resource) {
        return next(new ErrorResponse('Resource not found', 404));
      }

      if (resource[resourceOwnerField].toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorized', 403));
      }

      next();
    } else {
      return next(new ErrorResponse('Missing resource ID', 400));
    }
  });
};
