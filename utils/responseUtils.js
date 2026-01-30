/**
 * Response Utilities
 *
 * Standardized API response helpers for consistent response formatting
 * across all controllers.
 */

/**
 * Send a success response
 *
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {number} options.statusCode - HTTP status code (default: 200)
 * @param {any} options.data - Response data
 * @param {string} options.message - Optional success message
 * @param {Object} options.meta - Optional metadata (pagination, etc.)
 *
 * @example
 * sendSuccess(res, { data: user, message: 'User created successfully', statusCode: 201 });
 */
exports.sendSuccess = (res, options = {}) => {
  const {
    statusCode = 200,
    data = null,
    message = null,
    meta = {}
  } = options;

  const response = {
    success: true,
    ...(message && { message }),
    ...(data !== null && { data }),
    ...meta
  };

  return res.status(statusCode).json(response);
};

/**
 * Send a list response with count
 *
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} options - Response options
 *
 * @example
 * sendList(res, users, { total: 100, page: 1, limit: 10 });
 */
exports.sendList = (res, data, options = {}) => {
  const {
    statusCode = 200,
    total = data.length,
    pagination = null,
    message = null
  } = options;

  const response = {
    success: true,
    ...(message && { message }),
    count: data.length,
    total,
    ...(pagination && { pagination }),
    data
  };

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 *
 * @param {Object} res - Express response object
 * @param {Object} options - Error options
 * @param {number} options.statusCode - HTTP status code (default: 400)
 * @param {string} options.error - Error message
 * @param {Object} options.errors - Validation errors object
 *
 * @example
 * sendError(res, { statusCode: 404, error: 'User not found' });
 * sendError(res, { statusCode: 400, error: 'Validation failed', errors: { email: 'Invalid email' } });
 */
exports.sendError = (res, options = {}) => {
  const {
    statusCode = 400,
    error = 'An error occurred',
    errors = null
  } = options;

  const response = {
    success: false,
    error,
    ...(errors && { errors })
  };

  return res.status(statusCode).json(response);
};

/**
 * Send a created response (201)
 *
 * @param {Object} res - Express response object
 * @param {any} data - Created resource
 * @param {string} message - Success message
 */
exports.sendCreated = (res, data, message = 'Resource created successfully') => {
  return exports.sendSuccess(res, {
    statusCode: 201,
    data,
    message
  });
};

/**
 * Send a no content response (204)
 *
 * @param {Object} res - Express response object
 */
exports.sendNoContent = (res) => {
  return res.status(204).send();
};

/**
 * Send a not found response (404)
 *
 * @param {Object} res - Express response object
 * @param {string} resource - Name of the resource
 */
exports.sendNotFound = (res, resource = 'Resource') => {
  return exports.sendError(res, {
    statusCode: 404,
    error: `${resource} not found`
  });
};

/**
 * Send an unauthorized response (401)
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
exports.sendUnauthorized = (res, message = 'Not authorized to access this route') => {
  return exports.sendError(res, {
    statusCode: 401,
    error: message
  });
};

/**
 * Send a forbidden response (403)
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
exports.sendForbidden = (res, message = 'Access forbidden') => {
  return exports.sendError(res, {
    statusCode: 403,
    error: message
  });
};

/**
 * Send a bad request response (400)
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} errors - Validation errors
 */
exports.sendBadRequest = (res, message = 'Bad request', errors = null) => {
  return exports.sendError(res, {
    statusCode: 400,
    error: message,
    errors
  });
};

/**
 * Send a rate limit response (429)
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} retryAfter - Seconds until rate limit resets
 */
exports.sendRateLimited = (res, message = 'Too many requests', retryAfter = null) => {
  if (retryAfter) {
    res.set('Retry-After', retryAfter.toString());
  }
  return exports.sendError(res, {
    statusCode: 429,
    error: message
  });
};

/**
 * Send a server error response (500)
 *
 * @param {Object} res - Express response object
 * @param {string} message - Error message (safe for client)
 */
exports.sendServerError = (res, message = 'Internal server error') => {
  return exports.sendError(res, {
    statusCode: 500,
    error: message
  });
};

/**
 * Wrap async controller with standardized error handling
 *
 * @param {Function} fn - Async controller function
 * @returns {Function} Wrapped controller
 *
 * @example
 * exports.getUser = asyncController(async (req, res) => {
 *   const user = await User.findById(req.params.id);
 *   sendSuccess(res, { data: user });
 * });
 */
exports.asyncController = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
