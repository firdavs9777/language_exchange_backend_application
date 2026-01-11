/**
 * Image URL Utilities
 * Centralized functions for generating image URLs
 */

/**
 * Get full image URL from path
 * @param {Object} req - Express request object
 * @param {String} imagePath - Image path (relative or absolute)
 * @returns {String|null} Full image URL or null
 */
exports.getImageUrl = (req, imagePath) => {
  if (!imagePath) return null;
  
  // If already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Generate full URL from relative path
  return `${req.protocol}://${req.get('host')}/uploads/${imagePath}`;
};

/**
 * Process user images array to include full URLs
 * @param {Object} user - User object (Mongoose document or plain object)
 * @param {Object} req - Express request object
 * @returns {Object} User object with imageUrls array
 */
exports.processUserImages = (user, req) => {
  if (!user) return user;
  
  // Convert Mongoose document to plain object if needed
  const userObj = user.toObject ? user.toObject() : user;
  
  return {
    ...userObj,
    imageUrls: userObj.images?.map(img => exports.getImageUrl(req, img)) || []
  };
};

/**
 * Process multiple users' images
 * @param {Array} users - Array of user objects
 * @param {Object} req - Express request object
 * @returns {Array} Array of users with imageUrls
 */
exports.processUsersImages = (users, req) => {
  if (!Array.isArray(users)) return users;
  
  return users.map(user => exports.processUserImages(user, req));
};

/**
 * Process moment images array to include full URLs
 * @param {Object} moment - Moment object (Mongoose document or plain object)
 * @param {Object} req - Express request object
 * @returns {Object} Moment object with processed image URLs
 */
exports.processMomentImages = (moment, req) => {
  if (!moment) return moment;

  // Convert Mongoose document to plain object if needed
  const momentObj = moment.toObject ? moment.toObject() : moment;

  // Process images array
  const imageUrls = momentObj.images?.map(img => exports.getImageUrl(req, img)) || [];

  // Process video URLs if present
  let video = momentObj.video || null;
  if (video && video.url) {
    video = {
      ...video,
      url: exports.getImageUrl(req, video.url),
      thumbnail: video.thumbnail ? exports.getImageUrl(req, video.thumbnail) : null
    };
  }

  return {
    ...momentObj,
    imageUrls: imageUrls,
    // Keep original images array for backward compatibility
    images: momentObj.images || [],
    // Include processed video data
    video: video,
    mediaType: momentObj.mediaType || 'text'
  };
};

/**
 * Process message media URL
 * @param {Object} message - Message object
 * @param {Object} req - Express request object
 * @returns {Object} Message with processed media URL
 */
exports.processMessageMedia = (message, req) => {
  if (!message || !message.media) return message;
  
  const messageObj = message.toObject ? message.toObject() : message;
  
  if (messageObj.media.url) {
    messageObj.media.url = exports.getImageUrl(req, messageObj.media.url);
  }
  
  if (messageObj.media.thumbnail) {
    messageObj.media.thumbnail = exports.getImageUrl(req, messageObj.media.thumbnail);
  }
  
  return messageObj;
};
