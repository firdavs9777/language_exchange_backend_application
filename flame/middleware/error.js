const { FlameError } = require('../utils/errors');
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  if (err instanceof FlameError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Unexpected error: log full, return generic
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
};
