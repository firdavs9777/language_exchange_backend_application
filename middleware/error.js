const ErrorResponse = require('../utils/errorResponse');

/**
 * Global Error Handler Middleware
 * Handles various error types and formats consistent error responses
 */
function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode;

  // Log error for debugging (only stack in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code
    });
  } else {
    // In production, log minimal info
    console.error(`Error: ${err.message} [${err.name || 'Error'}]`);
  }

  // ========== Mongoose Errors ==========

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key error (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = `A record with this ${field} already exists`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    const message = messages.join('. ');
    error = new ErrorResponse(message, 400);
  }

  // Mongoose document not found
  if (err.name === 'DocumentNotFoundError') {
    error = new ErrorResponse('Resource not found', 404);
  }

  // ========== JWT Errors ==========

  // Invalid JWT token
  if (err.name === 'JsonWebTokenError') {
    error = new ErrorResponse('Invalid authentication token', 401);
  }

  // Expired JWT token
  if (err.name === 'TokenExpiredError') {
    error = new ErrorResponse('Authentication token has expired', 401);
  }

  // JWT not before error
  if (err.name === 'NotBeforeError') {
    error = new ErrorResponse('Token not yet valid', 401);
  }

  // ========== Rate Limiting ==========

  // Rate limit exceeded
  if (err.status === 429 || err.statusCode === 429) {
    error = new ErrorResponse(
      err.message || 'Too many requests. Please try again later.',
      429
    );
  }

  // ========== File Upload Errors ==========

  // Multer file size limit
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ErrorResponse('File is too large', 400);
  }

  // Multer file count limit
  if (err.code === 'LIMIT_FILE_COUNT') {
    error = new ErrorResponse('Too many files uploaded', 400);
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new ErrorResponse('Unexpected file field', 400);
  }

  // ========== Network/External Service Errors ==========

  // Axios/fetch errors (external API failures)
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    error = new ErrorResponse('External service unavailable', 503);
  }

  // Timeout errors
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    error = new ErrorResponse('Request timeout', 504);
  }

  // ========== Syntax Errors ==========

  // JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ErrorResponse('Invalid JSON in request body', 400);
  }

  // ========== OpenAI/AI Service Errors ==========

  // OpenAI rate limit
  if (err.message?.includes('Rate limit') || err.code === 'rate_limit_exceeded') {
    error = new ErrorResponse('AI service is busy. Please try again shortly.', 429);
  }

  // OpenAI quota exceeded
  if (err.code === 'insufficient_quota') {
    error = new ErrorResponse('AI service quota exceeded', 503);
  }

  // ========== Default Response ==========

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Don't expose internal errors in production
  const responseMessage = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : message;

  res.status(statusCode).json({
    success: false,
    error: responseMessage,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details || null
    })
  });
}

module.exports = errorHandler;
