/**
 * User Limitations Configuration
 * 
 * Defines daily limits for different user types (visitor, regular, VIP)
 * VIP users have unlimited access to all features
 */

module.exports = {
  visitor: {
    messagesPerDay: 100,
    profileViewsPerDay: 100
  },
  regular: {
    messagesPerDay: 500,
    momentsPerDay: 100,
    storiesPerDay: 100,
    commentsPerDay: 30,
    profileViewsPerDay: 100
  },
  vip: {
    // All features are unlimited for VIP users
    // No limits defined here - VIP users bypass all checks
  }
};

