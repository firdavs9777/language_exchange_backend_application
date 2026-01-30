/**
 * Request Logger Middleware
 * Logs HTTP requests with timing and response status
 */

/**
 * Format bytes to human readable
 */
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get status code color for console
 */
const getStatusColor = (status) => {
  if (status >= 500) return '\x1b[31m'; // Red
  if (status >= 400) return '\x1b[33m'; // Yellow
  if (status >= 300) return '\x1b[36m'; // Cyan
  if (status >= 200) return '\x1b[32m'; // Green
  return '\x1b[0m'; // Default
};

/**
 * Request logger middleware
 * Logs: method, url, status, response time, content length
 */
const requestLogger = (options = {}) => {
  const {
    // Skip logging for these paths
    skipPaths = ['/health', '/favicon.ico'],
    // Log request body for these methods
    logBodyMethods = ['POST', 'PUT', 'PATCH'],
    // Maximum body length to log
    maxBodyLength = 500,
    // Log level (info, debug, error)
    logLevel = 'info'
  } = options;

  return (req, res, next) => {
    // Skip paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Attach request ID to request object
    req.requestId = requestId;

    // Capture original end to get response info
    const originalEnd = res.end;
    let responseBody;

    res.end = function(chunk, encoding) {
      res.responseTime = Date.now() - startTime;
      responseBody = chunk;
      originalEnd.call(this, chunk, encoding);
    };

    // Log on response finish
    res.on('finish', () => {
      const duration = res.responseTime || (Date.now() - startTime);
      const status = res.statusCode;
      const contentLength = res.get('content-length');
      const reset = '\x1b[0m';
      const color = getStatusColor(status);

      // Build log message
      const logParts = [
        `${req.method}`,
        `${req.originalUrl}`,
        `${color}${status}${reset}`,
        `${duration}ms`,
        contentLength ? formatBytes(parseInt(contentLength)) : '-'
      ];

      // Add user ID if authenticated
      if (req.user?.id) {
        logParts.push(`user:${req.user.id.slice(-6)}`);
      }

      // Log the request
      const logMessage = logParts.join(' | ');

      if (status >= 500) {
        console.error(`[REQ] ${logMessage}`);
      } else if (status >= 400) {
        console.warn(`[REQ] ${logMessage}`);
      } else if (process.env.NODE_ENV === 'development' || logLevel === 'debug') {
        console.log(`[REQ] ${logMessage}`);
      }

      // Log request body in development for debugging
      if (process.env.NODE_ENV === 'development' && logBodyMethods.includes(req.method)) {
        if (req.body && Object.keys(req.body).length > 0) {
          // Sanitize sensitive fields
          const sanitizedBody = { ...req.body };
          const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'code'];
          sensitiveFields.forEach(field => {
            if (sanitizedBody[field]) sanitizedBody[field] = '[REDACTED]';
          });

          const bodyStr = JSON.stringify(sanitizedBody);
          if (bodyStr.length <= maxBodyLength) {
            console.log(`[REQ BODY] ${bodyStr}`);
          } else {
            console.log(`[REQ BODY] ${bodyStr.slice(0, maxBodyLength)}... (truncated)`);
          }
        }
      }
    });

    next();
  };
};

/**
 * Error request logger
 * Logs failed requests with more detail
 */
const errorRequestLogger = (err, req, res, next) => {
  const requestId = req.requestId || 'unknown';

  console.error(`[ERROR] ${req.method} ${req.originalUrl}`);
  console.error(`[ERROR] Request ID: ${requestId}`);
  console.error(`[ERROR] ${err.message}`);

  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR] Stack: ${err.stack}`);
  }

  next(err);
};

module.exports = {
  requestLogger,
  errorRequestLogger
};
