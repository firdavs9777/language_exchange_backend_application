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
    imageUrls: userObj.images?.map(img => this.getImageUrl(req, img)) || []
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
  
  return users.map(user => this.processUserImages(user, req));
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
    messageObj.media.url = this.getImageUrl(req, messageObj.media.url);
  }
  
  if (messageObj.media.thumbnail) {
    messageObj.media.thumbnail = this.getImageUrl(req, messageObj.media.thumbnail);
  }
  
  return messageObj;
};
