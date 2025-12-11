/**
 * Utility functions for image URL generation
 */

/**
 * Generate full URL for an image
 * @param {string} filename - Image filename
 * @param {Object} req - Express request object
 * @returns {string} Full image URL
 */
exports.generateImageUrl = (filename, req) => {
  if (!filename) return null;
  return `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(filename)}`;
};

/**
 * Process user object to add imageUrls
 * @param {Object} user - User object
 * @param {Object} req - Express request object
 * @returns {Object} User object with imageUrls
 */
exports.processUserImages = (user, req) => {
  if (!user) return null;
  
  const userObject = user.toObject ? user.toObject() : { ...user };
  userObject.imageUrls = user.images || [];
  return userObject;
};

/**
 * Process moment object to add imageUrls
 * @param {Object} moment - Moment object
 * @param {Object} req - Express request object
 * @returns {Object} Moment object with imageUrls
 */
exports.processMomentImages = (moment, req) => {
  if (!moment) return null;
  
  const momentObject = moment.toObject ? moment.toObject() : { ...moment };
  momentObject.imageUrls = moment.images || [];
  return momentObject;
};

