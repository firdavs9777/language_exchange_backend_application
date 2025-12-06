/**
 * User Limitations Configuration
 * 
 * Defines daily limits for different user types (visitor, regular, VIP)
 * VIP users have unlimited access to all features
 */

module.exports = {
  visitor: {
    messagesPerDay: 10,
    profileViewsPerDay: 20
  },
  regular: {
    messagesPerDay: 50,
    momentsPerDay: 5,
    storiesPerDay: 3,
    commentsPerDay: 20,
    profileViewsPerDay: 100
  },
  vip: {
    // All features are unlimited for VIP users
    // No limits defined here - VIP users bypass all checks
  }
};

