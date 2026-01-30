/**
 * Security Event Logger
 * Logs important security events for audit trail
 * Stores events in MongoDB and logs to console
 */

const mongoose = require('mongoose');

// Security Log Schema
const SecurityLogSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  email: String,
  ip: String,
  userAgent: String,
  details: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  // Auto-delete logs older than 90 days
  expireAfterSeconds: 90 * 24 * 60 * 60
});

// Compound index for common queries
SecurityLogSchema.index({ event: 1, timestamp: -1 });
SecurityLogSchema.index({ userId: 1, timestamp: -1 });
SecurityLogSchema.index({ severity: 1, timestamp: -1 });

// Create model if it doesn't exist
let SecurityLog;
try {
  SecurityLog = mongoose.model('SecurityLog');
} catch {
  SecurityLog = mongoose.model('SecurityLog', SecurityLogSchema);
}

// Event severity mapping
const EVENT_SEVERITY = {
  // Critical - Immediate attention needed
  'UNAUTHORIZED_ADMIN_ACCESS': 'critical',
  'BRUTE_FORCE_DETECTED': 'critical',
  'ACCOUNT_COMPROMISED': 'critical',
  'SUSPICIOUS_ACTIVITY': 'critical',
  'INVALID_TOKEN_BURST': 'critical',

  // Warning - Should be monitored
  'LOGIN_FAILED': 'warning',
  'PASSWORD_RESET_REQUESTED': 'warning',
  'VERIFICATION_CODE_FAILED': 'warning',
  'RATE_LIMIT_EXCEEDED': 'warning',
  'UNUSUAL_LOGIN_LOCATION': 'warning',
  'MULTIPLE_DEVICE_LOGIN': 'warning',

  // Info - Normal security events
  'LOGIN_SUCCESS': 'info',
  'LOGOUT': 'info',
  'PASSWORD_CHANGED': 'info',
  'EMAIL_VERIFIED': 'info',
  'EMAIL_VERIFICATION_SENT': 'info',
  'ACCOUNT_CREATED': 'info',
  'ACCOUNT_DELETED': 'info',
  'PROFILE_UPDATED': 'info',
  'OAUTH_LOGIN': 'info'
};

/**
 * Log a security event
 * @param {string} event - Event type (e.g., 'LOGIN_SUCCESS', 'LOGIN_FAILED')
 * @param {Object} details - Additional details about the event
 */
const logSecurityEvent = async (event, details = {}) => {
  const timestamp = new Date();
  const severity = EVENT_SEVERITY[event] || 'info';

  const logEntry = {
    event,
    severity,
    userId: details.userId || null,
    email: details.email || null,
    ip: details.ip || null,
    userAgent: details.userAgent || null,
    details: {
      ...details,
      // Remove sensitive fields from details
      password: undefined,
      token: undefined,
      code: undefined
    },
    timestamp
  };

  // Log to console with color coding
  const severityColors = {
    info: '\x1b[36m',    // Cyan
    warning: '\x1b[33m', // Yellow
    critical: '\x1b[31m' // Red
  };
  const reset = '\x1b[0m';
  const color = severityColors[severity] || reset;

  console.log(
    `${color}[SECURITY:${severity.toUpperCase()}]${reset}`,
    event,
    JSON.stringify({
      userId: logEntry.userId,
      email: logEntry.email,
      ip: logEntry.ip,
      timestamp: timestamp.toISOString()
    })
  );

  // Store in database (async, don't wait)
  try {
    // Only save to DB if mongoose is connected
    if (mongoose.connection.readyState === 1) {
      await SecurityLog.create(logEntry);
    }
  } catch (error) {
    console.error('Failed to save security log:', error.message);
  }

  // For critical events, could trigger alerts here
  if (severity === 'critical') {
    handleCriticalEvent(event, logEntry);
  }
};

/**
 * Handle critical security events
 * Could send alerts, notifications, etc.
 */
const handleCriticalEvent = (event, logEntry) => {
  // Log with prominent warning
  console.error('🚨 CRITICAL SECURITY EVENT:', event);
  console.error('Details:', JSON.stringify(logEntry, null, 2));

  // TODO: Send email/SMS alert to admins
  // TODO: Send to external monitoring service (PagerDuty, etc.)
};

/**
 * Query security logs
 * @param {Object} query - MongoDB query
 * @param {Object} options - Query options (limit, skip, sort)
 */
const querySecurityLogs = async (query = {}, options = {}) => {
  const {
    limit = 100,
    skip = 0,
    sort = { timestamp: -1 }
  } = options;

  return SecurityLog.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

/**
 * Get security events for a specific user
 */
const getUserSecurityLogs = async (userId, limit = 50) => {
  return querySecurityLogs({ userId }, { limit });
};

/**
 * Get recent critical events
 */
const getRecentCriticalEvents = async (hours = 24, limit = 100) => {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return querySecurityLogs(
    { severity: 'critical', timestamp: { $gte: since } },
    { limit }
  );
};

/**
 * Get login attempts for an email
 */
const getLoginAttempts = async (email, hours = 24) => {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return querySecurityLogs({
    email,
    event: { $in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] },
    timestamp: { $gte: since }
  });
};

/**
 * Check for brute force attempts
 */
const checkBruteForce = async (email, maxAttempts = 5, windowMinutes = 15) => {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const failedAttempts = await SecurityLog.countDocuments({
    email,
    event: 'LOGIN_FAILED',
    timestamp: { $gte: since }
  });

  if (failedAttempts >= maxAttempts) {
    await logSecurityEvent('BRUTE_FORCE_DETECTED', { email, attempts: failedAttempts });
    return true;
  }

  return false;
};

module.exports = {
  logSecurityEvent,
  querySecurityLogs,
  getUserSecurityLogs,
  getRecentCriticalEvents,
  getLoginAttempts,
  checkBruteForce,
  SecurityLog
};
