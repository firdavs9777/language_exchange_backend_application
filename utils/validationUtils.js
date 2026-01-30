/**
 * Validation Utilities
 *
 * Standardized validation helpers for input sanitization,
 * type checking, and request validation.
 */

const mongoose = require('mongoose');

/**
 * Validate MongoDB ObjectId
 *
 * @param {string} id - String to validate
 * @returns {boolean} True if valid ObjectId
 *
 * @example
 * if (!isValidObjectId(req.params.id)) {
 *   return next(new ErrorResponse('Invalid ID format', 400));
 * }
 */
exports.isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
};

/**
 * Validate multiple ObjectIds
 *
 * @param {Array} ids - Array of IDs to validate
 * @returns {boolean} True if all IDs are valid
 */
exports.areValidObjectIds = (ids) => {
  if (!Array.isArray(ids)) return false;
  return ids.every(id => exports.isValidObjectId(id));
};

/**
 * Sanitize string input
 *
 * @param {string} str - String to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 *
 * @example
 * const name = sanitizeString(req.body.name, { maxLength: 100, trim: true });
 */
exports.sanitizeString = (str, options = {}) => {
  const {
    maxLength = 1000,
    trim = true,
    lowercase = false,
    defaultValue = ''
  } = options;

  if (str === null || str === undefined) return defaultValue;
  if (typeof str !== 'string') return defaultValue;

  let result = str;
  if (trim) result = result.trim();
  if (lowercase) result = result.toLowerCase();
  if (maxLength > 0 && result.length > maxLength) {
    result = result.substring(0, maxLength);
  }

  return result;
};

/**
 * Parse and validate integer
 *
 * @param {any} value - Value to parse
 * @param {Object} options - Validation options
 * @returns {number|null} Parsed integer or null if invalid
 *
 * @example
 * const score = parseInteger(req.body.score, { min: 0, max: 100, defaultValue: 0 });
 */
exports.parseInteger = (value, options = {}) => {
  const {
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    defaultValue = null
  } = options;

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) return defaultValue;
  if (parsed < min) return min;
  if (parsed > max) return max;

  return parsed;
};

/**
 * Parse and validate float/number
 *
 * @param {any} value - Value to parse
 * @param {Object} options - Validation options
 * @returns {number|null} Parsed number or null if invalid
 */
exports.parseNumber = (value, options = {}) => {
  const {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    decimals = null,
    defaultValue = null
  } = options;

  const parsed = parseFloat(value);

  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;

  let result = parsed;
  if (result < min) result = min;
  if (result > max) result = max;
  if (decimals !== null) {
    result = Number(result.toFixed(decimals));
  }

  return result;
};

/**
 * Validate email format
 *
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
exports.isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Sanitize email
 *
 * @param {string} email - Email to sanitize
 * @returns {string|null} Sanitized email or null if invalid
 */
exports.sanitizeEmail = (email) => {
  if (!exports.isValidEmail(email)) return null;
  return email.trim().toLowerCase();
};

/**
 * Validate array input
 *
 * @param {any} arr - Value to check
 * @param {Object} options - Validation options
 * @returns {Array} Validated array
 *
 * @example
 * const tags = validateArray(req.body.tags, { maxLength: 10, itemValidator: isValidString });
 */
exports.validateArray = (arr, options = {}) => {
  const {
    maxLength = 100,
    minLength = 0,
    defaultValue = [],
    itemValidator = null,
    unique = false
  } = options;

  if (!Array.isArray(arr)) return defaultValue;

  let result = arr;

  // Apply item validator if provided
  if (itemValidator && typeof itemValidator === 'function') {
    result = result.filter(item => itemValidator(item));
  }

  // Remove duplicates if needed
  if (unique) {
    result = [...new Set(result)];
  }

  // Enforce length limits
  if (result.length < minLength) return defaultValue;
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }

  return result;
};

/**
 * Parse comma-separated string to array
 *
 * @param {string} str - Comma-separated string
 * @param {Object} options - Parse options
 * @returns {Array} Parsed array
 *
 * @example
 * const tags = parseCommaSeparated(req.query.tags, { trim: true, unique: true });
 */
exports.parseCommaSeparated = (str, options = {}) => {
  const { trim = true, unique = true, maxItems = 50 } = options;

  if (!str || typeof str !== 'string') return [];

  let items = str.split(',');

  if (trim) {
    items = items.map(item => item.trim()).filter(item => item.length > 0);
  }

  if (unique) {
    items = [...new Set(items)];
  }

  if (maxItems > 0) {
    items = items.slice(0, maxItems);
  }

  return items;
};

/**
 * Validate required fields exist in object
 *
 * @param {Object} obj - Object to validate
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} { valid: boolean, missing: Array }
 *
 * @example
 * const { valid, missing } = validateRequired(req.body, ['email', 'password']);
 * if (!valid) {
 *   return next(new ErrorResponse(`Missing fields: ${missing.join(', ')}`, 400));
 * }
 */
exports.validateRequired = (obj, requiredFields) => {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, missing: requiredFields };
  }

  const missing = requiredFields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missing.length === 0,
    missing
  };
};

/**
 * Pick only allowed fields from object (whitelist)
 *
 * @param {Object} obj - Source object
 * @param {Array} allowedFields - Fields to pick
 * @returns {Object} Object with only allowed fields
 *
 * @example
 * const updateData = pickFields(req.body, ['name', 'bio', 'avatar']);
 */
exports.pickFields = (obj, allowedFields) => {
  if (!obj || typeof obj !== 'object') return {};

  const result = {};
  for (const field of allowedFields) {
    if (obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result;
};

/**
 * Omit specified fields from object (blacklist)
 *
 * @param {Object} obj - Source object
 * @param {Array} excludeFields - Fields to exclude
 * @returns {Object} Object without excluded fields
 *
 * @example
 * const userData = omitFields(user, ['password', 'resetToken', 'email']);
 */
exports.omitFields = (obj, excludeFields) => {
  if (!obj || typeof obj !== 'object') return {};

  const result = { ...obj };
  for (const field of excludeFields) {
    delete result[field];
  }
  return result;
};

/**
 * Validate enum value
 *
 * @param {any} value - Value to check
 * @param {Array} allowedValues - Array of allowed values
 * @param {any} defaultValue - Default if not in allowed values
 * @returns {any} Validated value or default
 */
exports.validateEnum = (value, allowedValues, defaultValue = null) => {
  if (allowedValues.includes(value)) return value;
  return defaultValue;
};

/**
 * Validate URL format
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
exports.isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate date string
 *
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid date
 */
exports.isValidDate = (dateStr) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

/**
 * Parse date with validation
 *
 * @param {string} dateStr - Date string to parse
 * @param {Object} options - Parse options
 * @returns {Date|null} Parsed date or null if invalid
 */
exports.parseDate = (dateStr, options = {}) => {
  const { defaultValue = null, minDate = null, maxDate = null } = options;

  if (!exports.isValidDate(dateStr)) return defaultValue;

  const date = new Date(dateStr);

  if (minDate && date < new Date(minDate)) return defaultValue;
  if (maxDate && date > new Date(maxDate)) return defaultValue;

  return date;
};

/**
 * Validate boolean input
 *
 * @param {any} value - Value to parse as boolean
 * @param {boolean} defaultValue - Default if can't parse
 * @returns {boolean} Parsed boolean
 */
exports.parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return defaultValue;
};

/**
 * Sanitize HTML/script content (basic XSS prevention)
 * Note: For full sanitization, use a library like DOMPurify
 *
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
exports.escapeHtml = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Validate password strength
 *
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, errors: Array }
 */
exports.validatePassword = (password, options = {}) => {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = false
  } = options;

  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
