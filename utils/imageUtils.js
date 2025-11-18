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
 * Generate image URLs for an array of filenames
 * @param {Array<string>} images - Array of image filenames
 * @param {Object} req - Express request object
 * @returns {Array<string>} Array of full image URLs
 */
exports.generateImageUrls = (images, req) => {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return [];
  }
  return images.map(image => exports.generateImageUrl(image, req));
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
  userObject.imageUrls = exports.generateImageUrls(user.images || [], req);
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
  momentObject.imageUrls = exports.generateImageUrls(moment.images || [], req);
  return momentObject;
};

