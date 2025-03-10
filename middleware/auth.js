const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Moment = require('../models/Moment');
const Comment = require('../models/Comment');

// Protect routes
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

exports.authorize = (resourceOwnerField) => {
  return asyncHandler(async (req, res, next) => {
    console.log('req.params.id:', req.params.id);
    if (req.params.id) {
      const resourceId = req.params.id;
      const Model = Moment;

      const resource = await Model.findById(resourceId);

      console.log('resource:', resource);
      console.log('req.user:', req.user);
      console.log('req.user.id:', req.user.id);

      if (!resource) {
        return next(new ErrorResponse('Resource not found', 404));
      }

      console.log(
        'resource[resourceOwnerField]:',
        resource[resourceOwnerField]
      );
      console.log(
        'resource[resourceOwnerField].toString():',
        resource[resourceOwnerField].toString()
      );

      if (resource[resourceOwnerField].toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorized', 403));
      }

      next();
    } else {
      return next(new ErrorResponse('Missing resource ID', 400));
    }
  });
};
exports.authorizeComment = (resourceOwnerField) => {
  return asyncHandler(async (req, res, next) => {
    console.log('req.params.id:', req.params.id);
    if (req.params.id) {
      const resourceId = req.params.id;
      const Comment = Comment

      const resource = await Comment.findById(resourceId);

      console.log('resource:', resource);
      console.log('req.user:', req.user);
      console.log('req.user.id:', req.user.id);

      if (!resource) {
        return next(new ErrorResponse('Resource not found', 404));
      }

      console.log(
        'resource[resourceOwnerField]:',
        resource[resourceOwnerField]
      );
      console.log(
        'resource[resourceOwnerField].toString():',
        resource[resourceOwnerField].toString()
      );

      if (resource[resourceOwnerField].toString() !== req.user.id) {
        return next(new ErrorResponse('Not authorized', 403));
      }

      next();
    } else {
      return next(new ErrorResponse('Missing resource ID', 400));
    }
  });
};
