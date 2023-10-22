const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

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
  // 	token =req.cookies.token;
  //   }
  // Check token exists
  if (!token) {
    return next(new ErrorResponse('Not authorize to access this route', 401));
  }
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorize to access this route', 401));
  }
});

/// Grant access to specific role
exports.authorize = (...roles) => {
  return (req, res, next) => {
    console.log('Request');
    console.log(req.user);
    console.log(roles);
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is unauthorized to commit this action`,
          401
        )
      );
    }
    next();
  };
};
